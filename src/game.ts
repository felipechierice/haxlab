import { GameState, Player, GameMap, Goal, Vector2D, GameConfig, BotBehavior } from './types.js';
import { Physics } from './physics.js';
import { Renderer } from './renderer.js';
import { GameConsole } from './console.js';
import { BotAI } from './botAI.js';
import { audioManager } from './audio.js';
import { keyBindings } from './keybindings.js';
import { extrapolation, ExtrapolatedPositions } from './extrapolation.js';

export class Game {
  private state: GameState;
  private map: GameMap;
  private renderer: Renderer;
  private config: GameConfig;
  private lastTime: number = 0;
  private animationId: number = 0;
  private keyState: { [key: string]: boolean } = {};
  private controlledPlayerId: string = 'local-0';
  private console: GameConsole;
  private lastBallToucher: { id: string, name: string, team: 'red' | 'blue', isBot: boolean } | null = null;
  private goalJustScored: boolean = false;
  private isPaused: boolean = false;
  private customRenderCallback: ((ctx: CanvasRenderingContext2D) => void) | null = null;
  private customUpdateCallback: (() => void) | null = null;
  private customKickCallback: (() => void) | null = null;
  private bots: Map<string, BotAI> = new Map();
  private ballTouches: Map<string, number> = new Map(); // Rastreia toques na bola por bot/jogador
  private customBallTouchCallback: ((playerId: string) => void) | null = null;
  private customGoalCallback: ((team: 'red' | 'blue', scoredBy?: { id: string, name: string, team: 'red' | 'blue', isBot: boolean }) => void) | null = null;
  private lastBounceTime: number = 0;
  private lastBallHitTime: number = 0;
  
  // Event handlers (guardados para poder remover depois)
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  
  // Cache de elementos DOM para evitar lookups repetidos
  private uiElements: {
    redScore: HTMLElement | null;
    blueScore: HTMLElement | null;
    gameTime: HTMLElement | null;
  } | null = null;
  
  // Objeto de input reutilizável para evitar criação de objetos a cada frame
  private readonly cachedInput = { up: false, down: false, left: false, right: false, kick: false };
  
  // Cache de estado anterior para evitar atualizações DOM desnecessárias
  private lastUIState = { redScore: -1, blueScore: -1, time: -1 };
  
  // Tempo acumulado da simulação em segundos (usado pela BotAI para timing)
  private simulationTime: number = 0;

  constructor(canvas: HTMLCanvasElement, map: GameMap, config: GameConfig) {
    this.renderer = new Renderer(canvas);
    this.map = map;
    this.config = config;
    this.console = new GameConsole();
    
    this.state = {
      players: [],
      ball: {
        circle: Physics.createCircle(
          map.spawnPoints.ball.x,
          map.spawnPoints.ball.y,
          config.ballConfig.radius,
          config.ballConfig.mass,
          config.ballConfig.damping
        )
      },
      score: { red: 0, blue: 0 },
      time: 0,
      running: false,
      finished: false,
      winner: null
    };

    // Inicializa extrapolation se configurado
    if (config.extrapolation !== undefined) {
      extrapolation.setExtrapolation(config.extrapolation);
    }

    this.setupControls();
    this.setupConsole();
  }

  addPlayer(id: string, name: string, team: 'red' | 'blue'): void {
    const spawnPoints = team === 'red' ? this.map.spawnPoints.red : this.map.spawnPoints.blue;
    const spawnIndex = this.state.players.filter(p => p.team === team).length % spawnPoints.length;
    const spawn = spawnPoints[spawnIndex];

    const player: Player = {
      id,
      name,
      team,
      circle: Physics.createCircle(spawn.x, spawn.y, this.config.playerRadius, 10),
      input: { up: false, down: false, left: false, right: false, kick: false },
      kickCharge: 0,
      isChargingKick: false,
      hasKickedThisPress: false,
      kickFeedbackTime: 0
    };

    this.state.players.push(player);
    this.ballTouches.set(id, 0);
  }

  addBot(id: string, name: string, team: 'red' | 'blue', spawn: Vector2D, behavior: BotBehavior, initialVelocity?: Vector2D, radius?: number): void {
    const botRadius = radius ?? this.config.playerRadius;
    const bot: Player = {
      id,
      name,
      team,
      circle: Physics.createCircle(spawn.x, spawn.y, botRadius, 10),
      input: { up: false, down: false, left: false, right: false, kick: false },
      kickCharge: 0,
      isChargingKick: false,
      hasKickedThisPress: false,
      kickFeedbackTime: 0,
      isBot: true,
      botBehavior: behavior
    };

    if (initialVelocity) {
      bot.circle.vel.x = initialVelocity.x;
      bot.circle.vel.y = initialVelocity.y;
    }

    this.state.players.push(bot);
    this.ballTouches.set(id, 0);
    
    // Criar IA para o bot
    const botAI = new BotAI(bot, behavior);
    this.bots.set(id, botAI);
  }

  removeAllBots(): void {
    // Remove todos os bots do jogo
    this.state.players = this.state.players.filter(p => !p.isBot);
    this.bots.clear();
  }
  
  setControlledPlayer(playerId: string): void {
    this.controlledPlayerId = playerId;
  }

  initPlayers(): void {
    // Single player - apenas 1 jogador no time red
    // A implementação genérica de addPlayer permite adicionar bots futuramente
    this.addPlayer('local-0', 'Player', 'red');
  }

  private setupControls(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      // Ignora controles do jogo se está digitando no console ou em um campo de texto
      if (this.console.isTyping()) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      
      // Evita key repeat
      if (e.repeat) return;
      
      this.keyState[e.key] = true;
      
      // Chute
      if (keyBindings.isKeyBound(e.key, 'kick')) {
        e.preventDefault();
        this.handleKickInput();
      }
      
      // Trocar jogador
      if (keyBindings.isKeyBound(e.key, 'switchPlayer')) {
        e.preventDefault();
        this.switchPlayer();
      }
    };

    this.keyupHandler = (e: KeyboardEvent) => {
      // Ignora controles do jogo se está digitando no console ou em um campo de texto
      if (this.console.isTyping()) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      
      this.keyState[e.key] = false;
      
      // Soltar tecla de chute em qualquer modo
      if (keyBindings.isKeyBound(e.key, 'kick')) {
        this.handleKickRelease();
      }
    };

    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
  }
  
  private removeControls(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.keyupHandler) {
      window.removeEventListener('keyup', this.keyupHandler);
      this.keyupHandler = null;
    }
  }
  
  private setupConsole(): void {
    this.console.onChatMessage((message) => {
      // Single player - apenas adiciona localmente
      const playerName = this.getPlayerName(this.controlledPlayerId);
      this.console.addChatMessage(playerName, message);
    });
  }
  
  private getPlayerName(playerId: string): string {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) return player.name;
    return 'Player';
  }
  
  // Processa kick imediatamente
  private handleKickInput(): void {
    if (!this.state.running || this.state.finished) return;
    
    const player = this.state.players.find(p => p.id === this.controlledPlayerId);
    if (!player) return;
    
    // Modo carregável: inicia o carregamento
    if (this.config.kickMode === 'chargeable') {
      player.isChargingKick = true;
      player.kickCharge = 0;
      player.hasKickedThisPress = false;
      return;
    }
    
    // Modo clássico: kick imediato e mostra indicador enquanto tecla pressionada
    player.isChargingKick = true;
    player.kickCharge = 1;
    player.hasKickedThisPress = false;
    this.tryKick(player); // tryKick vai marcar hasKickedThisPress se chutar
    
    // Notificar callback customizado
    if (this.customKickCallback) {
      this.customKickCallback();
    }
  }

  private handleKickRelease(): void {
    if (!this.state.running || this.state.finished) return;
    
    const player = this.state.players.find(p => p.id === this.controlledPlayerId);
    if (!player) return;
    
    // Modo carregável: executa kick com força carregada
    if (this.config.kickMode === 'chargeable' && player.isChargingKick) {
      const chargeAmount = player.kickCharge;
      this.tryKick(player, chargeAmount);
      
      // Notificar callback customizado
      if (this.customKickCallback) {
        this.customKickCallback();
      }
    }
    
    // Desativa indicador em ambos os modos
    player.isChargingKick = false;
    player.kickCharge = 0;
    player.hasKickedThisPress = false;
  }

  private switchPlayer(): void {
    const redPlayers = this.state.players.filter(p => p.team === 'red');
    if (redPlayers.length === 0) return;
    
    const currentIndex = redPlayers.findIndex(p => p.id === this.controlledPlayerId);
    const nextIndex = (currentIndex + 1) % redPlayers.length;
    this.controlledPlayerId = redPlayers[nextIndex].id;
  }

  private updatePlayerInput(player: Player): void {
    if (player.id === this.controlledPlayerId) {
      // Reutiliza objeto cacheado para evitar alocações
      const input = this.cachedInput;
      const binds = keyBindings.getBindings();
      
      input.up = binds.up.some(key => this.keyState[key]);
      input.down = binds.down.some(key => this.keyState[key]);
      input.left = binds.left.some(key => this.keyState[key]);
      input.right = binds.right.some(key => this.keyState[key]);
      input.kick = false; // Kick é processado no keydown
      
      // Copia valores para o player
      player.input.up = input.up;
      player.input.down = input.down;
      player.input.left = input.left;
      player.input.right = input.right;
    }
  }

  private updatePlayer(player: Player, dt: number): void {
    this.updatePlayerInput(player);

    // Para bots: resetar hasKickedThisPress quando não está tentando chutar
    // Isso permite que o bot chute novamente quando a bola se aproximar de novo
    if (player.isBot && !player.input.kick) {
      player.hasKickedThisPress = false;
    }

    // Atualiza carregamento do chute no modo carregável
    if (this.config.kickMode === 'chargeable' && player.isChargingKick) {
      player.kickCharge = Math.min(1, player.kickCharge + dt); // 1 segundo para carregar totalmente
    }
    
    // Atualiza tempo de feedback visual do chute
    if (player.kickFeedbackTime > 0) {
      player.kickFeedbackTime = Math.max(0, player.kickFeedbackTime - dt);
    }

    const accel = this.config.playerAcceleration ?? Physics.PLAYER_ACCELERATION;
    const baseSpeedMultiplier = player.maxSpeedMultiplier ?? 1;
    const baseMaxSpeed = (this.config.playerSpeed ?? Physics.PLAYER_MAX_SPEED) * baseSpeedMultiplier;
    
    // Calcula velocidade máxima reduzida quando está segurando chute
    const kickSpeedMult = this.config.kickSpeedMultiplier ?? 1.0;
    const reducedMaxSpeed = baseMaxSpeed * kickSpeedMult;
    
    // Usa a velocidade máxima reduzida se estiver carregando chute
    const maxSpeed = player.isChargingKick ? reducedMaxSpeed : baseMaxSpeed;

    // Calcula direção do movimento e normaliza para movimento diagonal consistente
    let accelX = 0;
    let accelY = 0;
    if (player.input.up) accelY -= 1;
    if (player.input.down) accelY += 1;
    if (player.input.left) accelX -= 1;
    if (player.input.right) accelX += 1;
    
    // Normaliza o vetor de aceleração se houver movimento diagonal
    // Multiplica por dt * 60 para ser frame-rate independente (normalizado a 60fps)
    if (accelX !== 0 || accelY !== 0) {
      const accelLength = Math.sqrt(accelX * accelX + accelY * accelY);
      const dtScale = dt * 60;
      accelX = (accelX / accelLength) * accel * dtScale;
      accelY = (accelY / accelLength) * accel * dtScale;
      player.circle.vel.x += accelX;
      player.circle.vel.y += accelY;
    }

    const speed = Physics.vectorLength(player.circle.vel);
    if (speed > maxSpeed) {
      const normalized = Physics.vectorNormalize(player.circle.vel);
      player.circle.vel.x = normalized.x * maxSpeed;
      player.circle.vel.y = normalized.y * maxSpeed;
    }

    if (player.input.kick) {
      this.tryKick(player, player.kickCharge);
      player.input.kick = false;
      player.kickCharge = 0;
      player.isChargingKick = false;
      player.hasKickedThisPress = false; // Resetar para permitir próximo chute
    }

    Physics.updateCircle(player.circle, dt);
  }

  // Simula física do jogador local
  private simulateLocalPlayer(player: Player, dt: number): void {
    const accel = this.config.playerAcceleration ?? Physics.PLAYER_ACCELERATION;
    const maxSpeed = this.config.playerSpeed ?? Physics.PLAYER_MAX_SPEED;

    // Calcula direção do movimento e normaliza para movimento diagonal consistente
    let accelX = 0;
    let accelY = 0;
    if (player.input.up) accelY -= 1;
    if (player.input.down) accelY += 1;
    if (player.input.left) accelX -= 1;
    if (player.input.right) accelX += 1;
    
    // Normaliza o vetor de aceleração se houver movimento diagonal
    // Multiplica por dt * 60 para ser frame-rate independente (normalizado a 60fps)
    if (accelX !== 0 || accelY !== 0) {
      const accelLength = Math.sqrt(accelX * accelX + accelY * accelY);
      const dtScale = dt * 60;
      accelX = (accelX / accelLength) * accel * dtScale;
      accelY = (accelY / accelLength) * accel * dtScale;
      player.circle.vel.x += accelX;
      player.circle.vel.y += accelY;
    }

    // Limita velocidade máxima
    const speed = Physics.vectorLength(player.circle.vel);
    if (speed > maxSpeed) {
      const normalized = Physics.vectorNormalize(player.circle.vel);
      player.circle.vel.x = normalized.x * maxSpeed;
      player.circle.vel.y = normalized.y * maxSpeed;
    }

    // Atualiza posição
    Physics.updateCircle(player.circle, dt);
    
    // Colisão com paredes (para não atravessar paredes localmente)
    for (const segment of this.map.segments) {
      if (segment.playerCollision) {
        if (Physics.checkSegmentCollision(player.circle, segment)) {
          Physics.resolveSegmentCollision(player.circle, segment);
        }
      }
    }
    
    // Colisão local com a bola (para feedback visual imediato)
    // Resolve a separação dos círculos
    const ball = this.state.ball.circle;
    if (Physics.checkCircleCollision(player.circle, ball)) {
      // Resolve colisão localmente para evitar sobreposição visual
      Physics.resolveCircleCollision(player.circle, ball);
    }
    
    // Colisão local com outros jogadores (para feedback visual imediato)
    for (const otherPlayer of this.state.players) {
      if (otherPlayer.id === player.id) continue;
      if (Physics.checkCircleCollision(player.circle, otherPlayer.circle)) {
        Physics.resolveCircleCollision(player.circle, otherPlayer.circle);
      }
    }
  }

  /**
   * Simula física local da bola no client para feedback visual imediato
   * Isso faz com que empurrar a bola pareça suave e responsivo
   */
  private simulateLocalBallPhysics(localPlayer: Player, dt: number): void {
    const ball = this.state.ball.circle;
    
    // Verifica colisão entre jogador local e bola
    if (Physics.checkCircleCollision(localPlayer.circle, ball)) {
      // Resolve colisão com a bola
      // Calcula separação e aplica apenas parcialmente à bola
      const dx = ball.pos.x - localPlayer.circle.pos.x;
      const dy = ball.pos.y - localPlayer.circle.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = localPlayer.circle.radius + ball.radius;
      
      if (dist > 0 && dist < minDist) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        
        // Move a bola para fora do jogador (feedback visual imediato)
        ball.pos.x += nx * overlap * 0.5;
        ball.pos.y += ny * overlap * 0.5;
        
        // Transfere velocidade do jogador para a bola suavemente
        // Isso cria o efeito de "empurrar" a bola
        const playerSpeed = Math.sqrt(
          localPlayer.circle.vel.x * localPlayer.circle.vel.x +
          localPlayer.circle.vel.y * localPlayer.circle.vel.y
        );
        
        if (playerSpeed > 0.1) {
          // Calcula componente de velocidade na direção da bola
          const dotProduct = (localPlayer.circle.vel.x * nx + localPlayer.circle.vel.y * ny);
          
          if (dotProduct > 0) {
            // Transfere parte da velocidade para a bola
            const transferFactor = 0.3; // Transferência parcial de momento
            ball.vel.x += nx * dotProduct * transferFactor;
            ball.vel.y += ny * dotProduct * transferFactor;
          }
        }
      }
    }
    
    // Atualiza posição da bola baseada em sua velocidade (predição)
    // Aplica damping normalizado para 60fps (frame-rate independente)
    const dampingFactor = Math.pow(ball.damping, dt * 60);
    ball.vel.x *= dampingFactor;
    ball.vel.y *= dampingFactor;
    
    // Move a bola (pequeno dt para não acumular erro)
    ball.pos.x += ball.vel.x * dt * 0.5;
    ball.pos.y += ball.vel.y * dt * 0.5;
    
    // Colisão com paredes
    for (const segment of this.map.segments) {
      if (Physics.checkSegmentCollision(ball, segment)) {
        Physics.resolveSegmentCollision(ball, segment);
      }
    }
  }

  private tryKick(player: Player, chargeAmount: number = 1): void {
    // Se já chutou neste pressionamento, não chuta de novo
    if (player.hasKickedThisPress) return;
    
    const ball = this.state.ball.circle;
    const dx = ball.pos.x - player.circle.pos.x;
    const dy = ball.pos.y - player.circle.pos.y;
    const distSq = dx * dx + dy * dy;
    
    // Kick radius considera o raio do jogador + uma margem fixa
    const kickRadius = player.circle.radius + Physics.KICK_MARGIN; // raio do jogador + margem para chute
    const kickRadiusSq = kickRadius * kickRadius;

    if (distSq < kickRadiusSq) {
      const dist = Math.sqrt(distSq);
      if (dist > 0) {
        const invDist = 1 / dist;
        // Aplica a força baseada no carregamento (mínimo 20% se carregável, 100% se clássico)
        const kickStrength = this.config.kickMode === 'chargeable' 
          ? this.config.kickStrength * Math.max(0.2, chargeAmount)
          : this.config.kickStrength;
        
        ball.vel.x += dx * invDist * kickStrength;
        ball.vel.y += dy * invDist * kickStrength;
        
        // Marca que já chutou neste pressionamento
        player.hasKickedThisPress = true;
        
        // Ativa feedback visual por 0.1 segundos
        player.kickFeedbackTime = 0.1;
        
        // Som de chute
        audioManager.play('kick');
        
        // Rastreia quem tocou na bola por último (chute conta como toque)
        if (player.team !== 'spectator') {
          this.lastBallToucher = { 
            id: player.id, 
            name: player.name, 
            team: player.team as 'red' | 'blue',
            isBot: player.isBot || false
          };
        }
        
        // Notificar callback customizado (para prevent_touch também detectar chutes)
        if (this.customBallTouchCallback && player.team !== 'spectator') {
          this.customBallTouchCallback(player.id);
        }
      }
    }
  }

  // Aplica chute na bola
  private tryKickLocal(player: Player, chargeAmount: number = 1): void {
    const ball = this.state.ball.circle;
    const dx = ball.pos.x - player.circle.pos.x;
    const dy = ball.pos.y - player.circle.pos.y;
    const distSq = dx * dx + dy * dy;
    
    // Kick radius considera o raio do jogador + uma margem fixa
    const kickRadius = player.circle.radius + Physics.KICK_MARGIN;
    const kickRadiusSq = kickRadius * kickRadius;

    if (distSq < kickRadiusSq) {
      const dist = Math.sqrt(distSq);
      if (dist > 0) {
        const invDist = 1 / dist;
        // Aplica força do chute
        // Usamos força parcial para dar feedback visual sem exagerar
        const kickStrength = this.config.kickMode === 'chargeable' 
          ? this.config.kickStrength * Math.max(0.2, chargeAmount) * 0.7
          : this.config.kickStrength * 0.7;
        
        ball.vel.x += dx * invDist * kickStrength;
        ball.vel.y += dy * invDist * kickStrength;
      }
    }
  }

  private checkGoal(): 'red' | 'blue' | null {
    const ball = this.state.ball.circle;
    
    for (const goal of this.map.goals) {
      const minX = Math.min(goal.p1.x, goal.p2.x);
      const maxX = Math.max(goal.p1.x, goal.p2.x);
      const minY = Math.min(goal.p1.y, goal.p2.y);
      const maxY = Math.max(goal.p1.y, goal.p2.y);

      const margin = 5;
      
      if (ball.pos.x >= minX - margin && ball.pos.x <= maxX + margin &&
          ball.pos.y >= minY && ball.pos.y <= maxY) {
        return goal.team;
      }
    }
    
    return null;
  }

  private resetPositions(): void {
    this.state.ball.circle.pos.x = this.map.spawnPoints.ball.x;
    this.state.ball.circle.pos.y = this.map.spawnPoints.ball.y;
    this.state.ball.circle.vel.x = 0;
    this.state.ball.circle.vel.y = 0;
    
    // Limpa rastro da bola
    this.renderer.clearBallTrail();

    for (const player of this.state.players) {
      const spawnPoints = player.team === 'red' ? this.map.spawnPoints.red : this.map.spawnPoints.blue;
      const spawnIndex = this.state.players.filter(p => p.team === player.team).indexOf(player);
      const spawn = spawnPoints[spawnIndex % spawnPoints.length];
      
      player.circle.pos.x = spawn.x;
      player.circle.pos.y = spawn.y;
      player.circle.vel.x = 0;
      player.circle.vel.y = 0;
    }
  }

  private update(dt: number): void {
    if (!this.state.running || this.state.finished) return;

    // Single player: processa toda a física
    this.state.time += dt;
    
    if (this.config.timeLimit > 0 && this.state.time >= this.config.timeLimit) {
      this.endGame();
      return;
    }

    // Atualizar IAs dos bots (passa tempo de simulação para determinismo)
    for (const [botId, botAI] of this.bots.entries()) {
      botAI.update(this.state, dt, this.simulationTime);
    }

    for (const player of this.state.players) {
      this.updatePlayer(player, dt);
    }

    // Atualiza bola com sub-stepping para evitar tunneling através das paredes
    const hitSpeed = Physics.updateCircleWithSubsteps(this.state.ball.circle, dt, this.map.segments);
    
    // Som de quique na parede (intensidade varia com a velocidade do impacto)
    if (hitSpeed > 30) {
      const now = this.simulationTime;
      if (now - this.lastBounceTime > 0.08) {
        // Intensidade: 0.3 em speed=30, 1.0 em speed=200+
        const intensity = Math.min(1.5, 0.3 + (hitSpeed - 30) / 250);
        audioManager.play('bounce', intensity);
        this.lastBounceTime = now;
      }
    }

    for (let i = 0; i < this.state.players.length; i++) {
      for (let j = i + 1; j < this.state.players.length; j++) {
        if (Physics.checkCircleCollision(this.state.players[i].circle, this.state.players[j].circle)) {
          Physics.resolveCircleCollision(this.state.players[i].circle, this.state.players[j].circle);
        }
      }
    }

    for (const player of this.state.players) {
      if (Physics.checkCircleCollision(player.circle, this.state.ball.circle)) {
        // Calcular velocidade relativa do impacto ANTES de resolver a colisão
        const ball = this.state.ball.circle;
        const dx = ball.pos.x - player.circle.pos.x;
        const dy = ball.pos.y - player.circle.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          const relVelX = ball.vel.x - player.circle.vel.x;
          const relVelY = ball.vel.y - player.circle.vel.y;
          const impactSpeed = Math.abs(relVelX * nx + relVelY * ny);
          
          // Som de impacto (threshold para ignorar arrasto/condução)
          const now = this.simulationTime;
          if (impactSpeed > 60 && now - this.lastBallHitTime > 0.1) {
            // Intensidade: 0.3 em impact=60, 1.0 em impact=200+
            const intensity = Math.min(1.5, 0.3 + (impactSpeed - 60) / 200);
            audioManager.play('ballHit', intensity);
            this.lastBallHitTime = now;
          }
        }
        
        Physics.resolveCircleCollision(player.circle, this.state.ball.circle);
        
        // Se o player está segurando a tecla de chute, executa o chute automaticamente
        if (player.isChargingKick && player.id === this.controlledPlayerId) {
          const chargeAmount = this.config.kickMode === 'chargeable' ? player.kickCharge : 1;
          this.tryKick(player, chargeAmount);
          
          // Desativa o indicador e o estado de carregamento
          player.isChargingKick = false;
          player.kickCharge = 0;
          
          // Notificar callback customizado
          if (this.customKickCallback) {
            this.customKickCallback();
          }
        }
        
        // Rastreia quem tocou na bola por último  
        if (player.team !== 'spectator') {
          this.lastBallToucher = { 
            id: player.id, 
            name: player.name, 
            team: player.team as 'red' | 'blue',
            isBot: player.isBot || false
          };
          
          // Incrementar contador de toques
          const currentTouches = this.ballTouches.get(player.id) || 0;
          this.ballTouches.set(player.id, currentTouches + 1);
          
          // Notificar callback customizado
          if (this.customBallTouchCallback) {
            this.customBallTouchCallback(player.id);
          }
        }
      }
    }

    for (const segment of this.map.segments) {
      if (segment.playerCollision) {
        for (const player of this.state.players) {
          if (Physics.checkSegmentCollision(player.circle, segment)) {
            Physics.resolveSegmentCollision(player.circle, segment);
          }
        }
      }
      // Colisão da bola com paredes agora é tratada em updateCircleWithSubsteps
    }

    // Callback customizado de atualização
    if (this.customUpdateCallback) {
      this.customUpdateCallback();
    }

    const goalScored = this.checkGoal();
    if (goalScored && !this.goalJustScored) {
      this.goalJustScored = true;
      
      // Som de gol
      audioManager.play('goal');
      
      // Log do gol
      if (this.lastBallToucher) {
        this.console.logGoal(this.lastBallToucher.name, this.lastBallToucher.team);
      }
      
      if (goalScored === 'red') {
        this.state.score.blue++;
      } else {
        this.state.score.red++;
      }
      
      // Notificar callastBallToucher.isBot
      if (this.customGoalCallback) {
        const scoredByInfo = this.lastBallToucher ? {
          id: this.lastBallToucher.id,
          name: this.lastBallToucher.name,
          team: this.lastBallToucher.team,
          isBot: this.state.players.find(p => p.id === this.lastBallToucher!.id)?.isBot || false
        } : undefined;
        this.customGoalCallback(goalScored, scoredByInfo);
      }
      
      this.updateUI();
      
      // Aguarda 1 segundo antes de reposicionar ou finalizar
      setTimeout(() => {
        if (this.config.scoreLimit > 0 && 
            (this.state.score.red >= this.config.scoreLimit || 
             this.state.score.blue >= this.config.scoreLimit)) {
          this.endGame();
        } else if (!this.config.disableGoalReset) {
          // Só reseta posições se não estiver desabilitado
          this.resetPositions();
        }
        this.goalJustScored = false;
      }, 1000);
    }
  }

  private endGame(): void {
    this.state.finished = true;
    this.state.running = false;
    
    if (this.state.score.red > this.state.score.blue) {
      this.state.winner = 'red';
    } else if (this.state.score.blue > this.state.score.red) {
      this.state.winner = 'blue';
    } else {
      this.state.winner = 'draw';
    }
    
    // Log do fim do jogo
    this.console.logGameEnd(this.state.winner);
    
    // Só mostrar game over se não estiver desabilitado
    if (!this.config.disableGameOver) {
      this.showGameOver();
    }
  }

  private showGameOver(): void {
    window.dispatchEvent(new CustomEvent('game-over', {
      detail: {
        winner: this.state.winner,
        score: { ...this.state.score }
      }
    }));
  }

  private showMenu(): void {
    this.stop();
    window.dispatchEvent(new CustomEvent('game-back-to-menu'));
  }

  private updateUI(): void {
    // Lazy init de cache de elementos DOM
    if (!this.uiElements) {
      this.uiElements = {
        redScore: document.getElementById('red-score'),
        blueScore: document.getElementById('blue-score'),
        gameTime: document.getElementById('game-time')
      };
    }
    
    const { redScore, blueScore, gameTime } = this.uiElements;
    const currentRed = this.state.score.red;
    const currentBlue = this.state.score.blue;
    const currentTime = Math.floor(this.state.time);
    
    // Só atualiza DOM se valor mudou
    if (redScore && currentRed !== this.lastUIState.redScore) {
      redScore.textContent = currentRed.toString();
      this.lastUIState.redScore = currentRed;
    }
    
    if (blueScore && currentBlue !== this.lastUIState.blueScore) {
      blueScore.textContent = currentBlue.toString();
      this.lastUIState.blueScore = currentBlue;
    }
    
    if (gameTime && currentTime !== this.lastUIState.time) {
      const minutes = Math.floor(currentTime / 60);
      const seconds = currentTime % 60;
      gameTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      this.lastUIState.time = currentTime;
    }
  }

  start(): void {
    this.state.running = true;
    this.isPaused = false;
    this.lastTime = 0;
    this.simulationTime = 0;
    
    // Pré-inicializa AudioContext para evitar stutter no primeiro som
    audioManager.warmUp();
    
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  stop(): void {
    this.state.running = false;
    this.isPaused = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
    // Remover event listeners de teclado
    this.removeControls();
  }
  
  pause(): void {
    this.isPaused = true;
    this.state.running = false;
  }
  
  resume(): void {
    this.isPaused = false;
    this.state.running = true;
    this.lastTime = 0;
    
    this.animationId = requestAnimationFrame(this.gameLoop);
  }

  reset(): void {
    this.state.score = { red: 0, blue: 0 };
    this.state.time = 0;
    this.state.finished = false;
    this.state.winner = null;
    this.resetPositions();
    this.updateUI();
  }

  // ── FPS tracking ──
  private fpsFrameTimes: number[] = [];
  private fpsDisplay: number = 0;
  private fpsLastUpdate: number = 0;
  private frameTimeDisplay: number = 0;

  private gameLoop = (timestamp: number): void => {
    // Calcular dt diretamente do frame — sem acumulador, sem interpolação
    let dt = this.lastTime ? (timestamp - this.lastTime) / 1000 : 1 / 60;
    this.lastTime = timestamp;

    // Clamp dt para evitar saltos (tab inativa, lag spike)
    if (dt > 0.05) dt = 0.05;
    if (dt <= 0) dt = 1 / 60;

    // Atualizar física e lógica com o dt real do frame
    this.update(dt);
    this.simulationTime += dt;

    // Calcular posições extrapoladas se habilitado
    let extrapolatedPositions = undefined;
    if (extrapolation.isEnabled()) {
      // Captura o input atual do jogador
      const binds = keyBindings.getBindings();
      const currentInput = {
        up: binds.up.some(key => this.keyState[key]),
        down: binds.down.some(key => this.keyState[key]),
        left: binds.left.some(key => this.keyState[key]),
        right: binds.right.some(key => this.keyState[key])
      };
      
      extrapolatedPositions = extrapolation.extrapolate(
        this.state,
        this.map.segments,
        this.controlledPlayerId,
        currentInput,
        this.config
      );
    }

    // Renderizar (com posições extrapoladas se habilitadas)
    this.renderer.drawState(
      this.state, 
      this.map, 
      this.controlledPlayerId, 
      this.state.time, 
      this.config.ballConfig,
      extrapolatedPositions
    );
    
    // FPS tracking e display
    this.updateAndDrawFPS(timestamp);
    
    // Executar callback customizado de renderização
    if (this.customRenderCallback) {
      const ctx = this.renderer.getContext();
      if (ctx) {
        this.customRenderCallback(ctx);
      }
    }
    
    this.updateUI();

    if (this.state.running) {
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
  };
  
  // ── FPS Display ──
  
  private updateAndDrawFPS(timestamp: number): void {
    // Rastreia tempos de frame para cálculo de FPS
    this.fpsFrameTimes.push(timestamp);
    
    // Mantém apenas os últimos 500ms de amostras
    const cutoff = timestamp - 500;
    while (this.fpsFrameTimes.length > 0 && this.fpsFrameTimes[0] < cutoff) {
      this.fpsFrameTimes.shift();
    }
    
    // Atualiza o valor exibido a cada 250ms para não piscar demais
    if (timestamp - this.fpsLastUpdate > 250) {
      if (this.fpsFrameTimes.length > 1) {
        const elapsed = this.fpsFrameTimes[this.fpsFrameTimes.length - 1] - this.fpsFrameTimes[0];
        this.fpsDisplay = Math.round((this.fpsFrameTimes.length - 1) / (elapsed / 1000));
        this.frameTimeDisplay = Math.round(elapsed / (this.fpsFrameTimes.length - 1) * 10) / 10;
      }
      this.fpsLastUpdate = timestamp;
    }
    
    // Desenha FPS + frametime no canto superior esquerdo
    const ctx = this.renderer.getContext();
    if (ctx && this.fpsDisplay > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${this.fpsDisplay} FPS  ${this.frameTimeDisplay}ms`, 8, 8);
      ctx.restore();
    }
  }

  // Métodos públicos para acesso aos dados do jogo
  getPlayers(): Player[] {
    return this.state.players;
  }
  
  getBall() {
    return this.state.ball;
  }
  
  getState(): GameState {
    return this.state;
  }
  
  setCustomRenderCallback(callback: ((ctx: CanvasRenderingContext2D) => void) | null): void {
    this.customRenderCallback = callback;
  }
  
  setCustomUpdateCallback(callback: (() => void) | null): void {
    this.customUpdateCallback = callback;
  }
  
  setCustomKickCallback(callback: (() => void) | null): void {
    this.customKickCallback = callback;
  }

  setCustomBallTouchCallback(callback: ((playerId: string) => void) | null): void {
    this.customBallTouchCallback = callback;
  }

  setCustomGoalCallback(callback: ((team: 'red' | 'blue', scoredBy?: { id: string, name: string, team: 'red' | 'blue', isBot: boolean }) => void) | null): void {
    this.customGoalCallback = callback;
  }

  getBallTouches(playerId: string): number {
    return this.ballTouches.get(playerId) || 0;
  }

  resetBallTouches(): void {
    this.ballTouches.clear();
    for (const player of this.state.players) {
      this.ballTouches.set(player.id, 0);
    }
  }

  // ── Extrapolation Controls ──
  
  /**
   * Define o tempo de extrapolation em milissegundos
   * @param ms Tempo de extrapolation (0-200, 0 = desligado)
   */
  setExtrapolation(ms: number): void {
    extrapolation.setExtrapolation(ms);
  }

  /**
   * Obtém o tempo de extrapolation atual
   */
  getExtrapolation(): number {
    return extrapolation.getExtrapolation();
  }

  /**
   * Verifica se extrapolation está habilitado
   */
  isExtrapolationEnabled(): boolean {
    return extrapolation.isEnabled();
  }
}
