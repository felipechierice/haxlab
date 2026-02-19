/**
 * ReplayInputController - Controlador para Reprodução de Replays
 * 
 * Reproduz inputs gravados de um replay, simulando as ações do jogador
 * no momento exato em que foram executadas.
 */

import { 
  InputController, 
  Direction, 
  InputState,
  inputFlagsToDirection 
} from './InputController.js';
import { ReplayData, ReplayInputEvent, ReplayAction, ReplayScenarioInfo } from '../types.js';

/**
 * Estado dos inputs no momento atual do replay
 */
interface ReplayInputFlags {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  kick: boolean;
}

/**
 * Callback para quando um evento de cenário deve ser processado
 */
type ScenarioEventCallback = (scenarioInfo: ReplayScenarioInfo) => void;

export class ReplayInputController implements InputController {
  private replayData: ReplayData;
  private currentTime: number = 0; // Tempo atual em ms desde o início
  private eventIndex: number = 0; // Índice do próximo evento de input a processar
  private scenarioIndex: number = 0; // Índice do próximo evento de cenário a processar
  private inputFlags: ReplayInputFlags;
  private currentDirection: Direction = null;
  private isPlaying: boolean = false;
  private onScenarioEvent: ScenarioEventCallback | null = null;
  
  constructor(replayData: ReplayData) {
    this.replayData = replayData;
    this.inputFlags = {
      up: false,
      down: false,
      left: false,
      right: false,
      kick: false
    };
  }
  
  /**
   * Define callback para eventos de cenário
   */
  setScenarioEventCallback(callback: ScenarioEventCallback | null): void {
    this.onScenarioEvent = callback;
  }
  
  /**
   * Inicia a reprodução do replay
   */
  start(): void {
    this.isPlaying = true;
    this.currentTime = 0;
    this.eventIndex = 0;
    this.scenarioIndex = 0;
    this.resetInputs();
  }
  
  /**
   * Para a reprodução do replay
   */
  stop(): void {
    this.isPlaying = false;
    this.resetInputs();
  }
  
  /**
   * Reseta todos os inputs para falso
   */
  private resetInputs(): void {
    this.inputFlags.up = false;
    this.inputFlags.down = false;
    this.inputFlags.left = false;
    this.inputFlags.right = false;
    this.inputFlags.kick = false;
    this.updateDirection();
  }
  
  /**
   * Processa eventos do replay baseado no tempo atual
   */
  private processEvents(): void {
    if (!this.isPlaying) return;
    
    // Processar eventos de cenário (reset, mudança de cenário)
    // IMPORTANTE: Processar cenários ANTES dos inputs para garantir ordem correta
    if (this.replayData.scenarios) {
      while (
        this.scenarioIndex < this.replayData.scenarios.length &&
        this.replayData.scenarios[this.scenarioIndex].startTime <= this.currentTime
      ) {
        const scenarioInfo = this.replayData.scenarios[this.scenarioIndex];
        console.log(`[ReplayInput] Processing scenario event at time ${this.currentTime}ms:`, scenarioInfo);
        // Notificar sobre evento de cenário (exceto o primeiro que já é iniciado automaticamente)
        if (this.scenarioIndex > 0 && this.onScenarioEvent) {
          console.log('[ReplayInput] Calling scenario callback');
          // Resetar inputs antes de notificar - o novo cenário começa sem teclas pressionadas
          this.resetInputs();
          this.onScenarioEvent(scenarioInfo);
        }
        this.scenarioIndex++;
      }
    }
    
    // Processar eventos de input
    if (this.replayData.events) {
      while (
        this.eventIndex < this.replayData.events.length &&
        this.replayData.events[this.eventIndex].timestamp <= this.currentTime
      ) {
        const event = this.replayData.events[this.eventIndex];
        this.applyEvent(event);
        this.eventIndex++;
      }
    }
    
    this.updateDirection();
  }
  
  /**
   * Aplica um evento de input aos flags
   */
  private applyEvent(event: ReplayInputEvent): void {
    const isPressed = event.type === 'keydown';
    
    switch (event.action) {
      case 'up':
        this.inputFlags.up = isPressed;
        break;
      case 'down':
        this.inputFlags.down = isPressed;
        break;
      case 'left':
        this.inputFlags.left = isPressed;
        break;
      case 'right':
        this.inputFlags.right = isPressed;
        break;
      case 'kick':
        this.inputFlags.kick = isPressed;
        break;
    }
  }
  
  /**
   * Atualiza a direção baseado nos flags atuais
   */
  private updateDirection(): void {
    this.currentDirection = inputFlagsToDirection(this.inputFlags);
  }
  
  /**
   * Define o tempo atual da playlist (em segundos)
   * Usado pelo PlaylistMode para sincronizar com o tempo total da playlist
   */
  setPlaylistTime(timeInSeconds: number): void {
    if (!this.isPlaying) return;
    
    const newTime = timeInSeconds * 1000;
    
    // Se voltamos no tempo (ex: reset de cenário), não precisamos fazer nada especial
    // porque os eventos de input posteriores ainda não foram processados
    // e os eventos de cenário já foram atualizados
    
    this.currentTime = newTime;
    this.processEvents();
  }
  
  /**
   * Atualiza o controlador (chamado a cada frame)
   * @param dt Delta time do frame (não usado diretamente)
   * @param simulationTime Tempo de simulação do jogo (não usado - usamos setPlaylistTime)
   */
  update(_dt: number, _simulationTime: number): void {
    // O tempo é atualizado via setPlaylistTime() pelo PlaylistMode
    // Este método existe para compatibilidade com a interface InputController
  }
  
  getMovementDirection(): Direction {
    return this.currentDirection;
  }
  
  isKickPressed(): boolean {
    return this.inputFlags.kick;
  }
  
  getInputState(): InputState {
    return {
      direction: this.currentDirection,
      kicking: this.inputFlags.kick
    };
  }
  
  reset(): void {
    this.currentTime = 0;
    this.eventIndex = 0;
    this.scenarioIndex = 0;
    this.resetInputs();
  }
  
  /**
   * Retorna o tempo atual da reprodução em segundos
   */
  getCurrentTime(): number {
    return this.currentTime / 1000;
  }
  
  /**
   * Define o tempo atual da reprodução (para seek)
   */
  setCurrentTime(timeInSeconds: number): void {
    const newTime = timeInSeconds * 1000;
    
    // Se estamos voltando no tempo, resetar e reprocessar
    if (newTime < this.currentTime) {
      this.currentTime = 0;
      this.eventIndex = 0;
      this.scenarioIndex = 0;
      this.resetInputs();
    }
    
    this.currentTime = newTime;
    this.processEvents();
  }
  
  /**
   * Verifica se o replay terminou
   */
  isFinished(): boolean {
    return this.currentTime >= this.replayData.totalTime * 1000;
  }
  
  /**
   * Retorna o tempo total do replay em segundos
   */
  getTotalTime(): number {
    return this.replayData.totalTime;
  }
  
  /**
   * Retorna os dados do replay
   */
  getReplayData(): ReplayData {
    return this.replayData;
  }
}
