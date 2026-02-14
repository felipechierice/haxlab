import { 
  Playlist, 
  Scenario, 
  PlaylistProgress, 
  GameMap, 
  GameConfig,
  CheckpointObjective,
  PathObjective,
  GoalObjective,
  KickCountObjective,
  BallTouchObjective,
  PreventTouchObjective,
  ScenarioObjective,
  Vector2D,
  Circle
} from './types.js';
import { Game } from './game.js';
import { Physics } from './physics.js';
import { DEFAULT_MAP, CLASSIC_MAP } from './maps.js';
import { audioManager } from './audio.js';

export class PlaylistMode {
  private playlist: Playlist;
  private progress: PlaylistProgress;
  private game: Game | null = null;
  private canvas: HTMLCanvasElement;
  private baseConfig: GameConfig;
  private onScenarioComplete: (scenarioIndex: number) => void;
  private onPlaylistComplete: () => void;
  private onScenarioFail: (reason: string) => void;
  private onScenarioStart: (scenarioIndex: number) => void;
  
  private activeCheckpoints: CheckpointObjective[] = [];
  private currentCheckpointIndex: number = 0;
  private currentCheckpointStartTime: number = 0; // Tempo em que o checkpoint atual foi ativado
  private activePath: PathObjective | null = null;
  private pathProgress: number = 0; // Progresso no caminho (0 a 1)
  private scenarioFailed: boolean = false;
  private scenarioCompleted: boolean = false;
  private kickCount: number = 0;
  private kickObjective: KickCountObjective | null = null;
  private ballTouchObjective: BallTouchObjective | null = null;
  private preventTouchObjective: PreventTouchObjective | null = null;
  private ballTouchTimer: number = 0;
  private resetTimeoutId: number | null = null; // ID do timeout de reset automático
  private nextScenarioTimeoutId: number | null = null; // ID do timeout para próximo cenário
  private goalScored: boolean = false; // Rastreia se o gol foi marcado
  
  // Tracking para ranking
  private playlistStartTime: number = 0;
  private totalKicks: number = 0;
  
  constructor(
    canvas: HTMLCanvasElement,
    playlist: Playlist,
    baseConfig: GameConfig,
    callbacks: {
      onScenarioComplete: (index: number) => void;
      onPlaylistComplete: () => void;
      onScenarioFail: (reason: string) => void;
      onScenarioStart: (index: number) => void;
    }
  ) {
    this.canvas = canvas;
    this.playlist = playlist;
    this.baseConfig = baseConfig;
    this.onScenarioComplete = callbacks.onScenarioComplete;
    this.onPlaylistComplete = callbacks.onPlaylistComplete;
    this.onScenarioFail = callbacks.onScenarioFail;
    this.onScenarioStart = callbacks.onScenarioStart;
    
    this.progress = {
      currentScenarioIndex: 0,
      completedScenarios: new Array(playlist.scenarios.length).fill(false),
      scenarioStartTime: 0,
      checkpointTimers: []
    };
  }
  
  startScenario(index: number): void {
    if (index < 0 || index >= this.playlist.scenarios.length) {
      console.error('Invalid scenario index');
      return;
    }
    
    this.progress.currentScenarioIndex = index;
    const scenario = this.playlist.scenarios[index];
    
    // Parar jogo anterior se existir
    if (this.game) {
      this.game.stop();
    }
    
    // Carregar mapa
    const map = this.getMapForScenario(scenario);
    
    // Criar configuração para o jogo com reset de gol e game over desabilitados
    const gameConfig = { ...this.baseConfig, disableGoalReset: true, disableGameOver: true };
    
    // Criar jogo
    this.game = new Game(this.canvas, map, gameConfig);
    this.game.initPlayers();
    
    // Criar bots se existirem
    if (scenario.bots) {
      for (const botDef of scenario.bots) {
        this.game.addBot(
          botDef.id,
          botDef.name,
          botDef.team,
          botDef.spawn,
          botDef.behavior,
          botDef.initialVelocity,
          botDef.radius
        );
      }
    }
    
    // Aplicar spawns customizados se existirem
    if (scenario.playerSpawn) {
      const player = this.game.getPlayers()[0];
      if (player) {
        player.circle.pos.x = scenario.playerSpawn.x;
        player.circle.pos.y = scenario.playerSpawn.y;
      }
    }
    
    if (scenario.ballSpawn) {
      const ball = this.game.getBall();
      ball.circle.pos.x = scenario.ballSpawn.x;
      ball.circle.pos.y = scenario.ballSpawn.y;
    }
    
    // Aplicar velocidades iniciais
    if (scenario.initialPlayerVelocity) {
      const player = this.game.getPlayers()[0];
      if (player) {
        player.circle.vel.x = scenario.initialPlayerVelocity.x;
        player.circle.vel.y = scenario.initialPlayerVelocity.y;
      }
    }
    
    if (scenario.initialBallVelocity) {
      const ball = this.game.getBall();
      ball.circle.vel.x = scenario.initialBallVelocity.x;
      ball.circle.vel.y = scenario.initialBallVelocity.y;
    }
    
    // Preparar objetivos
    this.prepareObjectives(scenario);
    
    // Iniciar timer
    this.progress.scenarioStartTime = Date.now();
    this.scenarioFailed = false;
    this.scenarioCompleted = false;
    
    // Registrar callback customizado para renderização
    this.game.setCustomRenderCallback((ctx) => this.renderObjectives(ctx));
    
    // Registrar callback de update para validação
    this.game.setCustomUpdateCallback(() => this.updateObjectives());
    
    // Registrar callback para chutes
    this.game.setCustomKickCallback(() => this.onPlayerKick());
    
    // Registrar callback para toques na bola
    this.game.setCustomBallTouchCallback((playerId) => this.onBallTouch(playerId));
    
    // Registrar callback para gols
    this.game.setCustomGoalCallback((team, scoredBy) => this.onGoal(team, scoredBy));
    
    // Resetar contador de toques
    this.game.resetBallTouches();
    
    this.game.start();
    
    // Notificar que cenário iniciou
    this.onScenarioStart(index);
  }
  
  private prepareObjectives(scenario: Scenario): void {
    this.activeCheckpoints = [];
    this.currentCheckpointIndex = 0;
    this.currentCheckpointStartTime = 0;
    this.activePath = null;
    this.pathProgress = 0;
    this.progress.checkpointTimers = [];
    this.kickCount = 0;
    this.kickObjective = null;
    this.ballTouchObjective = null;
    this.preventTouchObjective = null;
    this.ballTouchTimer = 0;
    this.goalScored = false;
    
    // Separar checkpoints, path e kick objectives
    for (const objective of scenario.objectives) {
      if (objective.type === 'checkpoint') {
        this.activeCheckpoints.push(objective);
        this.progress.checkpointTimers.push(0);
      } else if (objective.type === 'path') {
        this.activePath = objective;
      } else if (objective.type === 'kick_count') {
        this.kickObjective = objective;
      } else if (objective.type === 'ball_touch') {
        this.ballTouchObjective = objective;
      } else if (objective.type === 'prevent_touch') {
        this.preventTouchObjective = objective;
      }
    }
  }
  
  private updateObjectives(): void {
    if (!this.game) return;
    if (this.scenarioFailed || this.scenarioCompleted) return; // Não validar se já falhou ou completou
    
    const scenario = this.getCurrentScenario();
    if (!scenario) return;
    
    const ball = this.game.getBall();
    const elapsedTime = (Date.now() - this.progress.scenarioStartTime) / 1000;
    
    // Verificar timeout do cenário
    if (elapsedTime > scenario.timeLimit) {
      this.failScenario('Tempo esgotado!');
      return;
    }
    
    // Verificar timer de ball touch objective se existir (usa o tempo real, não frame count)
    if (this.ballTouchObjective && this.ballTouchObjective.timeLimit) {
      if (elapsedTime > this.ballTouchObjective.timeLimit) {
        this.failScenario('Tempo esgotado para tocar na bola!');
        return;
      }
    }
    
    // Validar path sempre que existe (independente de checkpoints)
    if (this.activePath) {
      if (!this.validateBallOnPath(ball.circle, this.activePath)) {
        this.failScenario('Bola saiu do caminho!');
        return;
      }
    }
    
    // Atualizar checkpoints
    if (this.activeCheckpoints.length > 0 && this.currentCheckpointIndex < this.activeCheckpoints.length) {
      const checkpoint = this.activeCheckpoints[this.currentCheckpointIndex];
      
      // Inicializar tempo de início do checkpoint se for a primeira vez
      if (this.currentCheckpointStartTime === 0) {
        this.currentCheckpointStartTime = elapsedTime;
      }
      
      // Calcular tempo decorrido no checkpoint atual
      const checkpointElapsedTime = elapsedTime - this.currentCheckpointStartTime;
      
      // Verificar se o tempo do checkpoint esgotou
      if (checkpoint.timeLimit && checkpointElapsedTime > checkpoint.timeLimit) {
        this.failScenario(`Checkpoint ${this.currentCheckpointIndex + 1} não atingido a tempo!`);
        return;
      }
      
      // Verificar se a bola atingiu o checkpoint
      const dist = Physics.vectorLength(Physics.vectorSub(ball.circle.pos, checkpoint.position));
      if (dist <= checkpoint.radius) {
        // Checkpoint atingido!
        this.currentCheckpointIndex++;
        this.currentCheckpointStartTime = 0; // Resetar para o próximo checkpoint
        
        // Se completou todos os checkpoints, verificar outros objetivos
        if (this.currentCheckpointIndex >= this.activeCheckpoints.length) {
          this.checkScenarioCompletion();
        }
      }
    } else if (this.activeCheckpoints.length === 0) {
      // Se não há checkpoints, verificar se pode completar com outros objetivos
      this.checkScenarioCompletion();
    }
    
    // Verificar objetivos de gol
    for (const objective of scenario.objectives) {
      if (objective.type === 'goal') {
        // Será checado pelo sistema de gol do Game
        // TODO: Integrar com evento de gol
      }
    }
  }
  
  private validateBallOnPath(ball: Circle, path: PathObjective): boolean {
    // Encontrar o segmento mais próximo do caminho
    let minDist = Infinity;
    
    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i];
      const p2 = path.points[i + 1];
      
      // Calcular distância da bola até o segmento
      const dist = this.distanceToSegment(ball.pos, p1, p2);
      minDist = Math.min(minDist, dist);
    }
    
    // Se a distância mínima for maior que a largura do caminho, saiu do caminho
    return minDist <= path.width / 2;
  }
  
  private distanceToSegment(point: Vector2D, p1: Vector2D, p2: Vector2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSq = dx * dx + dy * dy;
    
    if (lengthSq === 0) return Physics.vectorLength(Physics.vectorSub(point, p1));
    
    let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    
    const closest = {
      x: p1.x + t * dx,
      y: p1.y + t * dy
    };
    
    return Physics.vectorLength(Physics.vectorSub(point, closest));
  }
  
  private checkScenarioCompletion(): void {
    const scenario = this.getCurrentScenario();
    if (!scenario) return;
    
    // Verificar se todos os objetivos foram completados
    let allCompleted = true;
    
    // Checkpoints já foram validados (se existirem)
    if (this.activeCheckpoints.length > 0 && this.currentCheckpointIndex < this.activeCheckpoints.length) {
      allCompleted = false;
    }
    
    // Verificar se precisa de gol
    const hasGoalObjective = scenario.objectives.some(obj => obj.type === 'goal');
    if (hasGoalObjective && !this.goalScored) {
      allCompleted = false;
    }
    
    // Validar objetivo de chutes se existe
    if (this.kickObjective) {
      if (!this.validateKickObjective()) {
        allCompleted = false;
      }
    }
    
    // Validar objetivo de toques na bola se existe
    if (this.ballTouchObjective) {
      if (!this.validateBallTouchObjective()) {
        allCompleted = false;
      }
    }
    
    if (allCompleted) {
      this.completeScenario();
    }
  }
  
  private onBallTouch(playerId: string): void {
    if (this.scenarioFailed || this.scenarioCompleted) return;
    if (!this.game) return;
    
    // Verificar se tocou em bot que não deveria
    if (this.preventTouchObjective) {
      if (this.preventTouchObjective.preventBotIds.includes(playerId)) {
        this.failScenario(`Bola tocou em bot adversário!`);
        return;
      }
    }
    
    // Verificar objetivo de tocar na bola
    if (this.ballTouchObjective) {
      if (playerId === this.ballTouchObjective.targetBotId) {
        const touches = this.game.getBallTouches(playerId);
        if (touches >= this.ballTouchObjective.requiredTouches) {
          // Objetivo completo! Verificar se pode completar cenário
          this.checkScenarioCompletion();
        }
      }
    }
  }
  
  private onGoal(team: 'red' | 'blue', scoredBy?: { id: string, name: string, team: 'red' | 'blue', isBot: boolean }): void {
    console.log('=== onGoal called ===');
    console.log('team (gol onde bola entrou):', team);
    console.log('scoredBy:', scoredBy);
    
    if (this.scenarioFailed || this.scenarioCompleted) {
      console.log('Cenário já falhou ou completou, ignorando');
      return;
    }
    
    const scenario = this.getCurrentScenario();
    if (!scenario) {
      console.log('Sem cenário atual');
      return;
    }
    
    // Verificar se é o gol correto
    // team = qual gol a bola entrou ('red' = gol vermelho, 'blue' = gol azul)
    // Se a bola entrou no gol VERMELHO, o time AZUL marca ponto
    // Se a bola entrou no gol AZUL, o time VERMELHO marca ponto
    const scoringTeam = team === 'red' ? 'blue' : 'red';
    console.log('scoringTeam (time que marcou ponto):', scoringTeam);
    
    const goalObjective = scenario.objectives.find(obj => obj.type === 'goal') as GoalObjective | undefined;
    console.log('goalObjective:', goalObjective);
    
    if (goalObjective) {
      console.log('goalObjective.team:', goalObjective.team);
      console.log('Comparando: goalObjective.team === scoringTeam?', goalObjective.team === scoringTeam);
      
      if (goalObjective.team === scoringTeam) {
        // Verificar restrições de quem pode fazer o gol
        if (goalObjective.scoredBy === 'player') {
          // Só o player pode fazer o gol
          if (!scoredBy || scoredBy.isBot) {
            this.failScenario('O jogador deve fazer o gol!');
            return;
          }
        } else if (goalObjective.scoredBy === 'bot') {
          console.log('Objetivo requer bot');
          console.log('scoredBy.isBot:', scoredBy?.isBot);
          
          // Só um bot pode fazer o gol
          if (!scoredBy || !scoredBy.isBot) {
            console.log('FALHA: não é bot');
            this.failScenario('Um bot aliado deve fazer o gol!');
            return;
          }
          
          // Verificar se o bot é do time que está marcando ponto
          console.log('scoredBy.team:', scoredBy.team);
          console.log('Comparando: scoredBy.team !== scoringTeam?', scoredBy.team !== scoringTeam);
          if (scoredBy.team !== scoringTeam) {
            console.log('FALHA: bot do time errado');
            this.failScenario('Um bot aliado deve fazer o gol!');
            return;
          }
          
          // Verificar se é um bot específico
          if (goalObjective.scoredByBotId && scoredBy.id !== goalObjective.scoredByBotId) {
            this.failScenario(`O bot específico deve fazer o gol!`);
            return;
          }
        }
        
        console.log('GOL VÁLIDO! Marcando como sucesso');
        this.goalScored = true;
        // Verificar se pode completar cenário
        this.checkScenarioCompletion();
      } else {
        console.log('Time errado marcou gol, ignorando');
      }
    }
  }
  
  private onPlayerKick(): void {
    if (this.scenarioFailed || this.scenarioCompleted) return;
    
    this.kickCount++;
    this.totalKicks++; // Rastrear kicks totais da playlist
    
    // Verificar se excedeu o máximo de chutes
    if (this.kickObjective) {
      const max = this.kickObjective.exact !== undefined ? this.kickObjective.exact : this.kickObjective.max;
      if (max !== undefined && this.kickCount > max) {
        this.failScenario(`Chutes demais! Máximo: ${max}`);
      }
    }
  }
  
  private validateKickObjective(): boolean {
    if (!this.kickObjective) return true;
    
    // Se especificou número exato
    if (this.kickObjective.exact !== undefined) {
      return this.kickCount === this.kickObjective.exact;
    }
    
    // Verificar mínimo
    if (this.kickObjective.min !== undefined && this.kickCount < this.kickObjective.min) {
      return false;
    }
    
    // Verificar máximo
    if (this.kickObjective.max !== undefined && this.kickCount > this.kickObjective.max) {
      return false;
    }
    
    return true;
  }
  
  private validateBallTouchObjective(): boolean {
    if (!this.ballTouchObjective || !this.game) return true;
    
    const touches = this.game.getBallTouches(this.ballTouchObjective.targetBotId);
    return touches >= this.ballTouchObjective.requiredTouches;
  }
  
  private completeScenario(): void {
    if (this.scenarioCompleted) return; // Evitar múltiplas chamadas
    this.scenarioCompleted = true;
    this.progress.completedScenarios[this.progress.currentScenarioIndex] = true;
    
    // Som de sucesso
    audioManager.play('success');
    
    this.onScenarioComplete(this.progress.currentScenarioIndex);
    
    // Verificar se completou toda a playlist
    if (this.progress.completedScenarios.every(completed => completed)) {
      this.onPlaylistComplete();
    } else {
      // Avançar para próximo cenário
      this.nextScenarioTimeoutId = window.setTimeout(() => {
        this.nextScenarioTimeoutId = null;
        this.nextScenario();
      }, 2000);
    }
  }
  
  private failScenario(reason: string): void {
    if (this.scenarioFailed) return; // Evitar múltiplas chamadas
    this.scenarioFailed = true;
    
    // Som de falha
    audioManager.play('fail');
    
    this.onScenarioFail(reason);
    this.resetTimeoutId = window.setTimeout(() => {
      this.resetTimeoutId = null;
      this.resetScenario();
    }, 1500);
  }
  
  private renderObjectives(ctx: CanvasRenderingContext2D): void {
    // Renderizar path se existe
    if (this.activePath) {
      this.renderPath(ctx, this.activePath);
    }
    
    // Renderizar checkpoints
    if (this.activeCheckpoints.length > 0) {
      // Renderizar apenas o checkpoint atual
      if (this.currentCheckpointIndex < this.activeCheckpoints.length) {
        const checkpoint = this.activeCheckpoints[this.currentCheckpointIndex];
        const elapsedTime = (Date.now() - this.progress.scenarioStartTime) / 1000;
        const checkpointElapsedTime = this.currentCheckpointStartTime > 0 ? elapsedTime - this.currentCheckpointStartTime : 0;
        this.renderCheckpoint(ctx, checkpoint, checkpointElapsedTime);
      }
    }
  }
  
  private renderPath(ctx: CanvasRenderingContext2D, path: PathObjective): void {
    if (path.points.length < 2) return;
    
    ctx.save();
    ctx.strokeStyle = 'rgba(100, 255, 100, 0.12)';
    ctx.lineWidth = path.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);
    
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(path.points[i].x, path.points[i].y);
    }
    
    ctx.stroke();
    
    // Desenhar bordas do caminho
    ctx.strokeStyle = 'rgba(100, 255, 100, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
  }
  
  private renderCheckpoint(ctx: CanvasRenderingContext2D, checkpoint: CheckpointObjective, elapsedTime: number): void {
    ctx.save();
    
    // Círculo externo (checkpoint)
    ctx.beginPath();
    ctx.arc(checkpoint.position.x, checkpoint.position.y, checkpoint.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
    ctx.fill();
    
    // Círculo interno (timer) se houver time limit
    if (checkpoint.timeLimit) {
      const timeRemaining = Math.max(0, checkpoint.timeLimit - elapsedTime);
      const progress = timeRemaining / checkpoint.timeLimit;
      const innerRadius = checkpoint.radius * progress;
      
      ctx.beginPath();
      ctx.arc(checkpoint.position.x, checkpoint.position.y, innerRadius, 0, Math.PI * 2);
      
      // Cor muda de verde para vermelho conforme o tempo passa
      const red = Math.floor(255 * (1 - progress));
      const green = Math.floor(255 * progress);
      ctx.fillStyle = `rgba(${red}, ${green}, 0, 0.4)`;
      ctx.fill();
      
      // Texto com tempo restante
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(timeRemaining.toFixed(1) + 's', checkpoint.position.x, checkpoint.position.y);
    }
    
    ctx.restore();
  }
  
  private getMapForScenario(scenario: Scenario): GameMap {
    switch (scenario.map) {
      case 'classic':
        return CLASSIC_MAP;
      case 'default':
      default:
        return DEFAULT_MAP;
    }
  }
  
  getCurrentScenario(): Scenario | null {
    if (this.progress.currentScenarioIndex >= 0 && this.progress.currentScenarioIndex < this.playlist.scenarios.length) {
      return this.playlist.scenarios[this.progress.currentScenarioIndex];
    }
    return null;
  }
  
  resetScenario(): void {
    // Cancelar timeout de reset automático se existir
    if (this.resetTimeoutId !== null) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    this.startScenario(this.progress.currentScenarioIndex);
  }
  
  nextScenario(): void {
    // Cancelar timeouts pendentes
    if (this.resetTimeoutId !== null) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    if (this.nextScenarioTimeoutId !== null) {
      clearTimeout(this.nextScenarioTimeoutId);
      this.nextScenarioTimeoutId = null;
    }
    
    const nextIndex = this.progress.currentScenarioIndex + 1;
    if (nextIndex < this.playlist.scenarios.length) {
      this.startScenario(nextIndex);
    }
  }
  
  prevScenario(): void {
    const prevIndex = this.progress.currentScenarioIndex - 1;
    if (prevIndex >= 0) {
      this.startScenario(prevIndex);
    }
  }
  
  stop(): void {
    // Limpar timeouts pendentes
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    if (this.nextScenarioTimeoutId) {
      clearTimeout(this.nextScenarioTimeoutId);
      this.nextScenarioTimeoutId = null;
    }
    
    // Parar o jogo
    if (this.game) {
      this.game.stop();
      this.game = null;
    }
  }
  
  getProgress(): PlaylistProgress {
    return this.progress;
  }
  
  getPlaylist(): Playlist {
    return this.playlist;
  }
  
  getTotalKicks(): number {
    return this.totalKicks;
  }
  
  getPlaylistTime(): number {
    if (this.playlistStartTime === 0) return 0;
    return (Date.now() - this.playlistStartTime) / 1000;
  }
  
  resetPlaylistStats(): void {
    this.totalKicks = 0;
    this.playlistStartTime = Date.now();
  }
  
  restartPlaylist(): void {
    // Limpar timeouts pendentes de falha/sucesso
    if (this.resetTimeoutId !== null) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    if (this.nextScenarioTimeoutId !== null) {
      clearTimeout(this.nextScenarioTimeoutId);
      this.nextScenarioTimeoutId = null;
    }
    
    // Resetar progresso
    this.progress.currentScenarioIndex = 0;
    this.progress.completedScenarios = new Array(this.playlist.scenarios.length).fill(false);
    this.progress.scenarioStartTime = 0;
    this.progress.checkpointTimers = [];
    
    // Resetar estatísticas
    this.resetPlaylistStats();
    
    // Iniciar primeiro cenário
    this.startScenario(0);
  }
}
