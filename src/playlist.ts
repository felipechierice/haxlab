import { 
  Playlist, 
  Scenario, 
  PlaylistProgress, 
  GameMap, 
  GameConfig,
  CheckpointObjective,
  PathObjective,
  GoalObjective,
  NoGoalObjective,
  KickCountObjective,
  BallTouchObjective,
  PreventTouchObjective,
  ScenarioObjective,
  Vector2D,
  Circle,
  BotBehavior,
  BotDefinition
} from './types.js';
import { Game } from './game.js';
import { Physics } from './physics.js';
import { DEFAULT_MAP, CLASSIC_MAP } from './maps.js';
import { audioManager } from './audio.js';
import { ReplayRecorder } from './replay.js';
import { KeyboardInputController, ReplayInputController } from './input/index.js';

/**
 * Converte comportamento de bot do formato antigo para o novo formato
 * Permite backward compatibility com playlists existentes
 */
function migrateBotBehavior(oldBehavior: any): BotBehavior {
  // Se já está no novo formato, retorna como está
  if (oldBehavior.preset && typeof oldBehavior.config === 'object' && !oldBehavior.config.type) {
    return oldBehavior as BotBehavior;
  }
  
  // Formato antigo: { type: 'ai_preset', config: { type: 'ai_preset', preset: 'idle', params: {...} } }
  if (oldBehavior.type === 'ai_preset' && oldBehavior.config?.type === 'ai_preset') {
    const oldPreset = oldBehavior.config.preset;
    const oldParams = oldBehavior.config.params || {};
    
    switch (oldPreset) {
      case 'idle':
        return {
          preset: 'none',
          config: {
            kickOnContact: oldParams.kickOnContact || false
          }
        };
      
      case 'chase_ball':
        return {
          preset: 'autonomous',
          config: {
            strategy: 'chase_ball',
            kickDistance: 35,
            reactionDelayMs: (oldParams.reactionTime || 0) * 1000
          }
        };
      
      case 'mark_player':
        return {
          preset: 'autonomous',
          config: {
            strategy: 'mark_player',
            targetPlayerId: 'local-0',
            keepDistance: oldParams.distance || 100,
            kickDistance: oldParams.kickOnContact ? 35 : 9999,
            reactionDelayMs: (oldParams.reactionTime || 0) * 1000
          }
        };
      
      case 'intercept':
        return {
          preset: 'autonomous',
          config: {
            strategy: 'intercept_ball',
            kickDistance: 35,
            reactionDelayMs: (oldParams.reactionTime || 0) * 1000
          }
        };
      
      case 'stay_near':
        return {
          preset: 'autonomous',
          config: {
            strategy: 'stay_at_position',
            targetPosition: oldParams.position || { x: 500, y: 300 },
            keepDistance: oldParams.radius || 50,
            reactionDelayMs: (oldParams.reactionTime || 0) * 1000
          }
        };
      
      case 'patrol':
        // Converter pontos de patrulha para comandos
        // Formato antigo: points: [{x, y, delay?}], speed, loop
        const oldPoints = oldParams.points || [];
        const commands: any[] = [];
        
        for (let i = 0; i < oldPoints.length; i++) {
          // Calcular direção para o próximo ponto
          const currentPoint = oldPoints[i];
          const nextPoint = oldPoints[(i + 1) % oldPoints.length];
          
          // Simplificação: usar direção predominante
          const dx = nextPoint.x - currentPoint.x;
          const dy = nextPoint.y - currentPoint.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Estimar duração baseado na velocidade antiga
          const speed = oldParams.speed || 0.6;
          const durationMs = distance / (speed * 300) * 1000; // Aproximação
          
          // Determinar direção
          let direction = 'RIGHT';
          const absX = Math.abs(dx);
          const absY = Math.abs(dy);
          if (absX > absY) {
            direction = dx > 0 ? 'RIGHT' : 'LEFT';
          } else if (absY > absX) {
            direction = dy > 0 ? 'DOWN' : 'UP';
          } else if (absX > 10 && absY > 10) {
            // Diagonal
            if (dx > 0 && dy > 0) direction = 'DOWN_RIGHT';
            else if (dx > 0 && dy < 0) direction = 'UP_RIGHT';
            else if (dx < 0 && dy > 0) direction = 'DOWN_LEFT';
            else direction = 'UP_LEFT';
          }
          
          commands.push({
            action: 'move',
            direction,
            durationMs: Math.max(500, durationMs)
          });
          
          // Adicionar espera se houver delay
          if (currentPoint.delay && currentPoint.delay > 0) {
            commands.push({
              action: 'wait',
              durationMs: currentPoint.delay * 1000
            });
          }
        }
        
        return {
          preset: 'patrol',
          config: {
            commands: commands.length > 0 ? commands : [
              { action: 'move', direction: 'RIGHT', durationMs: 1000 },
              { action: 'move', direction: 'LEFT', durationMs: 1000 }
            ],
            loop: oldParams.loop !== false
          }
        };
      
      default:
        // Fallback para none
        return {
          preset: 'none',
          config: {
            kickOnContact: false
          }
        };
    }
  }
  
  // Formato programmed antigo
  if (oldBehavior.type === 'programmed') {
    // Converter para patrol se tinha pontos
    return {
      preset: 'none',
      config: { kickOnContact: false }
    };
  }
  
  // Fallback para none
  return {
    preset: 'none',
    config: { kickOnContact: false }
  };
}

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
  private noGoalObjectives: NoGoalObjective[] = [];
  private ballTouchTimer: number = 0;
  private resetTimeoutId: number | null = null; // ID do timeout de reset automático
  private nextScenarioTimeoutId: number | null = null; // ID do timeout para próximo cenário
  private goalScored: boolean = false; // Rastreia se o gol foi marcado
  private disableAutoProgress: boolean = false; // Desabilita auto-reset/next após complete/fail
  
  // Tracking para ranking
  private playlistStartTime: number = 0;
  private totalKicks: number = 0;
  private totalPlaylistTime: number = 0; // Tempo acumulado de todos os cenários completados
  
  // Replay recording
  private replayRecorder: ReplayRecorder | null = null;
  private playerNickname: string = '';
  private communityPlaylistId: string | undefined;
  private keyboardInputController: KeyboardInputController | null = null;
  
  // Replay playback
  private replayInputController: ReplayInputController | null = null;
  private isReplayMode: boolean = false;
  private isTransitioningScenario: boolean = false; // Flag para ignorar callbacks durante transição
  private scenarioGeneration: number = 0; // Contador para identificar cenário atual
  private scenarioWarmupUntil: number = 0; // Timestamp até quando ignorar gols (warmup)
  
  constructor(
    canvas: HTMLCanvasElement,
    playlist: Playlist,
    baseConfig: GameConfig,
    callbacks: {
      onScenarioComplete: (index: number) => void;
      onPlaylistComplete: () => void;
      onScenarioFail: (reason: string) => void;
      onScenarioStart: (index: number) => void;
      disableAutoProgress?: boolean;
    }
  ) {
    this.canvas = canvas;
    this.playlist = playlist;
    this.baseConfig = baseConfig;
    this.onScenarioComplete = callbacks.onScenarioComplete;
    this.onPlaylistComplete = callbacks.onPlaylistComplete;
    this.onScenarioFail = callbacks.onScenarioFail;
    this.onScenarioStart = callbacks.onScenarioStart;
    this.disableAutoProgress = callbacks.disableAutoProgress ?? false;
    
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
    
    // Aplicar opacidade do indicador de controle se configurado
    const controlIndicatorOpacity = parseFloat(localStorage.getItem('controlIndicatorOpacity') || '0.3');
    this.game.setControlIndicatorOpacity(controlIndicatorOpacity);
    
    // Criar bots se existirem
    if (scenario.bots) {
      for (const botDef of scenario.bots) {
        // Migrar comportamento do formato antigo se necessário
        const migratedBehavior = migrateBotBehavior(botDef.behavior);
        
        this.game.addBot(
          botDef.id,
          botDef.name,
          botDef.team,
          botDef.spawn,
          migratedBehavior,
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
    
    // Sincronizar interpolação após setar posições customizadas
    this.game.syncInterpolation();
    
    // Preparar objetivos
    this.prepareObjectives(scenario);
    
    // Iniciar timer (usar o tempo do game state ao invés de Date.now())
    this.progress.scenarioStartTime = this.game.getState().time;
    this.scenarioFailed = false;
    this.scenarioCompleted = false;
    
    // Gravar início do cenário no replay
    // IMPORTANTE: Atualizar o tempo de simulação ANTES de gravar o cenário
    if (this.replayRecorder) {
      this.replayRecorder.updateSimulationTime(this.getPlaylistTime());
      this.replayRecorder.recordScenarioStart(index, false);
    }
    
    // Incrementar generation para invalidar callbacks de cenários anteriores
    this.scenarioGeneration++;
    const currentGeneration = this.scenarioGeneration;
    
    // Registrar callback customizado para renderização
    this.game.setCustomRenderCallback((ctx) => this.renderObjectives(ctx));
    
    // Registrar callback de update para validação
    this.game.setCustomUpdateCallback(() => this.updateObjectives());
    
    // Registrar callback para chutes
    this.game.setCustomKickCallback(() => this.onPlayerKick());
    
    // Registrar callback para toques na bola
    this.game.setCustomBallTouchCallback((playerId) => this.onBallTouch(playerId));
    
    // Registrar callback para gols com verificação de generation
    this.game.setCustomGoalCallback((team, scoredBy) => {
      if (currentGeneration !== this.scenarioGeneration) {
        console.log('[onGoal] Ignorando callback de cenário anterior');
        return;
      }
      this.onGoal(team, scoredBy);
    });
    
    // Resetar contador de toques
    this.game.resetBallTouches();
    
    // Iniciar com countdown configurado pelo usuário (padrão: 1 segundo)
    const countdownDuration = parseFloat(localStorage.getItem('scenarioCountdownDuration') || '1.0');
    this.game.startWithCountdown(countdownDuration);
    
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
    this.noGoalObjectives = [];
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
      } else if (objective.type === 'no_goal') {
        this.noGoalObjectives.push(objective);
      }
    }
  }
  
  private updateObjectives(): void {
    if (!this.game) return;
    
    const playlistTime = this.getPlaylistTime();
    
    // Atualizar tempo de simulação no replay recorder (gravação)
    if (this.replayRecorder) {
      this.replayRecorder.updateSimulationTime(playlistTime);
    }
    
    // Atualizar tempo no replay input controller (reprodução)
    if (this.replayInputController) {
      this.replayInputController.setPlaylistTime(playlistTime);
      
      // Verificar se o replay terminou
      if (this.replayInputController.isFinished() && !this.scenarioCompleted) {
        // Marcar todos cenários como completos e finalizar
        this.progress.completedScenarios.fill(true);
        this.scenarioCompleted = true;
        this.onPlaylistComplete();
        return;
      }
    }
    
    if (this.scenarioFailed || this.scenarioCompleted) return; // Não validar se já falhou ou completou
    
    const scenario = this.getCurrentScenario();
    if (!scenario) return;
    
    const ball = this.game.getBall();
    const elapsedTime = this.game.getState().time - this.progress.scenarioStartTime;
    
    // Verificar timeout do cenário
    if (elapsedTime > scenario.timeLimit) {
      // Se o cenário tem no_goal e NÃO tem goal objective, timeout = sucesso (sobreviveu)
      const hasGoalObjective = scenario.objectives.some(obj => obj.type === 'goal');
      const hasNoGoalObjective = this.noGoalObjectives.length > 0;
      if (hasNoGoalObjective && !hasGoalObjective) {
        this.completeScenario();
        return;
      }
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
      const validationResult = this.validateBallOnPathDebug(ball.circle, this.activePath);
      if (!validationResult.isOnPath) {
        console.log('[PATH FAIL DEBUG]', {
          ballPosition: { x: ball.circle.pos.x.toFixed(2), y: ball.circle.pos.y.toFixed(2) },
          ballRadius: ball.circle.radius,
          pathWidth: this.activePath.width,
          halfPathWidth: this.activePath.width / 2,
          allowedDistance: (this.activePath.width / 2 + ball.circle.radius / 2).toFixed(2),
          minDistanceToPath: validationResult.minDist.toFixed(2),
          pathPoints: this.activePath.points,
          pointDistances: validationResult.pointDistances.map(d => d.toFixed(2)),
          segmentDistances: validationResult.segmentDistances.map(d => d.toFixed(2))
        });
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
    // Encontrar a menor distância até o caminho (segmentos + pontos para lineCap round)
    let minDist = Infinity;
    
    // Verificar distância até cada ponto (para lineCap: 'round' nas extremidades e cantos)
    for (const point of path.points) {
      const dist = Physics.vectorLength(Physics.vectorSub(ball.pos, point));
      minDist = Math.min(minDist, dist);
    }
    
    // Verificar distância até cada segmento
    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i];
      const p2 = path.points[i + 1];
      
      // Calcular distância da bola até o segmento
      const dist = this.distanceToSegment(ball.pos, p1, p2);
      minDist = Math.min(minDist, dist);
    }
    
    // A bola falha quando pelo menos metade dela sair do caminho
    // Tolerância = metade do raio da bola (permite que até 50% saia)
    return minDist <= path.width / 2 + ball.radius / 2;
  }
  
  private validateBallOnPathDebug(ball: Circle, path: PathObjective): { isOnPath: boolean; minDist: number; segmentDistances: number[]; pointDistances: number[] } {
    // Encontrar a menor distância até o caminho (segmentos + pontos para lineCap round)
    let minDist = Infinity;
    const segmentDistances: number[] = [];
    const pointDistances: number[] = [];
    
    // Verificar distância até cada ponto (para lineCap: 'round' nas extremidades e cantos)
    for (const point of path.points) {
      const dist = Physics.vectorLength(Physics.vectorSub(ball.pos, point));
      pointDistances.push(dist);
      minDist = Math.min(minDist, dist);
    }
    
    // Verificar distância até cada segmento
    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i];
      const p2 = path.points[i + 1];
      
      // Calcular distância da bola até o segmento
      const dist = this.distanceToSegment(ball.pos, p1, p2);
      segmentDistances.push(dist);
      minDist = Math.min(minDist, dist);
    }
    
    // A bola falha quando pelo menos metade dela sair do caminho
    // Tolerância = metade do raio da bola (permite que até 50% saia)
    return { isOnPath: minDist <= path.width / 2 + ball.radius / 2, minDist, segmentDistances, pointDistances };
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
    
    // Se tem no_goal sem goal, cenário só completa por timeout (sobreviver até o fim)
    const hasNoGoalObjective = this.noGoalObjectives.length > 0;
    if (hasNoGoalObjective && !hasGoalObjective) {
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
    
    // Ignorar gols durante período de warmup (evita detecção falsa após iniciar cenário)
    if (Date.now() < this.scenarioWarmupUntil) {
      console.log('Warmup ativo, ignorando gol');
      return;
    }
    
    // Ignorar callbacks durante transição entre cenários
    if (this.isTransitioningScenario) {
      console.log('Transição em andamento, ignorando gol');
      return;
    }
    
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
    
    // Verificar objetivos no_goal - falhar se gol marcado no gol protegido
    for (const noGoalObj of this.noGoalObjectives) {
      // noGoalObj.team = qual gol não pode tomar gol
      // team = qual gol a bola entrou
      if (noGoalObj.team === team) {
        this.failScenario('Gol sofrido!');
        return;
      }
    }
    
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
    
    // NÃO acumular tempo aqui - será acumulado quando o próximo cenário começar
    // Isso permite que o tempo de delay (animação de gol, etc.) seja incluído
    
    this.progress.completedScenarios[this.progress.currentScenarioIndex] = true;
    
    // Som de sucesso
    audioManager.play('success');
    
    this.onScenarioComplete(this.progress.currentScenarioIndex);
    
    console.log('[CompleteScenario] disableAutoProgress:', this.disableAutoProgress, 'isReplayMode:', this.isReplayMode);
    console.log('[CompleteScenario] currentScenarioIndex:', this.progress.currentScenarioIndex, 'totalScenarios:', this.playlist.scenarios.length);
    
    // Se auto progress está desabilitado (modo replay), verificar se é o último cenário
    if (this.disableAutoProgress) {
      // Em modo replay, verificar se é o último cenário e se não há mais eventos de cenário
      if (this.isReplayMode && this.replayInputController) {
        const isLastScenario = this.progress.currentScenarioIndex === this.playlist.scenarios.length - 1;
        console.log('[CompleteScenario] isLastScenario:', isLastScenario);
        if (isLastScenario) {
          console.log('[CompleteScenario] Scheduling playlist complete in 2s');
          // Aguardar um pouco para o delay visual e então finalizar
          setTimeout(() => {
            console.log('[CompleteScenario] Calling onPlaylistComplete');
            this.progress.completedScenarios.fill(true);
            this.onPlaylistComplete();
          }, 2000);
        }
      }
      return;
    }
    
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
    
    // NÃO acumular tempo aqui - será acumulado quando o cenário for resetado/próximo
    // Isso permite que o tempo de delay seja incluído
    
    // Som de falha
    audioManager.play('fail');
    
    this.onScenarioFail(reason);
    
    // Se auto progress está desabilitado, não faz reset automático
    if (this.disableAutoProgress) return;
    
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
    if (this.activeCheckpoints.length > 0 && this.progress && this.game) {
      // Renderizar apenas o checkpoint atual
      if (this.currentCheckpointIndex < this.activeCheckpoints.length) {
        const checkpoint = this.activeCheckpoints[this.currentCheckpointIndex];
        const progress = this.progress; // TypeScript flow analysis
        const elapsedTime = this.game.getState().time - progress.scenarioStartTime;
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
    
    // Gravar reset no replay ANTES de acumular tempo
    // IMPORTANTE: Gravar com o tempo atual antes de modificar totalPlaylistTime
    if (this.replayRecorder) {
      this.replayRecorder.updateSimulationTime(this.getPlaylistTime());
      this.replayRecorder.recordScenarioStart(this.progress.currentScenarioIndex, true);
    }
    
    // Acumular tempo do cenário atual antes de resetar (incluindo tempo de delay)
    if (this.game) {
      const scenarioTime = this.game.getState().time - this.progress.scenarioStartTime;
      this.totalPlaylistTime += scenarioTime;
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
    
    // Acumular tempo do cenário atual (incluindo tempo de delay após complete)
    if (this.game) {
      const scenarioTime = this.game.getState().time - this.progress.scenarioStartTime;
      this.totalPlaylistTime += scenarioTime;
    }
    
    const nextIndex = this.progress.currentScenarioIndex + 1;
    if (nextIndex < this.playlist.scenarios.length) {
      this.startScenario(nextIndex);
    }
  }
  
  prevScenario(): void {
    // Acumular tempo do cenário atual se não foi já acumulado por fail/complete
    if (this.game && !this.scenarioCompleted && !this.scenarioFailed) {
      const scenarioTime = this.game.getState().time - this.progress.scenarioStartTime;
      this.totalPlaylistTime += scenarioTime;
    }
    
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
    
    // Limpar KeyboardInputController
    if (this.keyboardInputController) {
      this.keyboardInputController.setReplayRecorder(null);
      this.keyboardInputController.destroy();
      this.keyboardInputController = null;
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
  
  getGame(): Game | null {
    return this.game;
  }
  
  getTotalKicks(): number {
    return this.totalKicks;
  }
  
  getPlaylistTime(): number {
    // Retornar tempo acumulado dos cenários
    // Se há um jogo ativo, somar o tempo decorrido do cenário atual
    // IMPORTANTE: Continuar contando mesmo após complete/fail para incluir o tempo de delay
    if (this.game) {
      const currentScenarioTime = this.game.getState().time - this.progress.scenarioStartTime;
      return this.totalPlaylistTime + currentScenarioTime;
    }
    return this.totalPlaylistTime;
  }
  
  resetPlaylistStats(): void {
    this.totalKicks = 0;
    this.totalPlaylistTime = 0;
    this.playlistStartTime = Date.now();
  }
  
  /**
   * Inicia a gravação de replay
   */
  startReplayRecording(playerNickname: string, communityPlaylistId?: string): void {
    this.playerNickname = playerNickname;
    this.communityPlaylistId = communityPlaylistId;
    this.replayRecorder = new ReplayRecorder(
      this.playlist.name,
      playerNickname,
      communityPlaylistId
    );
    this.replayRecorder.start();
    
    // Criar KeyboardInputController em modo passivo para gravar inputs
    // Modo passivo: apenas grava eventos, não interfere no sistema de input do jogo
    this.keyboardInputController = new KeyboardInputController({ passiveMode: true });
    this.keyboardInputController.setReplayRecorder(this.replayRecorder);
  }
  
  /**
   * Para a gravação de replay e retorna os dados
   */
  stopReplayRecording(): ReplayRecorder | null {
    if (this.replayRecorder) {
      this.replayRecorder.stop();
    }
    // Limpar referência do KeyboardInputController
    if (this.keyboardInputController) {
      this.keyboardInputController.setReplayRecorder(null);
      this.keyboardInputController.destroy();
      this.keyboardInputController = null;
    }
    return this.replayRecorder;
  }
  
  /**
   * Obtém o replay recorder atual
   */
  getReplayRecorder(): ReplayRecorder | null {
    return this.replayRecorder;
  }
  
  /**
   * Define o replay input controller para reprodução de replays
   * O PlaylistMode vai sincronizar o tempo da playlist com este controller
   */
  setReplayInputController(controller: ReplayInputController | null): void {
    // Limpar callback do controller anterior
    if (this.replayInputController) {
      this.replayInputController.setScenarioEventCallback(null);
    }
    
    this.replayInputController = controller;
    this.isReplayMode = controller !== null;
    
    // Configurar callback para eventos de cenário
    if (controller) {
      controller.setScenarioEventCallback((scenarioInfo) => {
        this.handleReplayScenarioEvent(scenarioInfo);
      });
    }
  }
  
  /**
   * Processa evento de cenário durante reprodução de replay
   */
  private handleReplayScenarioEvent(scenarioInfo: { scenarioIndex: number; startTime: number; wasReset: boolean }): void {
    console.log('[Replay] handleReplayScenarioEvent called:', scenarioInfo);
    console.log('[Replay] Current totalPlaylistTime before:', this.totalPlaylistTime);
    
    // Marcar que estamos em transição para ignorar callbacks do jogo antigo
    this.isTransitioningScenario = true;
    
    // Atualizar o totalPlaylistTime para corresponder ao tempo de início deste cenário
    // O startTime está em milissegundos, converter para segundos
    this.totalPlaylistTime = scenarioInfo.startTime / 1000;
    
    console.log('[Replay] New totalPlaylistTime:', this.totalPlaylistTime);
    
    // Parar jogo atual
    if (this.game) {
      this.game.stop();
    }
    
    // Resetar flags
    this.scenarioFailed = false;
    this.scenarioCompleted = false;
    
    // Iniciar o cenário para replay
    console.log('[Replay] Starting scenario for replay:', scenarioInfo.scenarioIndex);
    this.startScenarioForReplay(scenarioInfo.scenarioIndex);
    
    // Fim da transição
    this.isTransitioningScenario = false;
  }
  
  /**
   * Inicia um cenário durante reprodução de replay
   * Diferente de startScenario, não acumula tempo nem grava no replay
   */
  private startScenarioForReplay(index: number): void {
    if (index < 0 || index >= this.playlist.scenarios.length) {
      console.error('Invalid scenario index for replay');
      return;
    }
    
    // IMPORTANTE: Resetar flags IMEDIATAMENTE antes de qualquer coisa
    // para evitar que callbacks pendentes do jogo anterior sejam ignorados
    this.scenarioFailed = false;
    this.scenarioCompleted = false;
    
    this.progress.currentScenarioIndex = index;
    const scenario = this.playlist.scenarios[index];
    
    // Parar jogo anterior se existir
    if (this.game) {
      this.game.stop();
    }
    
    // Carregar mapa
    const map = this.getMapForScenario(scenario);
    
    // Criar configuração para o jogo
    const gameConfig = { ...this.baseConfig, disableGoalReset: true, disableGameOver: true };
    
    // Criar jogo
    this.game = new Game(this.canvas, map, gameConfig);
    this.game.initPlayers();
    
    // Aplicar opacidade do indicador de controle
    const controlIndicatorOpacity = parseFloat(localStorage.getItem('controlIndicatorOpacity') || '0.3');
    this.game.setControlIndicatorOpacity(controlIndicatorOpacity);
    
    // Criar bots
    if (scenario.bots) {
      for (const botDef of scenario.bots) {
        const migratedBehavior = migrateBotBehavior(botDef.behavior);
        this.game.addBot(
          botDef.id,
          botDef.name,
          botDef.team,
          botDef.spawn,
          migratedBehavior,
          botDef.initialVelocity,
          botDef.radius
        );
      }
    }
    
    // Aplicar spawns customizados
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
    
    // Sincronizar interpolação
    this.game.syncInterpolation();
    
    // Preparar objetivos
    this.prepareObjectives(scenario);
    
    // Iniciar timer
    this.progress.scenarioStartTime = this.game.getState().time;
    this.scenarioFailed = false;
    this.scenarioCompleted = false;
    
    // Incrementar generation para invalidar callbacks de cenários anteriores
    this.scenarioGeneration++;
    const currentGeneration = this.scenarioGeneration;
    
    // Registrar callbacks com verificação de generation
    this.game.setCustomRenderCallback((ctx) => this.renderObjectives(ctx));
    this.game.setCustomUpdateCallback(() => this.updateObjectives());
    this.game.setCustomKickCallback(() => this.onPlayerKick());
    this.game.setCustomBallTouchCallback((playerId) => this.onBallTouch(playerId));
    this.game.setCustomGoalCallback((team, scoredBy) => {
      // Ignorar callbacks de cenários anteriores
      if (currentGeneration !== this.scenarioGeneration) {
        console.log('[onGoal] Ignorando callback de cenário anterior (generation mismatch)');
        return;
      }
      this.onGoal(team, scoredBy);
    });
    this.game.resetBallTouches();
    
    // Conectar o replay controller ao jogo
    if (this.replayInputController) {
      const players = this.game.getPlayers();
      if (players.length > 0) {
        this.game.setInputController(players[0].id, this.replayInputController);
      }
    }
    
    // Iniciar SEM countdown para replay (para manter sincronização)
    this.game.start();
    
    // Definir warmup de 100ms para ignorar gols "fantasmas" logo após iniciar
    this.scenarioWarmupUntil = Date.now() + 100;
    
    // Notificar que cenário iniciou
    this.onScenarioStart(index);
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
    
    // Reiniciar gravação de replay se estava gravando
    if (this.replayRecorder && this.playerNickname) {
      this.replayRecorder.restart();
    }
    
    // Iniciar primeiro cenário
    this.startScenario(0);
  }
}
