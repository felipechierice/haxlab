/**
 * Sistema de Extrapolation para HaxLab
 * 
 * Simula o estado futuro do jogo para reduzir input lag percebido.
 * Baseado no sistema de extrapolation do Haxball.
 * 
 * Como funciona:
 * 1. Clona o estado atual do jogo
 * 2. Aplica os inputs do jogador ao clone
 * 3. Simula física por N milissegundos
 * 4. Retorna posições extrapoladas para renderização
 * 
 * Valores típicos:
 * - 0ms: Sem extrapolation (padrão)
 * - 20-60ms: Sweet spot - predições precisas, gameplay suave
 * - 100ms+: Mais "shaky", mas alguns jogadores preferem
 */

import { GameState, Player, Circle, Segment, Vector2D, GameConfig, Ball } from './types.js';
import { Physics } from './physics.js';

/** Posições extrapoladas para renderização */
export interface ExtrapolatedPositions {
  ball: Vector2D;
  players: Map<string, Vector2D>;
}

/** Estado temporário para simulação (evita alocações) */
interface SimulationState {
  ballPos: Vector2D;
  ballVel: Vector2D;
  playerPos: Map<string, Vector2D>;
  playerVel: Map<string, Vector2D>;
}

/**
 * Classe que gerencia a simulação de extrapolation
 */
export class Extrapolation {
  /** Tempo de extrapolation em milissegundos */
  private extrapolationMs: number = 0;
  
  /** Timestep fixo para simulação (60fps = ~16.67ms) */
  private readonly SIMULATION_TIMESTEP = 1 / 60;
  
  /** Estado reutilizável para simulação */
  private simState: SimulationState = {
    ballPos: { x: 0, y: 0 },
    ballVel: { x: 0, y: 0 },
    playerPos: new Map(),
    playerVel: new Map()
  };
  
  /** Cache de resultado para evitar alocações */
  private cachedResult: ExtrapolatedPositions = {
    ball: { x: 0, y: 0 },
    players: new Map()
  };
  
  /** Círculo temporário para simulação de colisões */
  private tempBallCircle: Circle = {
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    radius: 10,
    mass: 1,
    damping: Physics.BALL_DAMPING,
    invMass: 1
  };
  
  private tempPlayerCircle: Circle = {
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    radius: 15,
    mass: 10,
    damping: Physics.PLAYER_DAMPING,
    invMass: 0.1
  };

  /**
   * Define o tempo de extrapolation
   * @param ms Milissegundos de extrapolation (0 = desligado)
   */
  setExtrapolation(ms: number): void {
    this.extrapolationMs = Math.max(0, Math.min(200, ms)); // Limita entre 0 e 200ms
  }

  /**
   * Obtém o tempo de extrapolation atual
   */
  getExtrapolation(): number {
    return this.extrapolationMs;
  }

  /**
   * Verifica se extrapolation está ativo
   */
  isEnabled(): boolean {
    return this.extrapolationMs > 0;
  }

  /**
   * Calcula posições extrapoladas baseado no estado atual e inputs
   * 
   * @param state Estado atual do jogo
   * @param segments Segmentos do mapa (paredes)
   * @param controlledPlayerId ID do jogador controlado
   * @param playerInput Input atual do jogador
   * @param config Configurações do jogo
   * @returns Posições extrapoladas para renderização
   */
  extrapolate(
    state: GameState,
    segments: Segment[],
    controlledPlayerId: string,
    playerInput: { up: boolean; down: boolean; left: boolean; right: boolean },
    config: GameConfig
  ): ExtrapolatedPositions {
    // Se extrapolation está desligado, retorna posições atuais
    if (this.extrapolationMs <= 0) {
      this.cachedResult.ball.x = state.ball.circle.pos.x;
      this.cachedResult.ball.y = state.ball.circle.pos.y;
      
      this.cachedResult.players.clear();
      for (const player of state.players) {
        this.cachedResult.players.set(player.id, {
          x: player.circle.pos.x,
          y: player.circle.pos.y
        });
      }
      
      return this.cachedResult;
    }

    // Copia estado atual para simulação
    this.copyStateForSimulation(state);

    // Calcula número de steps necessários
    const dt = this.extrapolationMs / 1000;
    const steps = Math.ceil(this.extrapolationMs / (this.SIMULATION_TIMESTEP * 1000));
    const stepDt = dt / steps;

    // Simula física para frente
    for (let i = 0; i < steps; i++) {
      this.simulateStep(
        state,
        segments,
        controlledPlayerId,
        playerInput,
        config,
        stepDt
      );
    }

    // Copia resultados para o cache
    this.cachedResult.ball.x = this.simState.ballPos.x;
    this.cachedResult.ball.y = this.simState.ballPos.y;
    
    this.cachedResult.players.clear();
    for (const [playerId, pos] of this.simState.playerPos) {
      this.cachedResult.players.set(playerId, { x: pos.x, y: pos.y });
    }

    return this.cachedResult;
  }

  /**
   * Copia o estado atual para as variáveis de simulação
   */
  private copyStateForSimulation(state: GameState): void {
    // Bola
    this.simState.ballPos.x = state.ball.circle.pos.x;
    this.simState.ballPos.y = state.ball.circle.pos.y;
    this.simState.ballVel.x = state.ball.circle.vel.x;
    this.simState.ballVel.y = state.ball.circle.vel.y;

    // Jogadores
    this.simState.playerPos.clear();
    this.simState.playerVel.clear();
    
    for (const player of state.players) {
      this.simState.playerPos.set(player.id, {
        x: player.circle.pos.x,
        y: player.circle.pos.y
      });
      this.simState.playerVel.set(player.id, {
        x: player.circle.vel.x,
        y: player.circle.vel.y
      });
    }
  }

  /**
   * Executa um step de simulação
   */
  private simulateStep(
    state: GameState,
    segments: Segment[],
    controlledPlayerId: string,
    playerInput: { up: boolean; down: boolean; left: boolean; right: boolean },
    config: GameConfig,
    dt: number
  ): void {
    // 1. Atualiza jogadores
    for (const player of state.players) {
      const pos = this.simState.playerPos.get(player.id)!;
      const vel = this.simState.playerVel.get(player.id)!;
      
      // Aplica input do jogador controlado
      if (player.id === controlledPlayerId) {
        this.applyPlayerInput(vel, playerInput, config, dt);
      } else if (player.isBot) {
        // Bots mantêm sua direção atual (input já aplicado no frame real)
        // Não precisamos simular a IA, apenas continuar o movimento
      }
      
      // Limita velocidade máxima
      const maxSpeed = config.playerSpeed ?? Physics.PLAYER_MAX_SPEED;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
      if (speed > maxSpeed) {
        vel.x = (vel.x / speed) * maxSpeed;
        vel.y = (vel.y / speed) * maxSpeed;
      }
      
      // Atualiza posição
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      
      // Aplica damping
      const dampingFactor = Math.pow(Physics.PLAYER_DAMPING, dt * 60);
      vel.x *= dampingFactor;
      vel.y *= dampingFactor;
      
      // Colisão com paredes
      this.tempPlayerCircle.pos.x = pos.x;
      this.tempPlayerCircle.pos.y = pos.y;
      this.tempPlayerCircle.vel.x = vel.x;
      this.tempPlayerCircle.vel.y = vel.y;
      this.tempPlayerCircle.radius = player.circle.radius;
      
      for (const segment of segments) {
        if (segment.playerCollision) {
          if (Physics.checkSegmentCollision(this.tempPlayerCircle, segment)) {
            Physics.resolveSegmentCollision(this.tempPlayerCircle, segment);
            pos.x = this.tempPlayerCircle.pos.x;
            pos.y = this.tempPlayerCircle.pos.y;
            vel.x = this.tempPlayerCircle.vel.x;
            vel.y = this.tempPlayerCircle.vel.y;
          }
        }
      }
    }

    // 2. Atualiza bola
    const ballPos = this.simState.ballPos;
    const ballVel = this.simState.ballVel;
    
    ballPos.x += ballVel.x * dt;
    ballPos.y += ballVel.y * dt;
    
    // Damping da bola
    const ballDampingFactor = Math.pow(state.ball.circle.damping, dt * 60);
    ballVel.x *= ballDampingFactor;
    ballVel.y *= ballDampingFactor;
    
    // Colisão da bola com paredes
    this.tempBallCircle.pos.x = ballPos.x;
    this.tempBallCircle.pos.y = ballPos.y;
    this.tempBallCircle.vel.x = ballVel.x;
    this.tempBallCircle.vel.y = ballVel.y;
    this.tempBallCircle.radius = state.ball.circle.radius;
    this.tempBallCircle.damping = state.ball.circle.damping;
    
    for (const segment of segments) {
      if (Physics.checkSegmentCollision(this.tempBallCircle, segment)) {
        Physics.resolveSegmentCollision(this.tempBallCircle, segment);
        ballPos.x = this.tempBallCircle.pos.x;
        ballPos.y = this.tempBallCircle.pos.y;
        ballVel.x = this.tempBallCircle.vel.x;
        ballVel.y = this.tempBallCircle.vel.y;
      }
    }

    // 3. Colisão jogador-bola
    for (const player of state.players) {
      const playerPos = this.simState.playerPos.get(player.id)!;
      const playerVel = this.simState.playerVel.get(player.id)!;
      
      this.tempPlayerCircle.pos.x = playerPos.x;
      this.tempPlayerCircle.pos.y = playerPos.y;
      this.tempPlayerCircle.vel.x = playerVel.x;
      this.tempPlayerCircle.vel.y = playerVel.y;
      this.tempPlayerCircle.radius = player.circle.radius;
      this.tempPlayerCircle.mass = player.circle.mass;
      this.tempPlayerCircle.invMass = player.circle.invMass;
      
      this.tempBallCircle.pos.x = ballPos.x;
      this.tempBallCircle.pos.y = ballPos.y;
      this.tempBallCircle.vel.x = ballVel.x;
      this.tempBallCircle.vel.y = ballVel.y;
      this.tempBallCircle.mass = state.ball.circle.mass;
      this.tempBallCircle.invMass = state.ball.circle.invMass;
      
      if (Physics.checkCircleCollision(this.tempPlayerCircle, this.tempBallCircle)) {
        Physics.resolveCircleCollision(this.tempPlayerCircle, this.tempBallCircle);
        
        // Atualiza posições após colisão
        playerPos.x = this.tempPlayerCircle.pos.x;
        playerPos.y = this.tempPlayerCircle.pos.y;
        playerVel.x = this.tempPlayerCircle.vel.x;
        playerVel.y = this.tempPlayerCircle.vel.y;
        
        ballPos.x = this.tempBallCircle.pos.x;
        ballPos.y = this.tempBallCircle.pos.y;
        ballVel.x = this.tempBallCircle.vel.x;
        ballVel.y = this.tempBallCircle.vel.y;
      }
    }

    // 4. Colisão jogador-jogador
    const players = state.players;
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const pos1 = this.simState.playerPos.get(players[i].id)!;
        const vel1 = this.simState.playerVel.get(players[i].id)!;
        const pos2 = this.simState.playerPos.get(players[j].id)!;
        const vel2 = this.simState.playerVel.get(players[j].id)!;
        
        // Setup círculo 1
        this.tempPlayerCircle.pos.x = pos1.x;
        this.tempPlayerCircle.pos.y = pos1.y;
        this.tempPlayerCircle.vel.x = vel1.x;
        this.tempPlayerCircle.vel.y = vel1.y;
        this.tempPlayerCircle.radius = players[i].circle.radius;
        this.tempPlayerCircle.mass = players[i].circle.mass;
        this.tempPlayerCircle.invMass = players[i].circle.invMass;
        
        // Setup círculo 2 (temporário)
        const tempCircle2: Circle = {
          pos: { x: pos2.x, y: pos2.y },
          vel: { x: vel2.x, y: vel2.y },
          radius: players[j].circle.radius,
          mass: players[j].circle.mass,
          damping: players[j].circle.damping,
          invMass: players[j].circle.invMass
        };
        
        if (Physics.checkCircleCollision(this.tempPlayerCircle, tempCircle2)) {
          Physics.resolveCircleCollision(this.tempPlayerCircle, tempCircle2);
          
          pos1.x = this.tempPlayerCircle.pos.x;
          pos1.y = this.tempPlayerCircle.pos.y;
          vel1.x = this.tempPlayerCircle.vel.x;
          vel1.y = this.tempPlayerCircle.vel.y;
          
          pos2.x = tempCircle2.pos.x;
          pos2.y = tempCircle2.pos.y;
          vel2.x = tempCircle2.vel.x;
          vel2.y = tempCircle2.vel.y;
        }
      }
    }
  }

  /**
   * Aplica input do jogador à velocidade
   */
  private applyPlayerInput(
    vel: Vector2D,
    input: { up: boolean; down: boolean; left: boolean; right: boolean },
    config: GameConfig,
    dt: number
  ): void {
    const accel = config.playerAcceleration ?? Physics.PLAYER_ACCELERATION;
    
    let accelX = 0;
    let accelY = 0;
    
    if (input.up) accelY -= 1;
    if (input.down) accelY += 1;
    if (input.left) accelX -= 1;
    if (input.right) accelX += 1;
    
    // Normaliza para movimento diagonal consistente
    if (accelX !== 0 || accelY !== 0) {
      const accelLength = Math.sqrt(accelX * accelX + accelY * accelY);
      const dtScale = dt * 60; // Normalizado para 60fps
      accelX = (accelX / accelLength) * accel * dtScale;
      accelY = (accelY / accelLength) * accel * dtScale;
      vel.x += accelX;
      vel.y += accelY;
    }
  }
}

/** Instância singleton para uso global */
export const extrapolation = new Extrapolation();
