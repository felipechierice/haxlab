/**
 * BotVirtualInputController - Controlador de Input Virtual para Bots
 * 
 * Implementa a interface InputController para bots, permitindo que a
 * extrapolação funcione de forma idêntica para jogadores e bots.
 * 
 * Suporta três modos (presets):
 * - None: Bot fica parado (idle)
 * - Patrol: Executa uma sequência de comandos cronometrados
 * - Autonomous: Calcula direção dinamicamente baseado em um alvo
 */

import { 
  InputController, 
  InputState,
  vectorToDirection 
} from './InputController.js';
import { 
  Vector2D, 
  GameState, 
  Player,
  Direction,
  BotBehavior,
  BotPresetType,
  NoneBehaviorConfig,
  PatrolBehaviorConfig,
  AutonomousBehaviorConfig,
  PatrolCommand,
  AutonomousStrategy
} from '../types.js';
import { Physics } from '../physics.js';

// Re-export types for convenience
export type { 
  BotPresetType, 
  NoneBehaviorConfig, 
  PatrolBehaviorConfig, 
  AutonomousBehaviorConfig,
  PatrolCommand,
  AutonomousStrategy,
  BotBehavior 
};

// ==================== CONTROLADOR ====================

export class BotVirtualInputController implements InputController {
  private bot: Player;
  private behavior: BotBehavior;
  
  // Estado atual
  private currentDirection: Direction = null;
  private kickPressed: boolean = false;
  
  // Estado do preset Patrol
  private patrolState = {
    currentCommandIndex: 0,
    elapsedMs: 0,
    finished: false
  };
  
  // Estado do preset Autonomous
  private autonomousState = {
    pendingDirection: null as Direction | null,
    pendingDirectionTime: 0,
    lastTargetPosition: null as Vector2D | null
  };
  
  // Referência ao game state (atualizado a cada frame)
  private gameState: GameState | null = null;
  
  constructor(bot: Player, behavior: BotBehavior) {
    this.bot = bot;
    this.behavior = behavior;
  }
  
  /**
   * Atualiza a referência ao game state (chamado pelo game antes de update)
   */
  setGameState(state: GameState): void {
    this.gameState = state;
  }
  
  /**
   * Atualiza o comportamento do bot em runtime
   */
  setBehavior(behavior: BotBehavior): void {
    this.behavior = behavior;
    this.reset();
  }
  
  getMovementDirection(): Direction {
    return this.currentDirection;
  }
  
  isKickPressed(): boolean {
    return this.kickPressed;
  }
  
  getInputState(): InputState {
    return {
      direction: this.currentDirection,
      kicking: this.kickPressed
    };
  }
  
  update(dt: number, simulationTime: number): void {
    // Reset kick no início do frame
    this.kickPressed = false;
    
    switch (this.behavior.preset) {
      case 'none':
        this.updateNonePreset();
        break;
      case 'patrol':
        this.updatePatrolPreset(dt);
        break;
      case 'autonomous':
        this.updateAutonomousPreset(dt, simulationTime);
        break;
    }
  }
  
  reset(): void {
    this.currentDirection = null;
    this.kickPressed = false;
    this.patrolState = {
      currentCommandIndex: 0,
      elapsedMs: 0,
      finished: false
    };
    this.autonomousState = {
      pendingDirection: null,
      pendingDirectionTime: 0,
      lastTargetPosition: null
    };
  }
  
  // ==================== NONE PRESET ====================
  
  private updateNonePreset(): void {
    this.currentDirection = null;
    
    const config = this.behavior.config as NoneBehaviorConfig;
    
    // Chuta se a bola encostar e kickOnContact está ativo
    if (config.kickOnContact && this.gameState) {
      const ball = this.gameState.ball;
      const distToBall = Physics.vectorLength(
        Physics.vectorSub(ball.circle.pos, this.bot.circle.pos)
      );
      const touchDistance = this.bot.circle.radius + ball.circle.radius + 5;
      
      if (distToBall <= touchDistance) {
        this.kickPressed = true;
      }
    }
  }
  
  // ==================== PATROL PRESET ====================
  
  private updatePatrolPreset(dt: number): void {
    const config = this.behavior.config as PatrolBehaviorConfig;
    
    if (config.commands.length === 0 || this.patrolState.finished) {
      this.currentDirection = null;
      return;
    }
    
    const command = config.commands[this.patrolState.currentCommandIndex];
    
    // Atualiza tempo
    this.patrolState.elapsedMs += dt * 1000;
    
    // Aplica comando atual
    switch (command.action) {
      case 'move':
        this.currentDirection = command.direction ?? null;
        break;
      case 'kick':
        // Kick é instantâneo - apenas ativa o chute e avança imediatamente
        this.currentDirection = null;
        this.kickPressed = true;
        this.advanceToNextCommand(config);
        return; // Kick é instantâneo, não usa duração
      case 'wait':
        this.currentDirection = null;
        break;
    }
    
    // Avança para próximo comando se tempo expirou (move e wait usam duração)
    if (this.patrolState.elapsedMs >= command.durationMs) {
      this.advanceToNextCommand(config);
    }
  }
  
  private advanceToNextCommand(config: PatrolBehaviorConfig): void {
    this.patrolState.elapsedMs = 0;
    this.patrolState.currentCommandIndex++;
    
    // Verifica loop
    if (this.patrolState.currentCommandIndex >= config.commands.length) {
      if (config.loop !== false) {
        this.patrolState.currentCommandIndex = 0;
      } else {
        this.patrolState.finished = true;
        this.currentDirection = null;
      }
    }
  }
  
  // ==================== AUTONOMOUS PRESET ====================
  
  private updateAutonomousPreset(dt: number, simulationTime: number): void {
    if (!this.gameState) {
      this.currentDirection = null;
      return;
    }
    
    const config = this.behavior.config as AutonomousBehaviorConfig;
    
    // Calcula alvo baseado na estratégia
    const target = this.calculateTarget(config);
    
    if (!target) {
      this.currentDirection = null;
      return;
    }
    
    // Calcula direção para o alvo
    const dx = target.x - this.bot.circle.pos.x;
    const dy = target.y - this.bot.circle.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Verifica se deve parar (keepDistance)
    if (config.keepDistance && distance < config.keepDistance) {
      this.currentDirection = null;
    } else if (distance > 5) { // Deadzone de 5px
      // Aplica delay de reação se configurado
      const newDirection = vectorToDirection(dx, dy);
      
      if (config.reactionDelayMs && config.reactionDelayMs > 0) {
        if (this.autonomousState.pendingDirection !== newDirection) {
          this.autonomousState.pendingDirection = newDirection;
          this.autonomousState.pendingDirectionTime = simulationTime;
        }
        
        const elapsed = (simulationTime - this.autonomousState.pendingDirectionTime) * 1000;
        if (elapsed >= config.reactionDelayMs) {
          this.currentDirection = newDirection;
        }
      } else {
        this.currentDirection = newDirection;
      }
    } else {
      this.currentDirection = null;
    }
    
    // Verifica se deve chutar
    this.checkAutonomousKick(config, distance);
  }
  
  private calculateTarget(config: AutonomousBehaviorConfig): Vector2D | null {
    if (!this.gameState) return null;
    
    switch (config.strategy) {
      case 'chase_ball':
        return this.gameState.ball.circle.pos;
        
      case 'aim_at_goal': {
        // Posiciona atrás da bola, alinhado com o gol adversário
        const ball = this.gameState.ball.circle.pos;
        const goalX = this.bot.team === 'red' ? 950 : 50;
        const goalY = 300;
        
        const ballToGoal = Physics.vectorNormalize(
          Physics.vectorSub({ x: goalX, y: goalY }, ball)
        );
        
        const idealDistance = 40;
        return {
          x: ball.x - ballToGoal.x * idealDistance,
          y: ball.y - ballToGoal.y * idealDistance
        };
      }
        
      case 'mark_player': {
        const targetPlayer = this.gameState.players.find(
          p => p.id === config.targetPlayerId
        );
        if (!targetPlayer) return null;
        
        // Posiciona entre o jogador e a bola
        const ball = this.gameState.ball.circle.pos;
        const playerToBall = Physics.vectorNormalize(
          Physics.vectorSub(ball, targetPlayer.circle.pos)
        );
        
        const markDistance = config.keepDistance ?? 50;
        return {
          x: targetPlayer.circle.pos.x + playerToBall.x * markDistance,
          y: targetPlayer.circle.pos.y + playerToBall.y * markDistance
        };
      }
        
      case 'intercept_ball': {
        const ball = this.gameState.ball;
        const ballVel = ball.circle.vel;
        const ballSpeed = Physics.vectorLength(ballVel);
        
        // Prediz posição da bola
        if (ballSpeed > 10) {
          const predictionTime = 0.5;
          return {
            x: ball.circle.pos.x + ballVel.x * predictionTime,
            y: ball.circle.pos.y + ballVel.y * predictionTime
          };
        }
        return ball.circle.pos;
      }
        
      case 'stay_at_position':
        return config.targetPosition ?? null;
        
      default:
        return null;
    }
  }
  
  private checkAutonomousKick(config: AutonomousBehaviorConfig, distanceToTarget: number): void {
    if (!this.gameState) return;
    
    const kickDistance = config.kickDistance ?? 35;
    const ball = this.gameState.ball.circle.pos;
    const distToBall = Physics.vectorLength(
      Physics.vectorSub(ball, this.bot.circle.pos)
    );
    
    // Chuta se perto da bola
    if (distToBall <= kickDistance) {
      // Se kickWhenAligned, verifica alinhamento com o gol
      if (config.kickWhenAligned) {
        const goalX = this.bot.team === 'red' ? 950 : 50;
        const goalY = 300;
        
        // Vetor bot -> bola
        const botToBall = Physics.vectorSub(ball, this.bot.circle.pos);
        const botToBallNorm = Physics.vectorNormalize(botToBall);
        
        // Vetor bola -> gol
        const ballToGoal = Physics.vectorSub({ x: goalX, y: goalY }, ball);
        const ballToGoalNorm = Physics.vectorNormalize(ballToGoal);
        
        // Dot product para verificar alinhamento
        const alignment = Physics.vectorDot(botToBallNorm, ballToGoalNorm);
        
        // Se bem alinhado (dot > 0.7 ≈ 45°), chuta
        if (alignment > 0.7) {
          this.kickPressed = true;
        }
      } else {
        this.kickPressed = true;
      }
    }
  }
  
  // ==================== UTILITÁRIOS ====================
  
  /**
   * Retorna o preset atual
   */
  getPreset(): BotPresetType {
    return this.behavior.preset;
  }
  
  /**
   * Retorna a configuração de comportamento atual
   */
  getBehavior(): BotBehavior {
    return this.behavior;
  }
  
  /**
   * Verifica se o patrol terminou (para presets não-loop)
   */
  isPatrolFinished(): boolean {
    if (this.behavior.preset !== 'patrol') return false;
    return this.patrolState.finished;
  }
  
  /**
   * Retorna o índice do comando atual no patrol
   */
  getCurrentPatrolIndex(): number {
    return this.patrolState.currentCommandIndex;
  }
}
