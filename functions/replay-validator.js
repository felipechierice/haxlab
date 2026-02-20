/**
 * Validador de Replay Server-Side
 * 
 * Versão server-side do replay-validator que roda nas Firebase Functions
 * para garantir que a validação não pode ser contornada no client
 */

/**
 * Tipos de nível de suspeita
 */
const SuspicionLevel = {
  NONE: 'none',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

/**
 * Classe que valida replays no servidor
 */
class ReplayValidator {
  /**
   * Valida um replay completo
   */
  validate(replay, playlist) {
    const result = {
      valid: true,
      suspicionLevel: SuspicionLevel.NONE,
      reasons: [],
      details: {}
    };
    
    // Executar todas as validações
    this.validateIntegrity(replay, result);
    this.validateHumanActivity(replay, result);
    this.validateProgression(replay, playlist, result);
    this.validateInputs(replay, result);
    
    return result;
  }
  
  /**
   * VALIDAÇÃO 1: Integridade Básica dos Dados
   */
  validateIntegrity(replay, result) {
    // Deve ter eventos
    if (!replay.events || replay.events.length === 0) {
      result.valid = false;
      result.suspicionLevel = SuspicionLevel.HIGH;
      result.reasons.push('Replay sem eventos de input');
      return;
    }
    
    // Tempo total deve ser válido
    if (replay.totalTime <= 0 || !isFinite(replay.totalTime) || isNaN(replay.totalTime)) {
      result.valid = false;
      result.suspicionLevel = SuspicionLevel.HIGH;
      result.reasons.push(`Tempo total inválido: ${replay.totalTime}`);
    }
    
    // Timestamps dos eventos devem ser crescentes
    for (let i = 1; i < replay.events.length; i++) {
      if (replay.events[i].timestamp < replay.events[i-1].timestamp) {
        result.valid = false;
        result.suspicionLevel = SuspicionLevel.HIGH;
        result.reasons.push(`Timestamps não crescentes: evento ${i-1} (${replay.events[i-1].timestamp}ms) > evento ${i} (${replay.events[i].timestamp}ms)`);
        break;
      }
    }
    
    // Timestamps dos cenários devem ser crescentes
    if (replay.scenarios && replay.scenarios.length > 1) {
      for (let i = 1; i < replay.scenarios.length; i++) {
        if (replay.scenarios[i].startTime < replay.scenarios[i-1].startTime) {
          result.valid = false;
          result.suspicionLevel = SuspicionLevel.HIGH;
          result.reasons.push(`Timestamps de cenários não crescentes`);
          break;
        }
      }
    }
    
    // Último evento deve ser próximo do tempo total
    if (replay.events.length > 0) {
      const lastEvent = replay.events[replay.events.length - 1];
      const timeDiff = Math.abs(lastEvent.timestamp / 1000 - replay.totalTime);
      
      if (timeDiff > 3) {
        this.updateSuspicionLevel(result, SuspicionLevel.MEDIUM);
        result.reasons.push(`Último evento muito diferente do tempo total (diff: ${timeDiff.toFixed(2)}s)`);
      }
    }
    
    // scenarioIndex dos eventos deve estar dentro do range
    if (replay.scenarios) {
      const maxScenarioIndex = replay.scenarios.length - 1;
      for (const event of replay.events) {
        if (event.scenarioIndex < 0 || event.scenarioIndex > maxScenarioIndex) {
          result.valid = false;
          result.suspicionLevel = SuspicionLevel.HIGH;
          result.reasons.push(`Evento com scenarioIndex inválido: ${event.scenarioIndex}`);
          break;
        }
      }
    }
  }
  
  /**
   * VALIDAÇÃO 2: Atividade Humana
   */
  validateHumanActivity(replay, result) {
    const totalTimeSeconds = replay.totalTime;
    const eventCount = replay.events.length;
    
    // Densidade de inputs
    const inputDensity = eventCount / totalTimeSeconds;
    result.details.inputDensity = inputDensity.toFixed(2);
    
    // Muito poucos inputs
    if (inputDensity < 0.3) {
      this.updateSuspicionLevel(result, SuspicionLevel.MEDIUM);
      result.reasons.push(`Densidade de inputs muito baixa: ${inputDensity.toFixed(2)} inputs/s`);
    }
    
    // Muitos inputs (impossível para humano)
    if (inputDensity > 30) {
      result.valid = false;
      result.suspicionLevel = SuspicionLevel.HIGH;
      result.reasons.push(`Densidade de inputs impossível: ${inputDensity.toFixed(2)} inputs/s`);
    }
    
    // Verificar eventos simultâneos
    const timestampCounts = new Map();
    for (const event of replay.events) {
      timestampCounts.set(event.timestamp, (timestampCounts.get(event.timestamp) || 0) + 1);
    }
    
    let simultaneousEvents = 0;
    for (const [timestamp, count] of timestampCounts) {
      if (count > 2) {
        simultaneousEvents++;
        if (count > 4) {
          this.updateSuspicionLevel(result, SuspicionLevel.HIGH);
          result.reasons.push(`${count} eventos simultâneos em ${timestamp}ms`);
        }
      }
    }
    
    if (simultaneousEvents > 5) {
      this.updateSuspicionLevel(result, SuspicionLevel.MEDIUM);
      result.reasons.push(`${simultaneousEvents} grupos de eventos simultâneos`);
    }
    
    // Verificar intervalos muito rápidos
    let tooFastEvents = 0;
    for (let i = 1; i < replay.events.length; i++) {
      const prev = replay.events[i-1];
      const curr = replay.events[i];
      const interval = curr.timestamp - prev.timestamp;
      
      if (interval < 5 && (prev.action !== curr.action || prev.type === curr.type)) {
        tooFastEvents++;
      }
    }
    
    if (tooFastEvents > eventCount * 0.1) {
      this.updateSuspicionLevel(result, SuspicionLevel.MEDIUM);
      result.reasons.push(`${tooFastEvents} eventos com intervalos muito rápidos`);
    }
  }
  
  /**
   * VALIDAÇÃO 3: Progressão de Cenários
   */
  validateProgression(replay, playlist, result) {
    if (!replay.scenarios || !playlist || !playlist.scenarios) {
      return; // Não podemos validar sem dados de cenários
    }
    
    // Número de cenários deve bater
    if (replay.scenarios.length !== playlist.scenarios.length) {
      result.valid = false;
      result.suspicionLevel = SuspicionLevel.HIGH;
      result.reasons.push(`Número incorreto de cenários: ${replay.scenarios.length} vs ${playlist.scenarios.length}`);
      return;
    }
    
    // Cenários devem estar em ordem
    for (let i = 0; i < replay.scenarios.length; i++) {
      if (replay.scenarios[i].scenarioIndex !== i) {
        result.valid = false;
        result.suspicionLevel = SuspicionLevel.HIGH;
        result.reasons.push(`Cenários fora de ordem`);
        break;
      }
    }
    
    // Verificar duração de cada cenário
    for (let i = 0; i < replay.scenarios.length; i++) {
      const startTime = replay.scenarios[i].startTime;
      const endTime = i < replay.scenarios.length - 1 
        ? replay.scenarios[i + 1].startTime 
        : replay.totalTime * 1000;
      
      const duration = (endTime - startTime) / 1000;
      
      if (duration < 0.5) {
        result.valid = false;
        result.suspicionLevel = SuspicionLevel.HIGH;
        result.reasons.push(`Cenário ${i} completado instantaneamente: ${duration.toFixed(3)}s`);
      }
      
      if (duration > 600 && i < replay.scenarios.length - 1) {
        this.updateSuspicionLevel(result, SuspicionLevel.LOW);
        result.reasons.push(`Cenário ${i} muito longo: ${duration.toFixed(1)}s`);
      }
    }
    
    // Contar resets excessivos
    const resetCount = replay.scenarios.filter(s => s.wasReset).length;
    result.details.resetCount = resetCount;
    
    if (resetCount > 100) {
      this.updateSuspicionLevel(result, SuspicionLevel.MEDIUM);
      result.reasons.push(`Número excessivo de resets: ${resetCount}`);
    }
  }
  
  /**
   * VALIDAÇÃO 4: Consistência de Inputs
   */
  validateInputs(replay, result) {
    const keyStates = new Map();
    const actions = ['up', 'down', 'left', 'right', 'kick'];
    
    for (const action of actions) {
      keyStates.set(action, { pressed: false, timestamp: 0, pressCount: 0 });
    }
    
    let inconsistencies = 0;
    let veryShortPresses = 0;
    let veryShortKicks = 0;
    
    for (const event of replay.events) {
      const state = keyStates.get(event.action);
      if (!state) continue;
      
      if (event.type === 'keydown') {
        if (state.pressed) {
          inconsistencies++;
        }
        state.pressed = true;
        state.timestamp = event.timestamp;
        state.pressCount++;
      } else { // keyup
        if (!state.pressed) {
          inconsistencies++;
        } else {
          const pressDuration = event.timestamp - state.timestamp;
          
          if (event.action === 'kick' && pressDuration < 15) {
            veryShortKicks++;
          }
          
          if (pressDuration < 3) {
            veryShortPresses++;
          }
        }
        
        state.pressed = false;
      }
    }
    
    if (inconsistencies > 10) {
      this.updateSuspicionLevel(result, SuspicionLevel.MEDIUM);
      result.reasons.push(`${inconsistencies} inconsistências de estado de teclas`);
    }
    
    if (veryShortPresses > 20) {
      this.updateSuspicionLevel(result, SuspicionLevel.MEDIUM);
      result.reasons.push(`${veryShortPresses} teclas pressionadas por < 3ms`);
    }
    
    if (veryShortKicks > 5) {
      this.updateSuspicionLevel(result, SuspicionLevel.MEDIUM);
      result.reasons.push(`${veryShortKicks} kicks com duração < 15ms`);
    }
    
    // Verificar taxa de kicks
    const kickState = keyStates.get('kick');
    const kicksPerSecond = kickState.pressCount / replay.totalTime;
    result.details.kicksPerSecond = kicksPerSecond.toFixed(2);
    
    if (kicksPerSecond > 10) {
      this.updateSuspicionLevel(result, SuspicionLevel.MEDIUM);
      result.reasons.push(`Taxa de kicks muito alta: ${kicksPerSecond.toFixed(2)} kicks/s`);
    }
  }
  
  /**
   * Helper para atualizar nível de suspeita
   */
  updateSuspicionLevel(result, newLevel) {
    const levels = [SuspicionLevel.NONE, SuspicionLevel.LOW, SuspicionLevel.MEDIUM, SuspicionLevel.HIGH];
    const currentIndex = levels.indexOf(result.suspicionLevel);
    const newIndex = levels.indexOf(newLevel);
    
    if (newIndex > currentIndex) {
      result.suspicionLevel = newLevel;
    }
    
    if (result.suspicionLevel === SuspicionLevel.HIGH) {
      result.valid = false;
    }
  }
}

export { ReplayValidator, SuspicionLevel };
