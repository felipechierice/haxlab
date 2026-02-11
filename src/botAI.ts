import { 
  Player, 
  BotBehavior, 
  ProgrammedBehavior, 
  AIPresetBehavior,
  Vector2D,
  Ball,
  GameState,
  IdleParams,
  ChaseBallParams,
  MarkPlayerParams,
  InterceptParams,
  StayNearParams,
  PatrolParams
} from './types.js';
import { Physics } from './physics.js';

export class BotAI {
  private bot: Player;
  private behavior: BotBehavior;
  private programmedState: {
    currentMovementIndex: number;
    timeInCurrentMovement: number;
  } = { currentMovementIndex: 0, timeInCurrentMovement: 0 };
  private patrolState: {
    currentPointIndex: number;
    waitTimer: number;
  } = { currentPointIndex: 0, waitTimer: 0 };
  
  // Fila de movimentos com delay para simular tempo de reação
  private movementQueue: Array<{
    direction: Vector2D;
    speed: number;
    processAt: number; // timestamp em ms quando este movimento deve ser processado
  }> = [];
  private currentMovement: { direction: Vector2D; speed: number } = { direction: { x: 0, y: 0 }, speed: 0 };

  constructor(bot: Player, behavior: BotBehavior) {
    this.bot = bot;
    this.behavior = behavior;
  }

  update(gameState: GameState, dt: number): void {
    // Resetar input de chute no início de cada frame
    // O chute será setado para true pelos behaviors que precisam chutar
    this.bot.input.kick = false;
    
    if (this.behavior.type === 'programmed') {
      this.updateProgrammed(this.behavior.config as ProgrammedBehavior, dt);
    } else if (this.behavior.type === 'ai_preset') {
      this.updateAIPreset(this.behavior.config as AIPresetBehavior, gameState, dt);
    }
    
    // Processar fila de movimentos - retirar comandos cujo timestamp já passou
    const now = Date.now();
    while (this.movementQueue.length > 0 && this.movementQueue[0].processAt <= now) {
      const movement = this.movementQueue.shift()!;
      this.currentMovement = { direction: movement.direction, speed: movement.speed };
    }
    
    // Aplicar o movimento atual
    this.applyCurrentMovement();
  }

  private updateProgrammed(config: ProgrammedBehavior, dt: number): void {
    if (config.movements.length === 0) return;

    const movement = config.movements[this.programmedState.currentMovementIndex];
    this.programmedState.timeInCurrentMovement += dt;

    // Aplicar movimento
    if (movement.direction) {
      const speed = movement.speed || 1.0;
      this.bot.input.left = movement.direction.x < -0.1;
      this.bot.input.right = movement.direction.x > 0.1;
      this.bot.input.up = movement.direction.y < -0.1;
      this.bot.input.down = movement.direction.y > 0.1;
    } else {
      this.bot.input.left = false;
      this.bot.input.right = false;
      this.bot.input.up = false;
      this.bot.input.down = false;
    }

    // Chutar se necessário
    this.bot.input.kick = movement.kick || false;

    // Verificar se deve avançar para o próximo movimento
    if (this.programmedState.timeInCurrentMovement >= movement.duration) {
      this.programmedState.timeInCurrentMovement = 0;
      this.programmedState.currentMovementIndex++;

      if (this.programmedState.currentMovementIndex >= config.movements.length) {
        if (config.loop) {
          this.programmedState.currentMovementIndex = 0;
        } else {
          // Parar no último movimento
          this.programmedState.currentMovementIndex = config.movements.length - 1;
          this.bot.input.left = false;
          this.bot.input.right = false;
          this.bot.input.up = false;
          this.bot.input.down = false;
          this.bot.input.kick = false;
        }
      }
    }
  }

  private updateAIPreset(config: AIPresetBehavior, gameState: GameState, dt: number): void {
    const params = config.params;

    switch (params.type) {
      case 'idle':
        this.idle(params, gameState);
        break;
      case 'chase_ball':
        this.chaseBall(params, gameState);
        break;
      case 'mark_player':
        this.markPlayer(params, gameState);
        break;
      case 'intercept':
        this.intercept(params, gameState);
        break;
      case 'stay_near':
        this.stayNear(params, gameState);
        break;
      case 'patrol':
        this.patrol(params, gameState, dt);
        break;
    }
  }

  private idle(params: IdleParams, gameState: GameState): void {
    // Bot fica parado
    this.queueMovement({ x: 0, y: 0 }, 0, 0);
    
    // Verifica se deve chutar quando a bola encostar
    if (params.kickOnContact) {
      const ball = gameState.ball;
      const botPos = this.bot.circle.pos;
      const ballPos = ball.circle.pos;
      
      const distanceToBall = Physics.vectorLength(Physics.vectorSub(ballPos, botPos));
      const touchDistance = this.bot.circle.radius + ball.circle.radius + 5; // Margem de 5px
      
      if (distanceToBall <= touchDistance) {
        this.bot.input.kick = true;
      }
    }
  }

  private chaseBall(params: ChaseBallParams, gameState: GameState): void {
    const ball = gameState.ball;
    const ballPos = ball.circle.pos;
    const botPos = this.bot.circle.pos;
    
    // Se deve mirar no gol, calcular posição ideal
    if (params.aimAtGoal) {
      // Determinar posição do gol adversário (baseado no time do bot)
      const goalPos = this.bot.team === 'red' 
        ? { x: 950, y: 300 }  // Gol azul (direita)
        : { x: 50, y: 300 };   // Gol vermelho (esquerda)
      
      // Vetor da bola para o gol
      const ballToGoal = Physics.vectorSub(goalPos, ballPos);
      const ballToGoalNorm = Physics.vectorNormalize(ballToGoal);
      
      // Posição ideal: do lado oposto da bola em relação ao gol
      const idealDistance = 40; // Distância ideal da bola para se posicionar
      const idealPos = {
        x: ballPos.x - ballToGoalNorm.x * idealDistance,
        y: ballPos.y - ballToGoalNorm.y * idealDistance
      };
      
      // Calcular distância até posição ideal
      const toIdeal = Physics.vectorSub(idealPos, botPos);
      const distToIdeal = Physics.vectorLength(toIdeal);
      
      // Se está longe da posição ideal, mover até ela
      if (distToIdeal > 20) {
        const moveDir = Physics.vectorNormalize(toIdeal);
        this.queueMovement(moveDir, params.speed, params.reactionTime);
        return;
      }
      
      // Se está na posição ideal e perto da bola, chutar
      const distToBall = Physics.vectorLength(Physics.vectorSub(ballPos, botPos));
      if (params.kickWhenClose && distToBall <= (params.kickDistance || 35)) {
        this.bot.input.kick = true;
      }
      
      return;
    }
    
    // Comportamento padrão: apenas perseguir a bola
    const direction = Physics.vectorSub(ballPos, botPos);
    const distance = Physics.vectorLength(direction);

    const keepDistance = params.keepDistance || 0;
    
    if (distance > keepDistance) {
      const normalized = Physics.vectorNormalize(direction);
      this.queueMovement(normalized, params.speed, params.reactionTime);

      // Verificar se deve chutar (isso é instantâneo, não passa pelo delay)
      if (params.kickWhenClose) {
        const kickDistance = params.kickDistance || 35;
        if (distance <= kickDistance) {
          this.bot.input.kick = true;
        }
      }
    } else {
      this.queueMovement({ x: 0, y: 0 }, 0, params.reactionTime);
    }
  }

  private markPlayer(params: MarkPlayerParams, gameState: GameState): void {
    // Encontrar o jogador alvo
    let targetPlayer: Player | undefined;
    
    if (params.targetPlayerId) {
      targetPlayer = gameState.players.find(p => p.id === params.targetPlayerId);
    } else {
      // Marca o primeiro jogador não-bot do time adversário
      targetPlayer = gameState.players.find(p => 
        p.team !== this.bot.team && !p.isBot
      );
    }

    if (!targetPlayer) {
      this.queueMovement({ x: 0, y: 0 }, 0, params.reactionTime);
      return;
    }

    // Se precisa interceptar linha
    if (params.interceptLine) {
      this.interceptLine(targetPlayer, params, gameState);
      return;
    }

    // NOVA LÓGICA: posicionar entre o jogador e a bola para bloquear
    const ball = gameState.ball;
    
    // Vetor do jogador para a bola
    const playerToBall = Physics.vectorSub(ball.circle.pos, targetPlayer.circle.pos);
    const playerToBallDist = Physics.vectorLength(playerToBall);
    
    if (playerToBallDist === 0) {
      this.queueMovement({ x: 0, y: 0 }, 0, params.reactionTime);
      return;
    }
    
    // Normalizar a direção
    const directionToBall = Physics.vectorNormalize(playerToBall);
    
    // Posição ideal: entre o jogador e a bola, à distância configurada
    const idealPos = {
      x: targetPlayer.circle.pos.x + directionToBall.x * params.distance,
      y: targetPlayer.circle.pos.y + directionToBall.y * params.distance
    };
    
    // Distância do bot até a posição ideal
    const toIdeal = Physics.vectorSub(idealPos, this.bot.circle.pos);
    const distToIdeal = Physics.vectorLength(toIdeal);
    
    // Zona morta grande: se está próximo o suficiente, parar
    const deadZone = 30;
    
    if (distToIdeal <= deadZone) {
      // Parar completamente - limpar fila e aplicar parada imediata
      this.clearMovementQueue();
      this.currentMovement = { direction: { x: 0, y: 0 }, speed: 0 };
      return;
    }
    
    // Mover em direção à posição ideal
    const moveDir = Physics.vectorNormalize(toIdeal);
    
    // Velocidade suave com desaceleração
    let adjustedSpeed = params.speed;
    if (distToIdeal < 80) {
      // Desacelerar progressivamente quando próximo
      adjustedSpeed = params.speed * Math.max(0.3, distToIdeal / 80);
    }
    
    this.queueMovement(moveDir, adjustedSpeed, params.reactionTime);
  }

  private interceptLine(targetPlayer: Player, params: MarkPlayerParams, gameState: GameState): void {
    if (!params.interceptLine) return;

    let targetPosition: Vector2D;

    if (params.interceptLine.target === 'goal') {
      // Encontrar o gol do time do jogador (que o bot deve proteger)
      // Se o jogador é red, bot defende gol red. Se jogador é blue, bot defende gol blue
      targetPosition = targetPlayer.team === 'red' ? { x: 100, y: 300 } : { x: 900, y: 300 };
    } else if (params.interceptLine.target === 'position' && params.interceptLine.targetPosition) {
      targetPosition = params.interceptLine.targetPosition;
    } else if (params.interceptLine.target === 'bot' && params.interceptLine.targetId) {
      const targetBot = gameState.players.find(p => p.id === params.interceptLine!.targetId);
      if (targetBot) {
        targetPosition = targetBot.circle.pos;
      } else {
        this.queueMovement({ x: 0, y: 0 }, 0, 0);
        return;
      }
    } else {
      this.queueMovement({ x: 0, y: 0 }, 0, 0);
      return;
    }

    // Calcular ponto de interceptação na linha entre jogador e alvo
    const toTarget = Physics.vectorSub(targetPosition, targetPlayer.circle.pos);
    const lineLength = Physics.vectorLength(toTarget);
    
    if (lineLength === 0) {
      this.queueMovement({ x: 0, y: 0 }, 0, 0);
      return;
    }

    const directionToTarget = Physics.vectorNormalize(toTarget);
    
    // Posicionar a uma distância do jogador ao longo da linha
    const interceptPoint = {
      x: targetPlayer.circle.pos.x + directionToTarget.x * params.distance,
      y: targetPlayer.circle.pos.y + directionToTarget.y * params.distance
    };

    // Mover para o ponto de interceptação
    const toIntercept = Physics.vectorSub(interceptPoint, this.bot.circle.pos);
    const distToIntercept = Physics.vectorLength(toIntercept);
    
    // Zona morta
    const deadZone = 30;
    
    if (distToIntercept <= deadZone) {
      // Parar completamente
      this.clearMovementQueue();
      this.currentMovement = { direction: { x: 0, y: 0 }, speed: 0 };
      return;
    }

    const moveDir = Physics.vectorNormalize(toIntercept);
    
    // Velocidade com desaceleração
    let adjustedSpeed = params.speed;
    if (distToIntercept < 80) {
      adjustedSpeed = params.speed * Math.max(0.3, distToIntercept / 80);
    }
    
    this.queueMovement(moveDir, adjustedSpeed, params.reactionTime);
  }

  private intercept(params: InterceptParams, gameState: GameState): void {
    const ball = gameState.ball;
    let targetPosition = ball.circle.pos;

    // Se deve prever o caminho da bola
    if (params.predictBallPath) {
      const ballVel = ball.circle.vel;
      const ballSpeed = Physics.vectorLength(ballVel);
      
      if (ballSpeed > 10) {
        // Prever posição da bola em 0.5 segundos
        const predictionTime = 0.5;
        targetPosition = {
          x: ball.circle.pos.x + ballVel.x * predictionTime,
          y: ball.circle.pos.y + ballVel.y * predictionTime
        };
      }
    }

    const direction = Physics.vectorSub(targetPosition, this.bot.circle.pos);
    const distance = Physics.vectorLength(direction);

    if (distance > 5) {
      const normalized = Physics.vectorNormalize(direction);
      this.queueMovement(normalized, params.speed, params.reactionTime);

      // Se deve roubar a bola (instantâneo)
      if (params.stealBall && distance < 50) {
        this.bot.input.kick = true;
      }
    } else {
      this.queueMovement({ x: 0, y: 0 }, 0, params.reactionTime);
    }
  }

  private stayNear(params: StayNearParams, gameState: GameState): void {
    const direction = Physics.vectorSub(params.position, this.bot.circle.pos);
    const distance = Physics.vectorLength(direction);
    
    // Adicionar margem para evitar oscilação na borda do raio
    const effectiveRadius = params.radius + 15;

    if (distance > effectiveRadius) {
      const normalized = Physics.vectorNormalize(direction);
      // Reduzir velocidade conforme se aproxima do centro
      const distanceFromEdge = distance - params.radius;
      const speedRatio = Math.min(1, distanceFromEdge / 50);
      const adjustedSpeed = params.speed * speedRatio;
      this.queueMovement(normalized, adjustedSpeed, params.reactionTime);
    } else {
      this.queueMovement({ x: 0, y: 0 }, 0, params.reactionTime);
    }
    
    // Chutar quando a bola está próxima (instantâneo, não passa pelo delay)
    if (params.kickWhenBallNear) {
      const ball = gameState.ball;
      const ballPos = ball.circle.pos;
      const botPos = this.bot.circle.pos;
      const distToBall = Physics.vectorLength(Physics.vectorSub(ballPos, botPos));
      const kickDistance = params.kickDistance || 35;
      
      if (distToBall <= kickDistance) {
        this.bot.input.kick = true;
      }
    }
  }

  private patrol(params: PatrolParams, gameState: GameState, dt: number): void {
    if (params.points.length === 0) {
      this.stopMovement();
      return;
    }

    const targetPoint = params.points[this.patrolState.currentPointIndex];
    const direction = Physics.vectorSub(targetPoint, this.bot.circle.pos);
    const distance = Physics.vectorLength(direction);
    
    // Zona morta maior para evitar oscilação
    const arrivalThreshold = 20;

    if (distance < arrivalThreshold) {
      // Chegou no ponto - calcular próximo índice
      const nextIndex = this.patrolState.currentPointIndex + 1;
      
      // Se atingiu o último ponto
      if (nextIndex >= params.points.length) {
        // Verificar se deve fazer loop (padrão é true)
        const shouldLoop = params.loop !== false;
        if (!shouldLoop) {
          // Se não faz loop, permanece no último ponto parado
          this.currentMovement = { direction: { x: 0, y: 0 }, speed: 0 };
          this.stopMovement();
          return;
        }
      }
      
      // Calcular qual será o próximo ponto (com wrap around se loop)
      const actualNextIndex = nextIndex >= params.points.length ? 0 : nextIndex;
      const nextPoint = params.points[actualNextIndex];
      
      // Usar delay do PRÓXIMO ponto (destino), não do ponto atual
      const nextPointDelay = nextPoint.delay !== undefined ? nextPoint.delay : (params.waitTime || 0);
      
      if (nextPointDelay > 0 && this.patrolState.waitTimer < nextPointDelay) {
        // Esperar antes de ir para o próximo ponto
        this.patrolState.waitTimer += dt;
        // Parar completamente e limpar movimento atual
        this.currentMovement = { direction: { x: 0, y: 0 }, speed: 0 };
        this.stopMovement();
      } else {
        // Terminou de esperar, avançar para o próximo ponto
        this.patrolState.waitTimer = 0;
        this.patrolState.currentPointIndex = actualNextIndex;
      }
    } else {
      const normalized = Physics.vectorNormalize(direction);
      // Desacelerar conforme se aproxima do ponto
      const speedRatio = Math.min(1, distance / 60);
      const adjustedSpeed = params.speed * speedRatio;
      this.queueMovement(normalized, adjustedSpeed, params.reactionTime);
    }
    
    // Verifica se deve chutar quando a bola encostar
    if (params.kickOnContact) {
      const ball = gameState.ball;
      const botPos = this.bot.circle.pos;
      const ballPos = ball.circle.pos;
      
      const distanceToBall = Physics.vectorLength(Physics.vectorSub(ballPos, botPos));
      const touchDistance = this.bot.circle.radius + ball.circle.radius + 5; // Margem de 5px
      
      if (distanceToBall <= touchDistance) {
        this.bot.input.kick = true;
      }
    }
  }

  /**
   * Adiciona um movimento à fila com delay baseado no reactionTime
   */
  private queueMovement(direction: Vector2D, speed: number, reactionTime?: number): void {
    const now = Date.now();
    const delay = (reactionTime ?? 0) * 1000; // Converter segundos para ms
    
    this.movementQueue.push({
      direction,
      speed,
      processAt: now + delay
    });
    
    // Limitar tamanho da fila para evitar memory leak (manter ~2 segundos de comandos)
    const maxQueueSize = 120; // ~2 segundos a 60fps
    while (this.movementQueue.length > maxQueueSize) {
      this.movementQueue.shift();
    }
  }

  /**
   * Limpa a fila de movimentos - usado para parar imediatamente
   */
  private clearMovementQueue(): void {
    this.movementQueue = [];
  }

  /**
   * Aplica o movimento atual ao bot
   */
  private applyCurrentMovement(): void {
    const { direction, speed } = this.currentMovement;
    const threshold = 0.1;
    
    this.bot.input.left = direction.x < -threshold;
    this.bot.input.right = direction.x > threshold;
    this.bot.input.up = direction.y < -threshold;
    this.bot.input.down = direction.y > threshold;
    
    // Atualizar multiplicador de velocidade máxima do bot
    this.bot.maxSpeedMultiplier = speed;
  }

  private stopMovement(): void {
    this.bot.input.left = false;
    this.bot.input.right = false;
    this.bot.input.up = false;
    this.bot.input.down = false;
    this.bot.input.kick = false;
  }

  reset(): void {
    this.programmedState = { currentMovementIndex: 0, timeInCurrentMovement: 0 };
    this.patrolState = { currentPointIndex: 0, waitTimer: 0 };
    this.movementQueue = [];
    this.currentMovement = { direction: { x: 0, y: 0 }, speed: 0 };
    this.stopMovement();
  }
}
