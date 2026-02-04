import { GameState, Player, GameMap, Goal, Vector2D, GameConfig, RoomPlayer } from './types.js';
import { Physics } from './physics.js';
import { Renderer } from './renderer.js';
import { NetworkManager } from './network.js';
import { GameConsole } from './console.js';

export class Game {
  private state: GameState;
  private map: GameMap;
  private renderer: Renderer;
  private config: GameConfig;
  private lastTime: number = 0;
  private animationId: number = 0;
  private keyState: { [key: string]: boolean } = {};
  private controlledPlayerId: string = 'local-0';
  private localPlayerName: string = 'Player'; // Nome local do jogador
  private networkManager: NetworkManager | null = null;
  private isMultiplayer: boolean = false;
  private isHost: boolean = false;
  private lastInputSent: string = '';
  private wasKickPressed: boolean = false;
  private inputSendCounter: number = 0;
  private console: GameConsole;
  private lastBallToucher: { id: string, name: string, team: 'red' | 'blue' } | null = null;
  private goalJustScored: boolean = false; // Flag para impedir múltiplos gols
  
  // Room menu state
  private roomMenuVisible: boolean = false;
  private roomPlayers: RoomPlayer[] = [];
  private roomMenuElement: HTMLElement | null = null;
  private gameStarted: boolean = false;
  
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
  
  // Interpolação para client: estado alvo recebido do host
  private targetState: {
    players: Map<string, { x: number, y: number, vx: number, vy: number }>;
    ball: { x: number, y: number, vx: number, vy: number };
  } | null = null;
  
  // Buffer de estados para Entity Interpolation (mostra outros jogadores "no passado")
  private stateBuffer: Array<{
    timestamp: number;
    players: Map<string, { x: number, y: number, vx: number, vy: number }>;
    ball: { x: number, y: number, vx: number, vy: number };
  }> = [];
  private readonly STATE_BUFFER_SIZE = 3; // Mantém últimos 3 estados
  private readonly INTERPOLATION_DELAY_MS = 100; // Renderiza 100ms no passado
  private lastServerTimestamp: number = 0;
  
  // Constantes de interpolação/reconciliação
  private readonly INTERPOLATION_SPEED = 0.2; // Fator de interpolação para outros jogadores
  private readonly BALL_INTERPOLATION_SPEED = 0.25; // Fator de interpolação para a bola
  
  // Client-Side Prediction: permite que o peer tenha resposta imediata
  private readonly CLIENT_PREDICTION_ENABLED = true;
  private readonly RECONCILIATION_THRESHOLD = 100; // Distância máxima antes de snap (pixels)
  private readonly RECONCILIATION_SPEED = 0.08; // Velocidade de correção
  private newStateReceived: boolean = false; // Flag para saber quando reconciliar
  
  // Física local da bola para o peer (predição de colisão)
  private localBallPhysicsEnabled: boolean = true;

  constructor(canvas: HTMLCanvasElement, map: GameMap, config: GameConfig, networkManager?: NetworkManager) {
    this.renderer = new Renderer(canvas);
    this.map = map;
    this.config = config;
    this.networkManager = networkManager || null;
    this.isMultiplayer = !!networkManager;
    this.isHost = networkManager?.getIsHost() || false;
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

    this.setupControls();
    this.setupConsole();
  }

  addPlayer(id: string, name: string, team: 'red' | 'blue' | 'spectator'): void {
    // Adiciona ao roomPlayers para tracking
    if (!this.roomPlayers.find(p => p.id === id)) {
      this.roomPlayers.push({ id, name, team });
      this.broadcastRoomUpdate();
      // Log de entrada
      this.console.logPlayerJoined(name);
    }
    
    // Spectators não têm representação física no jogo
    if (team === 'spectator') {
      return;
    }
    
    const spawnPoints = team === 'red' ? this.map.spawnPoints.red : this.map.spawnPoints.blue;
    const spawnIndex = this.state.players.filter(p => p.team === team).length % spawnPoints.length;
    const spawn = spawnPoints[spawnIndex];

    const player: Player = {
      id,
      name,
      team,
      circle: Physics.createCircle(spawn.x, spawn.y, 15, 10),
      input: { up: false, down: false, left: false, right: false, kick: false },
      kickCharge: 0,
      isChargingKick: false
    };

    this.state.players.push(player);
  }
  
  addSpectator(id: string, name: string): void {
    this.addPlayer(id, name, 'spectator');
  }
  
  private broadcastRoomUpdate(): void {
    if (this.isHost && this.networkManager) {
      this.networkManager.broadcastRoomUpdate(this.roomPlayers);
    }
    this.updateRoomMenu();
  }

  setControlledPlayer(playerId: string): void {
    this.controlledPlayerId = playerId;
  }
  
  setLocalPlayerName(name: string): void {
    this.localPlayerName = name;
  }

  initPlayers(): void {
    for (let i = 0; i < this.config.playersPerTeam; i++) {
      this.addPlayer(`local-${i}`, `Red ${i + 1}`, 'red');
      this.addPlayer(`bot-${i}`, `Blue ${i + 1}`, 'blue');
    }
  }

  private setupControls(): void {
    window.addEventListener('keydown', (e) => {
      // Ignora controles do jogo se está digitando no console
      if (this.console.isTyping()) return;
      
      // Evita key repeat
      if (e.repeat) return;
      
      // ESC toggle room menu
      if (e.key === 'Escape' && this.isMultiplayer) {
        e.preventDefault();
        this.toggleRoomMenu();
        return;
      }
      
      this.keyState[e.key] = true;
      if (e.key === ' ') {
        e.preventDefault();
        this.handleKickInput();
      }
      
      if (e.key === 'Tab') {
        e.preventDefault();
        this.switchPlayer();
      }
    });

    window.addEventListener('keyup', (e) => {
      // Ignora controles do jogo se está digitando no console
      if (this.console.isTyping()) return;
      
      this.keyState[e.key] = false;
      
      // No modo carregável, soltar a tecla dispara o chute
      if (e.key === ' ' && this.config.kickMode === 'chargeable') {
        this.handleKickRelease();
      }
    });
  }
  
  private setupConsole(): void {
    this.console.onChatMessage((message) => {
      if (this.isMultiplayer && this.networkManager) {
        // Envia mensagem de chat pela network
        const playerName = this.getPlayerName(this.controlledPlayerId);
        
        // Adiciona localmente SEMPRE (host e peer)
        this.console.addChatMessage(playerName, message);
        
        // Envia pela network
        this.networkManager.sendChatMessage(playerName, message);
      } else {
        // Single player - apenas local
        const playerName = this.getPlayerName(this.controlledPlayerId);
        this.console.addChatMessage(playerName, message);
      }
    });
    
    // Se for host, broadcast eventos para os clientes
    if (this.isHost && this.networkManager) {
      this.console.onEventBroadcast((text, type) => {
        this.networkManager?.broadcastConsoleEvent(text, type);
      });
    }
  }
  
  private getPlayerName(playerId: string): string {
    // Tenta buscar em roomPlayers primeiro
    const roomPlayer = this.roomPlayers.find(p => p.id === playerId);
    if (roomPlayer) return roomPlayer.name;
    
    // Tenta buscar em state.players
    const player = this.state.players.find(p => p.id === playerId);
    if (player) return player.name;
    
    // Se for o controlledPlayerId, usa o nome local armazenado
    if (playerId === this.controlledPlayerId) {
      return this.localPlayerName;
    }
    
    return 'Unknown';
  }
  
  private broadcastChatExcept(playerName: string, message: string, excludeId: string): void {
    if (this.networkManager) {
      this.networkManager.broadcastChatExcept(playerName, message, excludeId);
    }
  }
  
  // Processa kick imediatamente para resposta mais rápida
  private handleKickInput(): void {
    if (!this.state.running || this.state.finished) return;
    
    const player = this.state.players.find(p => p.id === this.controlledPlayerId);
    if (!player) return;
    
    // Modo carregável: inicia o carregamento
    if (this.config.kickMode === 'chargeable') {
      player.isChargingKick = true;
      player.kickCharge = 0;
      
      // Se for multiplayer client, notifica que começou a carregar
      if (this.isMultiplayer && !this.isHost && this.networkManager) {
        this.networkManager.sendInput({
          up: !!(this.keyState['ArrowUp'] || this.keyState['w']),
          down: !!(this.keyState['ArrowDown'] || this.keyState['s']),
          left: !!(this.keyState['ArrowLeft'] || this.keyState['a']),
          right: !!(this.keyState['ArrowRight'] || this.keyState['d']),
          kick: false // Kick só será true quando soltar
        });
      }
      return;
    }
    
    // Modo clássico: kick imediato
    // Se for multiplayer client, envia kick imediatamente para o host E simula localmente
    if (this.isMultiplayer && !this.isHost) {
      if (this.networkManager) {
        // Envia input com kick=true imediatamente
        this.networkManager.sendInput({
          up: !!(this.keyState['ArrowUp'] || this.keyState['w']),
          down: !!(this.keyState['ArrowDown'] || this.keyState['s']),
          left: !!(this.keyState['ArrowLeft'] || this.keyState['a']),
          right: !!(this.keyState['ArrowRight'] || this.keyState['d']),
          kick: true
        });
        
        // Client-Side Prediction: simula kick localmente para feedback visual imediato
        // O estado real da bola será corrigido quando receber update do host
        if (this.CLIENT_PREDICTION_ENABLED) {
          this.tryKickLocal(player);
        }
      }
      return;
    }
    
    // Host ou singleplayer: executa kick diretamente
    this.tryKick(player);
  }

  private handleKickRelease(): void {
    if (!this.state.running || this.state.finished) return;
    
    const player = this.state.players.find(p => p.id === this.controlledPlayerId);
    if (!player || !player.isChargingKick) return;
    
    const chargeAmount = player.kickCharge;
    player.isChargingKick = false;
    
    // Se for multiplayer client, envia kick com a força carregada
    if (this.isMultiplayer && !this.isHost && this.networkManager) {
      this.networkManager.sendInput({
        up: !!(this.keyState['ArrowUp'] || this.keyState['w']),
        down: !!(this.keyState['ArrowDown'] || this.keyState['s']),
        left: !!(this.keyState['ArrowLeft'] || this.keyState['a']),
        right: !!(this.keyState['ArrowRight'] || this.keyState['d']),
        kick: true,
        kickCharge: chargeAmount
      });
      
      // Client-Side Prediction: simula kick localmente para feedback visual imediato
      if (this.CLIENT_PREDICTION_ENABLED) {
        this.tryKickLocal(player, chargeAmount);
      }
      player.kickCharge = 0;
      return;
    }
    
    // Host ou singleplayer: executa kick com força carregada
    this.tryKick(player, chargeAmount);
    player.kickCharge = 0;
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
      // Nota: kick agora é processado diretamente no keydown, não aqui
      const input = this.cachedInput;
      input.up = !!(this.keyState['ArrowUp'] || this.keyState['w']);
      input.down = !!(this.keyState['ArrowDown'] || this.keyState['s']);
      input.left = !!(this.keyState['ArrowLeft'] || this.keyState['a']);
      input.right = !!(this.keyState['ArrowRight'] || this.keyState['d']);
      input.kick = false; // Kick é processado no keydown
      
      // SEMPRE copia valores para o player (para Client-Side Prediction funcionar)
      player.input.up = input.up;
      player.input.down = input.down;
      player.input.left = input.left;
      player.input.right = input.right;
      
      if (this.isMultiplayer && !this.isHost) {
        // Comparação rápida sem JSON.stringify (sem kick pois é tratado separadamente)
        const inputKey = `${+input.up}${+input.down}${+input.left}${+input.right}`;
        const inputChanged = inputKey !== this.lastInputSent;
        
        this.inputSendCounter++;
        const shouldSendPeriodic = this.inputSendCounter >= 5;
        if (shouldSendPeriodic) {
          this.inputSendCounter = 0;
        }
        
        if ((inputChanged || shouldSendPeriodic || player.isChargingKick) && this.networkManager) {
          this.networkManager.sendInput({ 
            ...input,
            isChargingKick: player.isChargingKick,
            kickCharge: player.kickCharge
          });
          this.lastInputSent = inputKey;
        }
      }
      // kick é setado pelo handleKickInput
    }
  }

  private updatePlayer(player: Player, dt: number): void {
    this.updatePlayerInput(player);

    // Atualiza carregamento do chute no modo carregável
    if (this.config.kickMode === 'chargeable' && player.isChargingKick) {
      player.kickCharge = Math.min(1, player.kickCharge + dt); // 1 segundo para carregar totalmente
    }

    const accel = Physics.PLAYER_ACCELERATION;
    const maxSpeed = Physics.PLAYER_MAX_SPEED;

    if (player.input.up) player.circle.vel.y -= accel;
    if (player.input.down) player.circle.vel.y += accel;
    if (player.input.left) player.circle.vel.x -= accel;
    if (player.input.right) player.circle.vel.x += accel;

    const speed = Physics.vectorLength(player.circle.vel);
    if (speed > maxSpeed) {
      const normalized = Physics.vectorNormalize(player.circle.vel);
      player.circle.vel.x = normalized.x * maxSpeed;
      player.circle.vel.y = normalized.y * maxSpeed;
    }

    // Kick de peers é processado via input de rede
    if (player.input.kick) {
      this.tryKick(player, player.kickCharge);
      player.input.kick = false;
      player.kickCharge = 0;
      player.isChargingKick = false;
    }

    Physics.updateCircle(player.circle, dt);
  }

  // Simula física local do jogador controlado para Client-Side Prediction
  private simulateLocalPlayer(player: Player, dt: number): void {
    const accel = Physics.PLAYER_ACCELERATION;
    const maxSpeed = Physics.PLAYER_MAX_SPEED;

    // Aplica aceleração baseada no input
    if (player.input.up) player.circle.vel.y -= accel;
    if (player.input.down) player.circle.vel.y += accel;
    if (player.input.left) player.circle.vel.x -= accel;
    if (player.input.right) player.circle.vel.x += accel;

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
    // Apenas resolve a separação visual - o host tem autoridade sobre a física real
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
      // Resolve colisão com física parcial (host tem autoridade, mas queremos feedback)
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
            const transferFactor = 0.3; // Transferência parcial para não sobrescrever o host
            ball.vel.x += nx * dotProduct * transferFactor;
            ball.vel.y += ny * dotProduct * transferFactor;
          }
        }
      }
    }
    
    // Atualiza posição da bola baseada em sua velocidade (predição)
    // Aplica damping e movimento
    ball.vel.x *= ball.damping;
    ball.vel.y *= ball.damping;
    
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
    const ball = this.state.ball.circle;
    const dx = ball.pos.x - player.circle.pos.x;
    const dy = ball.pos.y - player.circle.pos.y;
    const distSq = dx * dx + dy * dy;
    const kickRadiusSq = Physics.KICK_RADIUS * Physics.KICK_RADIUS;

    if (distSq < kickRadiusSq) {
      const dist = Math.sqrt(distSq);
      if (dist > 0) {
        const invDist = 1 / dist;
        // Aplica a força baseada no carregamento (mínimo 20% se carregável, 100% se clássico)
        const kickStrength = this.config.kickMode === 'chargeable' 
          ? Physics.KICK_STRENGTH * Math.max(0.2, chargeAmount)
          : Physics.KICK_STRENGTH;
        
        ball.vel.x += dx * invDist * kickStrength;
        ball.vel.y += dy * invDist * kickStrength;
      }
    }
  }

  // Versão local do kick para Client-Side Prediction (feedback visual imediato)
  private tryKickLocal(player: Player, chargeAmount: number = 1): void {
    const ball = this.state.ball.circle;
    const dx = ball.pos.x - player.circle.pos.x;
    const dy = ball.pos.y - player.circle.pos.y;
    const distSq = dx * dx + dy * dy;
    const kickRadiusSq = Physics.KICK_RADIUS * Physics.KICK_RADIUS;

    if (distSq < kickRadiusSq) {
      const dist = Math.sqrt(distSq);
      if (dist > 0) {
        const invDist = 1 / dist;
        // Aplica força reduzida localmente - o host tem a autoridade real
        // Usamos força parcial para dar feedback visual sem exagerar
        const kickStrength = this.config.kickMode === 'chargeable' 
          ? Physics.KICK_STRENGTH * Math.max(0.2, chargeAmount) * 0.7
          : Physics.KICK_STRENGTH * 0.7;
        
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

    // Client com Client-Side Prediction
    if (this.isMultiplayer && !this.isHost) {
      const localPlayer = this.state.players.find(p => p.id === this.controlledPlayerId);
      
      if (localPlayer) {
        // 1. Captura e aplica input imediatamente (Client-Side Prediction)
        this.updatePlayerInput(localPlayer);
        
        // 2. Simula física local do jogador controlado para resposta imediata
        if (this.CLIENT_PREDICTION_ENABLED) {
          this.simulateLocalPlayer(localPlayer, dt);
        }
        
        // Client processa carregamento de chute localmente para visualização
        if (this.config.kickMode === 'chargeable' && localPlayer.isChargingKick) {
          localPlayer.kickCharge = Math.min(1, localPlayer.kickCharge + dt);
        }
        
        // 3. Física local da bola - simula colisão com jogador local para resposta imediata
        if (this.localBallPhysicsEnabled) {
          this.simulateLocalBallPhysics(localPlayer, dt);
        }
      }
      
      // 4. Interpola outros jogadores (NÃO o jogador local)
      if (this.targetState) {
        for (const player of this.state.players) {
          // Pula o jogador local - ele usa prediction, não interpolação
          if (player.id === this.controlledPlayerId && this.CLIENT_PREDICTION_ENABLED) {
            continue;
          }
          
          const target = this.targetState.players.get(player.id);
          if (!target) continue;
          
          // Outros jogadores: interpolação suave
          player.circle.pos.x += (target.x - player.circle.pos.x) * this.INTERPOLATION_SPEED;
          player.circle.pos.y += (target.y - player.circle.pos.y) * this.INTERPOLATION_SPEED;
          player.circle.vel.x += (target.vx - player.circle.vel.x) * this.INTERPOLATION_SPEED;
          player.circle.vel.y += (target.vy - player.circle.vel.y) * this.INTERPOLATION_SPEED;
        }
        
        // 5. Reconciliação do jogador local - APENAS quando novo estado é recebido
        if (this.newStateReceived && localPlayer && this.CLIENT_PREDICTION_ENABLED) {
          const target = this.targetState.players.get(localPlayer.id);
          if (target) {
            const dx = target.x - localPlayer.circle.pos.x;
            const dy = target.y - localPlayer.circle.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > this.RECONCILIATION_THRESHOLD) {
              // Grande discrepância: snap imediato (teleporte, reset, gol, etc)
              localPlayer.circle.pos.x = target.x;
              localPlayer.circle.pos.y = target.y;
              localPlayer.circle.vel.x = target.vx;
              localPlayer.circle.vel.y = target.vy;
            } else if (dist > 3) {
              // Pequena discrepância: correção suave
              localPlayer.circle.pos.x += dx * this.RECONCILIATION_SPEED;
              localPlayer.circle.pos.y += dy * this.RECONCILIATION_SPEED;
              // Também corrige velocidade suavemente
              localPlayer.circle.vel.x += (target.vx - localPlayer.circle.vel.x) * this.RECONCILIATION_SPEED;
              localPlayer.circle.vel.y += (target.vy - localPlayer.circle.vel.y) * this.RECONCILIATION_SPEED;
            }
          }
          this.newStateReceived = false;
        }
        
        // 6. Interpola bola suavemente para o estado do servidor
        // Mas não sobrescreve completamente se estamos aplicando física local
        const ballTarget = this.targetState.ball;
        const ball = this.state.ball.circle;
        
        // Calcula distância para o alvo
        const ballDx = ballTarget.x - ball.pos.x;
        const ballDy = ballTarget.y - ball.pos.y;
        const ballDist = Math.sqrt(ballDx * ballDx + ballDy * ballDy);
        
        if (ballDist > 50) {
          // Grande discrepância: snap mais rápido
          ball.pos.x += ballDx * 0.4;
          ball.pos.y += ballDy * 0.4;
          ball.vel.x = ballTarget.vx;
          ball.vel.y = ballTarget.vy;
        } else {
          // Interpolação suave
          ball.pos.x += ballDx * this.BALL_INTERPOLATION_SPEED;
          ball.pos.y += ballDy * this.BALL_INTERPOLATION_SPEED;
          ball.vel.x += (ballTarget.vx - ball.vel.x) * this.BALL_INTERPOLATION_SPEED;
          ball.vel.y += (ballTarget.vy - ball.vel.y) * this.BALL_INTERPOLATION_SPEED;
        }
      }
      return;
    }

    // Host ou singleplayer: processa toda a física
    if (!this.isMultiplayer || this.isHost) {
      this.state.time += dt;
      
      if (this.config.timeLimit > 0 && this.state.time >= this.config.timeLimit) {
        this.endGame();
        return;
      }
    }

    for (const player of this.state.players) {
      this.updatePlayer(player, dt);
    }

    Physics.updateCircle(this.state.ball.circle, dt);

    for (let i = 0; i < this.state.players.length; i++) {
      for (let j = i + 1; j < this.state.players.length; j++) {
        if (Physics.checkCircleCollision(this.state.players[i].circle, this.state.players[j].circle)) {
          Physics.resolveCircleCollision(this.state.players[i].circle, this.state.players[j].circle);
        }
      }
    }

    for (const player of this.state.players) {
      if (Physics.checkCircleCollision(player.circle, this.state.ball.circle)) {
        Physics.resolveCircleCollision(player.circle, this.state.ball.circle);
        // Rastreia quem tocou na bola por último (apenas jogadores em times)
        if (player.team !== 'spectator') {
          this.lastBallToucher = { id: player.id, name: player.name, team: player.team };
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
      
      if (Physics.checkSegmentCollision(this.state.ball.circle, segment)) {
        Physics.resolveSegmentCollision(this.state.ball.circle, segment);
      }
    }

    const goalScored = this.checkGoal();
    if (goalScored && !this.goalJustScored) {
      this.goalJustScored = true;
      
      // Log do gol
      if (this.lastBallToucher) {
        this.console.logGoal(this.lastBallToucher.name, this.lastBallToucher.team);
      }
      
      if (goalScored === 'red') {
        this.state.score.blue++;
      } else {
        this.state.score.red++;
      }
      
      this.updateUI();
      
      // Aguarda 1 segundo antes de reposicionar ou finalizar
      setTimeout(() => {
        if (this.config.scoreLimit > 0 && 
            (this.state.score.red >= this.config.scoreLimit || 
             this.state.score.blue >= this.config.scoreLimit)) {
          this.endGame();
        } else {
          this.resetPositions();
        }
        this.goalJustScored = false;
      }, 1000);
    }
    
    if (this.isMultiplayer && this.isHost && this.networkManager) {
      this.networkManager.broadcastState(this.serializeState());
    }
  }

  private endGame(): void {
    this.state.finished = true;
    this.state.running = false;
    this.gameStarted = false;
    
    if (this.state.score.red > this.state.score.blue) {
      this.state.winner = 'red';
    } else if (this.state.score.blue > this.state.score.red) {
      this.state.winner = 'blue';
    } else {
      this.state.winner = 'draw';
    }
    
    // Log do fim do jogo
    this.console.logGameEnd(this.state.winner);
    
    // Em multiplayer, host move todos para espectador
    if (this.isMultiplayer && this.isHost) {
      this.resetAllToSpectators();
    }
    
    this.showGameOver();
  }

  private showGameOver(): void {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'game-over-overlay';
    overlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      padding: 40px;
      border-radius: 20px;
      text-align: center;
      color: white;
      z-index: 999;
    `;
    
    let resultText = '';
    let resultColor = '';
    
    if (this.state.winner === 'red') {
      resultText = 'Red Team Wins!';
      resultColor = '#ff4757';
    } else if (this.state.winner === 'blue') {
      resultText = 'Blue Team Wins!';
      resultColor = '#5352ed';
    } else {
      resultText = 'Draw!';
      resultColor = '#ffa502';
    }
    
    // Botões diferentes para multiplayer vs singleplayer
    let buttonsHtml = '';
    if (this.isMultiplayer) {
      if (this.isHost) {
        buttonsHtml = `
          <button id="btn-open-room-menu" style="
            background: #667eea;
            color: white;
            border: none;
            padding: 15px 40px;
            font-size: 18px;
            border-radius: 10px;
            cursor: pointer;
            margin: 10px;
          ">Open Room Menu</button>
          <button id="btn-menu-over" style="
            background: #666;
            color: white;
            border: none;
            padding: 15px 40px;
            font-size: 18px;
            border-radius: 10px;
            cursor: pointer;
            margin: 10px;
          ">Leave Room</button>
        `;
      } else {
        buttonsHtml = `
          <p style="color: #888; margin-bottom: 20px;">Waiting for host to set up next game...</p>
          <button id="btn-menu-over" style="
            background: #666;
            color: white;
            border: none;
            padding: 15px 40px;
            font-size: 18px;
            border-radius: 10px;
            cursor: pointer;
            margin: 10px;
          ">Leave Room</button>
        `;
      }
    } else {
      buttonsHtml = `
        <button id="btn-play-again" style="
          background: #667eea;
          color: white;
          border: none;
          padding: 15px 40px;
          font-size: 18px;
          border-radius: 10px;
          cursor: pointer;
          margin: 10px;
        ">Play Again</button>
        <button id="btn-menu-over" style="
          background: #666;
          color: white;
          border: none;
          padding: 15px 40px;
          font-size: 18px;
          border-radius: 10px;
          cursor: pointer;
          margin: 10px;
        ">Back to Menu</button>
      `;
    }
    
    overlay.innerHTML = `
      <h1 style="font-size: 48px; margin-bottom: 20px; color: ${resultColor};">${resultText}</h1>
      <p style="font-size: 32px; margin-bottom: 30px;">Red ${this.state.score.red} - ${this.state.score.blue} Blue</p>
      ${buttonsHtml}
    `;
    
    gameContainer.style.position = 'relative';
    gameContainer.appendChild(overlay);
    
    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      overlay.remove();
      this.reset();
      this.start();
    });
    
    document.getElementById('btn-open-room-menu')?.addEventListener('click', () => {
      overlay.remove();
      this.toggleRoomMenu();
    });
    
    document.getElementById('btn-menu-over')?.addEventListener('click', () => {
      overlay.remove();
      this.showMenu();
    });
  }

  private showMenu(): void {
    const menu = document.getElementById('menu');
    const gameContainer = document.getElementById('game-container');
    
    if (menu) menu.classList.remove('hidden');
    if (gameContainer) gameContainer.classList.add('hidden');
    
    this.hideRoomMenu();
    this.stop();
  }

  // ========== Room Menu Methods ==========
  
  toggleRoomMenu(): void {
    this.roomMenuVisible = !this.roomMenuVisible;
    if (this.roomMenuVisible) {
      this.showRoomMenu();
    } else {
      this.hideRoomMenu();
    }
  }

  private showRoomMenu(): void {
    if (this.roomMenuElement) {
      this.roomMenuElement.remove();
    }

    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return;

    this.roomMenuElement = document.createElement('div');
    this.roomMenuElement.id = 'room-menu';
    this.roomMenuElement.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.75);
      padding: 30px;
      border-radius: 15px;
      min-width: 600px;
      max-width: 800px;
      color: white;
      z-index: 1000;
      font-family: Arial, sans-serif;
      backdrop-filter: blur(5px);
    `;

    this.updateRoomMenuContent();
    gameContainer.style.position = 'relative';
    gameContainer.appendChild(this.roomMenuElement);
  }

  private hideRoomMenu(): void {
    if (this.roomMenuElement) {
      this.roomMenuElement.remove();
      this.roomMenuElement = null;
    }
    this.roomMenuVisible = false;
  }

  private updateRoomMenu(): void {
    if (this.roomMenuVisible && this.roomMenuElement) {
      this.updateRoomMenuContent();
    }
  }

  private updateRoomMenuContent(): void {
    if (!this.roomMenuElement) return;

    const spectators = this.roomPlayers.filter(p => p.team === 'spectator');
    const redPlayers = this.roomPlayers.filter(p => p.team === 'red');
    const bluePlayers = this.roomPlayers.filter(p => p.team === 'blue');

    let statusText = '';
    if (this.gameStarted) {
      statusText = this.state.running 
        ? '<span style="color: #2ecc71;">● Game in Progress</span>'
        : '<span style="color: #f39c12;">● Game Paused</span>';
    } else {
      statusText = '<span style="color: #f39c12;">● Waiting to Start</span>';
    }

    this.roomMenuElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #667eea;">Room Menu</h2>
        <span style="font-size: 14px;">${statusText}</span>
      </div>
      <p style="color: #888; margin-bottom: 20px; font-size: 14px;">Press ESC to close${this.isHost ? ' | You are the host' : ''}</p>
      
      <div style="display: flex; gap: 20px; margin-bottom: 20px;">
        <!-- Red Team -->
        <div style="flex: 1; background: rgba(255, 71, 87, 0.2); border: 2px solid #ff4757; border-radius: 10px; padding: 15px;">
          <h3 style="color: #ff4757; margin: 0 0 15px 0; text-align: center;">🔴 Red Team (${redPlayers.length}/${this.config.playersPerTeam})</h3>
          <div id="red-team-list" style="min-height: 80px;">
            ${redPlayers.length === 0 ? '<p style="color: #888; text-align: center;">Empty</p>' : ''}
            ${redPlayers.map(p => this.renderPlayerItem(p, 'red')).join('')}
          </div>
        </div>
        
        <!-- Blue Team -->
        <div style="flex: 1; background: rgba(83, 82, 237, 0.2); border: 2px solid #5352ed; border-radius: 10px; padding: 15px;">
          <h3 style="color: #5352ed; margin: 0 0 15px 0; text-align: center;">🔵 Blue Team (${bluePlayers.length}/${this.config.playersPerTeam})</h3>
          <div id="blue-team-list" style="min-height: 80px;">
            ${bluePlayers.length === 0 ? '<p style="color: #888; text-align: center;">Empty</p>' : ''}
            ${bluePlayers.map(p => this.renderPlayerItem(p, 'blue')).join('')}
          </div>
        </div>
      </div>
      
      <!-- Spectators -->
      <div style="background: rgba(255, 255, 255, 0.1); border: 2px solid #888; border-radius: 10px; padding: 15px;">
        <h3 style="color: #888; margin: 0 0 15px 0; text-align: center;">👁️ Spectators (${spectators.length})</h3>
        <div id="spectator-list" style="min-height: 50px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
          ${spectators.length === 0 ? '<p style="color: #666; text-align: center; width: 100%;">No spectators</p>' : ''}
          ${spectators.map(p => this.renderPlayerItem(p, 'spectator')).join('')}
        </div>
      </div>
      
      ${this.isHost ? `
        <div style="margin-top: 20px; text-align: center;">
          ${!this.gameStarted ? `
            <button id="btn-start-game" style="
              background: #2ecc71;
              color: white;
              border: none;
              padding: 15px 40px;
              font-size: 16px;
              border-radius: 8px;
              cursor: pointer;
              margin: 5px;
            ">▶ Start Game</button>
          ` : `
            <button id="btn-pause-game" style="
              background: ${this.state.running ? '#f39c12' : '#2ecc71'};
              color: white;
              border: none;
              padding: 15px 40px;
              font-size: 16px;
              border-radius: 8px;
              cursor: pointer;
              margin: 5px;
            ">${this.state.running ? '⏸ Pause' : '▶ Resume'}</button>
            <button id="btn-stop-game" style="
              background: #e74c3c;
              color: white;
              border: none;
              padding: 15px 40px;
              font-size: 16px;
              border-radius: 8px;
              cursor: pointer;
              margin: 5px;
            ">⏹ Stop Game</button>
          `}
          <button id="btn-reset-teams" style="
            background: #95a5a6;
            color: white;
            border: none;
            padding: 15px 40px;
            font-size: 16px;
            border-radius: 8px;
            cursor: pointer;
            margin: 5px;
          ">↻ Reset All to Spectators</button>
        </div>
      ` : ''}
    `;

    // Add event listeners
    if (this.isHost) {
      this.setupRoomMenuEvents();
    }
  }

  private renderPlayerItem(player: RoomPlayer, currentTeam: 'red' | 'blue' | 'spectator'): string {
    const isMe = player.id === this.controlledPlayerId || player.id === this.networkManager?.getClientId();
    const meIndicator = isMe ? ' (You)' : '';
    const hostIndicator = this.isHostPlayer(player.id) ? ' ⭐' : '';
    
    // Exibe ping para todos os jogadores, se o ping estiver disponível
    // Host não tem ping (seria 0ms)
    let pingDisplay = '';
    if (player.ping !== undefined) {
      pingDisplay = ` <span style="color: #888; font-size: 11px;">(${player.ping}ms)</span>`;
    } else if (isMe && this.isHost) {
      // Host não exibe ping para si mesmo
      pingDisplay = '';
    }
    
    let bgColor = 'rgba(255,255,255,0.1)';
    if (currentTeam === 'red') bgColor = 'rgba(255, 71, 87, 0.3)';
    if (currentTeam === 'blue') bgColor = 'rgba(83, 82, 237, 0.3)';

    if (!this.isHost) {
      return `
        <div style="background: ${bgColor}; padding: 10px 15px; border-radius: 8px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
          <span>${player.name}${meIndicator}${hostIndicator}${pingDisplay}</span>
        </div>
      `;
    }

    return `
      <div style="background: ${bgColor}; padding: 10px 15px; border-radius: 8px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
        <span>${player.name}${meIndicator}${hostIndicator}${pingDisplay}</span>
        <div style="display: flex; gap: 5px;">
          ${currentTeam !== 'red' ? `<button class="move-btn" data-player="${player.id}" data-team="red" style="background: #ff4757; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 12px;">→ Red</button>` : ''}
          ${currentTeam !== 'blue' ? `<button class="move-btn" data-player="${player.id}" data-team="blue" style="background: #5352ed; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 12px;">→ Blue</button>` : ''}
          ${currentTeam !== 'spectator' ? `<button class="move-btn" data-player="${player.id}" data-team="spectator" style="background: #888; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 12px;">→ Spec</button>` : ''}
        </div>
      </div>
    `;
  }

  private isHostPlayer(playerId: string): boolean {
    // O host é sempre o primeiro player adicionado em multiplayer
    if (this.roomPlayers.length > 0) {
      return this.roomPlayers[0].id === playerId;
    }
    return false;
  }

  private setupRoomMenuEvents(): void {
    // Move player buttons
    const moveButtons = this.roomMenuElement?.querySelectorAll('.move-btn');
    moveButtons?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const playerId = target.dataset.player;
        const team = target.dataset.team as 'red' | 'blue' | 'spectator';
        if (playerId && team) {
          this.movePlayerToTeam(playerId, team);
        }
      });
    });

    // Start game button
    const startBtn = this.roomMenuElement?.querySelector('#btn-start-game');
    startBtn?.addEventListener('click', () => {
      this.startGameFromMenu();
    });

    // Pause game button
    const pauseBtn = this.roomMenuElement?.querySelector('#btn-pause-game');
    pauseBtn?.addEventListener('click', () => {
      this.togglePauseGame();
    });

    // Stop game button
    const stopBtn = this.roomMenuElement?.querySelector('#btn-stop-game');
    stopBtn?.addEventListener('click', () => {
      this.stopGame();
    });

    // Reset teams button
    const resetBtn = this.roomMenuElement?.querySelector('#btn-reset-teams');
    resetBtn?.addEventListener('click', () => {
      this.resetAllToSpectators();
    });
  }

  movePlayerToTeam(playerId: string, team: 'red' | 'blue' | 'spectator'): void {
    if (!this.isHost) return;

    // Check team limits
    if (team !== 'spectator') {
      const teamCount = this.roomPlayers.filter(p => p.team === team).length;
      if (teamCount >= this.config.playersPerTeam) {
        console.log(`Team ${team} is full`);
        return;
      }
    }

    const roomPlayer = this.roomPlayers.find(p => p.id === playerId);
    if (!roomPlayer) return;

    const oldTeam = roomPlayer.team;
    roomPlayer.team = team;
    
    // Log mudança de time
    if (oldTeam !== team) {
      this.console.logTeamChange(roomPlayer.name, team);
    }

    // Remove from game state if was playing
    if (oldTeam !== 'spectator') {
      this.state.players = this.state.players.filter(p => p.id !== playerId);
    }

    // Add to game state if joining a team
    if (team !== 'spectator') {
      const spawnPoints = team === 'red' ? this.map.spawnPoints.red : this.map.spawnPoints.blue;
      const spawnIndex = this.state.players.filter(p => p.team === team).length % spawnPoints.length;
      const spawn = spawnPoints[spawnIndex];

      const player: Player = {
        id: playerId,
        name: roomPlayer.name,
        team,
        circle: Physics.createCircle(spawn.x, spawn.y, 15, 10),
        input: { up: false, down: false, left: false, right: false, kick: false },
        kickCharge: 0,
        isChargingKick: false
      };

      this.state.players.push(player);
      
      // Se é o próprio host sendo movido, atualiza controlledPlayerId
      if (playerId === this.networkManager?.getClientId()) {
        this.controlledPlayerId = playerId;
      }
    }

    // Broadcast changes
    if (this.networkManager) {
      this.networkManager.broadcastTeamChange(playerId, team);
    }
    this.broadcastRoomUpdate();
  }

  private startGameFromMenu(): void {
    if (!this.isHost) return;

    const redCount = this.roomPlayers.filter(p => p.team === 'red').length;
    const blueCount = this.roomPlayers.filter(p => p.team === 'blue').length;

    if (redCount === 0 && blueCount === 0) {
      alert('At least 1 player must be in a team to start!');
      return;
    }

    // Remove overlay de game over se existir
    const gameOverOverlay = document.getElementById('game-over-overlay');
    if (gameOverOverlay) {
      gameOverOverlay.remove();
    }

    this.gameStarted = true;
    this.state.finished = false;
    this.state.winner = null;
    this.hideRoomMenu();
    this.reset();
    this.start();
    
    // Log início do jogo
    this.console.logGameStart();

    if (this.networkManager) {
      this.networkManager.broadcastGameStart();
    }
  }

  private togglePauseGame(): void {
    if (!this.isHost || !this.gameStarted) return;

    if (this.state.running) {
      // Pause
      this.state.running = false;
      this.console.logGamePause();
    } else {
      // Resume
      this.state.running = true;
      this.lastTime = 0;
      this.animationId = requestAnimationFrame(this.gameLoop);
      this.console.logGameResume();
    }

    // Broadcast pause state to clients
    if (this.networkManager) {
      this.networkManager.broadcastGamePause(this.state.running);
    }

    this.updateRoomMenu();
  }

  private stopGame(): void {
    if (!this.isHost || !this.gameStarted) return;

    this.gameStarted = false;
    this.state.running = false;
    this.state.finished = true;
    
    // Move everyone to spectator
    this.resetAllToSpectators();
    
    // Broadcast stop to clients
    if (this.networkManager) {
      this.networkManager.broadcastGameStop();
    }

    this.updateRoomMenu();
  }

  private resetAllToSpectators(): void {
    if (!this.isHost) return;

    for (const player of this.roomPlayers) {
      if (player.team !== 'spectator') {
        this.movePlayerToTeam(player.id, 'spectator');
      }
    }
  }

  getRoomPlayers(): RoomPlayer[] {
    return this.roomPlayers;
  }

  isGameStarted(): boolean {
    return this.gameStarted;
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
    
    // Atualiza status de espectador
    this.updateSpectatorStatus();
  }
  
  private updateSpectatorStatus(): void {
    const spectatorStatus = document.getElementById('spectator-status');
    if (!spectatorStatus) return;
    
    if (!this.isMultiplayer) {
      spectatorStatus.classList.add('hidden');
      return;
    }
    
    const myId = this.networkManager?.getClientId() || this.controlledPlayerId;
    const myRoomPlayer = this.roomPlayers.find(p => p.id === myId);
    const isSpectator = !myRoomPlayer || myRoomPlayer.team === 'spectator';
    
    if (isSpectator) {
      spectatorStatus.classList.remove('hidden');
      spectatorStatus.textContent = this.gameStarted 
        ? '👁️ Spectating - Press ESC to open Room Menu'
        : '👁️ Waiting for game to start - Press ESC to open Room Menu';
    } else {
      spectatorStatus.classList.add('hidden');
    }
  }

  private gameLoop = (timestamp: number): void => {
    const dt = this.lastTime ? (timestamp - this.lastTime) / 1000 : 0;
    this.lastTime = timestamp;

    if (dt > 0 && dt < 0.1) {
      this.update(dt);
    }

    this.renderer.drawState(this.state, this.map, this.controlledPlayerId, this.state.time, this.config.ballConfig);
    this.updateUI();

    // Em multiplayer, sempre continua o loop (para renderizar enquanto espera)
    // Em singleplayer, só continua se o jogo está rodando
    if (this.state.running || this.isMultiplayer) {
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
  };

  start(): void {
    this.state.running = true;
    this.lastTime = 0;
    this.animationId = requestAnimationFrame(this.gameLoop);
  }
  
  // Inicia o render loop sem iniciar o jogo (para lobby)
  startRenderLoop(): void {
    if (!this.animationId) {
      this.lastTime = 0;
      this.animationId = requestAnimationFrame(this.gameLoop);
    }
  }

  stop(): void {
    this.state.running = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  reset(): void {
    this.state.score = { red: 0, blue: 0 };
    this.state.time = 0;
    this.state.finished = false;
    this.state.winner = null;
    this.resetPositions();
    this.updateUI();
  }

  private serializeState(): any {
    return {
      players: this.state.players.map(p => ({
        id: p.id,
        name: p.name,
        team: p.team,
        pos: p.circle.pos,
        vel: p.circle.vel,
        kickCharge: p.kickCharge,
        isChargingKick: p.isChargingKick
      })),
      ball: {
        pos: this.state.ball.circle.pos,
        vel: this.state.ball.circle.vel
      },
      score: this.state.score,
      time: this.state.time,
      finished: this.state.finished,
      winner: this.state.winner,
      running: this.state.running,
      gameStarted: this.gameStarted,
      config: {
        kickMode: this.config.kickMode,
        ballConfig: this.config.ballConfig
      }
    };
  }

  applyNetworkState(netState: any): void {
    if (this.isHost) return;

    // Se o client ainda não tem jogadores, significa que é a primeira vez recebendo o estado
    const isFirstSync = this.state.players.length === 0;
    
    // Inicializa targetState se necessário
    if (!this.targetState) {
      this.targetState = {
        players: new Map(),
        ball: { x: 0, y: 0, vx: 0, vy: 0 }
      };
    }
    
    netState.players.forEach((netPlayer: any) => {
      let player = this.state.players.find(p => p.id === netPlayer.id);
      
      // Se o jogador não existe localmente, cria
      if (!player) {
        const team = netPlayer.team || 'blue';
        this.addPlayer(netPlayer.id, netPlayer.name || 'Player', team);
        player = this.state.players.find(p => p.id === netPlayer.id);
        
        // Se este jogador tem o mesmo ID que este client, marca como controlado
        if (isFirstSync && netPlayer.id === this.networkManager?.getClientId()) {
          this.controlledPlayerId = netPlayer.id;
          console.log(`Controlling player: ${netPlayer.id}`);
        }
        
        // Primeira sincronização: aplica posição diretamente
        if (player) {
          player.circle.pos.x = netPlayer.pos.x;
          player.circle.pos.y = netPlayer.pos.y;
          player.circle.vel.x = netPlayer.vel.x;
          player.circle.vel.y = netPlayer.vel.y;
        }
      }
      
      // Armazena estado alvo para interpolação
      this.targetState!.players.set(netPlayer.id, {
        x: netPlayer.pos.x,
        y: netPlayer.pos.y,
        vx: netPlayer.vel.x,
        vy: netPlayer.vel.y
      });
      
      // Atualiza kickCharge e isChargingKick apenas para jogadores NÃO controlados localmente
      // O jogador local mantém seu próprio estado de carregamento
      if (player && player.id !== this.controlledPlayerId) {
        player.kickCharge = netPlayer.kickCharge || 0;
        player.isChargingKick = netPlayer.isChargingKick || false;
      }
    });

    // Armazena estado alvo da bola
    if (isFirstSync) {
      // Primeira sincronização: aplica diretamente
      this.state.ball.circle.pos.x = netState.ball.pos.x;
      this.state.ball.circle.pos.y = netState.ball.pos.y;
      this.state.ball.circle.vel.x = netState.ball.vel.x;
      this.state.ball.circle.vel.y = netState.ball.vel.y;
    }
    
    // Sempre sincroniza config do host (não apenas no primeiro sync)
    if (netState.config) {
      this.config.kickMode = netState.config.kickMode || 'classic';
      if (netState.config.ballConfig) {
        this.config.ballConfig = { ...this.config.ballConfig, ...netState.config.ballConfig };
        // Atualiza as propriedades físicas da bola
        if (netState.config.ballConfig.radius) {
          this.state.ball.circle.radius = netState.config.ballConfig.radius;
        }
        if (netState.config.ballConfig.mass) {
          this.state.ball.circle.mass = netState.config.ballConfig.mass;
          this.state.ball.circle.invMass = netState.config.ballConfig.mass > 0 ? 1 / netState.config.ballConfig.mass : 0;
        }
        if (netState.config.ballConfig.damping) {
          this.state.ball.circle.damping = netState.config.ballConfig.damping;
        }
      }
    }
    this.targetState!.ball = {
      x: netState.ball.pos.x,
      y: netState.ball.pos.y,
      vx: netState.ball.vel.x,
      vy: netState.ball.vel.y
    };
    
    this.state.score = netState.score;
    this.state.time = netState.time;
    this.state.finished = netState.finished;
    this.state.winner = netState.winner;
    
    // Marca que novo estado foi recebido (para reconciliação do jogador local)
    this.newStateReceived = true;

    // Sync game status
    if (netState.running !== undefined) {
      this.state.running = netState.running;
    }
    if (netState.gameStarted !== undefined) {
      this.gameStarted = netState.gameStarted;
    }

    if (this.state.finished && netState.winner) {
      this.showGameOver();
    }
  }

  applyPlayerInput(playerId: string, input: any): void {
    if (!this.isHost) return;

    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      // Preserva kick=true se já estava setado, pois é um evento de momento único
      const hadKick = player.input.kick;
      
      player.input.up = input.up;
      player.input.down = input.down;
      player.input.left = input.left;
      player.input.right = input.right;
      
      // Atualiza estado de carregamento do peer (para visualização no host)
      if (input.isChargingKick !== undefined) {
        player.isChargingKick = input.isChargingKick;
      }
      if (input.kickCharge !== undefined) {
        player.kickCharge = input.kickCharge;
      }
      
      // Se tinha kick antes OU recebeu kick agora, manter true
      if (hadKick || input.kick) {
        player.input.kick = true;
        // Para modo carregável, usa o kickCharge enviado pelo client
        if (input.kickCharge !== undefined) {
          player.kickCharge = input.kickCharge;
        } else if (!hadKick && input.kick) {
          // Modo clássico - força total
          player.kickCharge = 1;
        }
      } else {
        player.input.kick = false;
      }
    }
  }

  setupNetworkCallbacks(): void {
    if (!this.networkManager) return;

    this.networkManager.onStateUpdate((state) => {
      this.applyNetworkState(state);
    });

    this.networkManager.onInput((playerId, input) => {
      this.applyPlayerInput(playerId, input);
    });
    
    this.networkManager.onPingUpdate((peerId, ping) => {
      // Atualiza o ping do jogador na lista
      const roomPlayer = this.roomPlayers.find(p => p.id === peerId);
      if (roomPlayer) {
        roomPlayer.ping = ping;
        this.updateRoomMenu();
      }
    });

    this.networkManager.onPlayerJoin((player) => {
      console.log('onPlayerJoin callback received:', player);
      if (this.isHost) {
        // Players entram como espectadores
        this.addSpectator(player.id, player.name);
        console.log(`Player ${player.id} joined as spectator`);
      }
    });

    this.networkManager.onPlayerLeave((playerId) => {
      const player = this.roomPlayers.find(p => p.id === playerId);
      if (player) {
        this.console.logPlayerLeft(player.name);
      }
      
      this.state.players = this.state.players.filter(p => p.id !== playerId);
      this.roomPlayers = this.roomPlayers.filter(p => p.id !== playerId);
      this.broadcastRoomUpdate();
    });

    this.networkManager.onRoomUpdate((players) => {
      // Client recebe atualização da sala do host
      if (!this.isHost) {
        this.roomPlayers = players;
        this.updateRoomMenu();
      }
    });

    this.networkManager.onTeamChange((playerId, team) => {
      // Client recebe mudança de time do host
      if (!this.isHost) {
        const roomPlayer = this.roomPlayers.find(p => p.id === playerId);
        if (roomPlayer) {
          const oldTeam = roomPlayer.team;
          roomPlayer.team = team;

          // Atualiza game state
          if (oldTeam !== 'spectator') {
            this.state.players = this.state.players.filter(p => p.id !== playerId);
          }

          if (team !== 'spectator') {
            const spawnPoints = team === 'red' ? this.map.spawnPoints.red : this.map.spawnPoints.blue;
            const spawnIndex = this.state.players.filter(p => p.team === team).length % spawnPoints.length;
            const spawn = spawnPoints[spawnIndex];

            const player: Player = {
              id: playerId,
              name: roomPlayer.name,
              team,
              circle: Physics.createCircle(spawn.x, spawn.y, 15, 10),
              input: { up: false, down: false, left: false, right: false, kick: false },
              kickCharge: 0,
              isChargingKick: false
            };

            this.state.players.push(player);
            
            // Se sou eu que fui movido para um time, atualizo meu controlledPlayerId
            if (playerId === this.networkManager?.getClientId()) {
              this.controlledPlayerId = playerId;
              
              // Se o jogo já está rodando, garantir que estou sincronizado
              // O estado completo virá pelo próximo state_update, mas já inicializo aqui
              if (!this.animationId) {
                this.lastTime = 0;
                this.animationId = requestAnimationFrame(this.gameLoop);
              }
            }
          }
        }
        this.updateRoomMenu();
      }
    });

    this.networkManager.onGameStart(() => {
      // Client recebe sinal de início do jogo
      if (!this.isHost) {
        // Remove overlay de game over se existir
        const gameOverOverlay = document.getElementById('game-over-overlay');
        if (gameOverOverlay) {
          gameOverOverlay.remove();
        }
        
        this.gameStarted = true;
        this.state.finished = false;
        this.state.winner = null;
        this.hideRoomMenu();
        this.reset();
        this.start();
      }
    });

    this.networkManager.onGamePause((running) => {
      // Client recebe sinal de pause/resume do jogo
      if (!this.isHost) {
        this.state.running = running;
        if (running) {
          this.lastTime = 0;
          this.animationId = requestAnimationFrame(this.gameLoop);
        }
        this.updateRoomMenu();
      }
    });

    this.networkManager.onGameStop(() => {
      // Client recebe sinal de parada do jogo
      if (!this.isHost) {
        this.gameStarted = false;
        this.state.running = false;
        this.state.finished = true;
        this.updateRoomMenu();
      }
    });

    this.networkManager.onChatMessage((playerName, message, senderId) => {
      // Recebe mensagem de chat
      // Adiciona apenas se NÃO for do próprio jogador
      if (senderId !== this.networkManager?.getClientId()) {
        this.console.addChatMessage(playerName, message);
      }
      
      // Se for host, retransmite para os outros clientes (exceto quem enviou)
      if (this.isHost && this.networkManager) {
        this.broadcastChatExcept(playerName, message, senderId);
      }
    });

    this.networkManager.onConsoleEvent((text, type) => {
      // Client recebe eventos do console do host
      this.console.addMessage(text, type);
    });
  }
}
