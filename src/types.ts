export interface Vector2D {
  x: number;
  y: number;
}

export interface Circle {
  pos: Vector2D;
  vel: Vector2D;
  radius: number;
  mass: number;
  damping: number;
  invMass: number;
}

export interface Segment {
  p1: Vector2D;
  p2: Vector2D;
  normal: Vector2D;
  bounce: number;
  playerCollision?: boolean;
}

export interface Goal {
  p1: Vector2D;
  p2: Vector2D;
  team: 'red' | 'blue';
}

export interface GameMap {
  width: number;
  height: number;
  segments: Segment[];
  goals: Goal[];
  spawnPoints: {
    red: Vector2D[];
    blue: Vector2D[];
    ball: Vector2D;
  };
}

export interface Player {
  id: string;
  name: string;
  team: 'red' | 'blue' | 'spectator';
  circle: Circle;
  input: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    kick: boolean;
  };
  kickCharge: number; // 0 a 1 (0% a 100%)
  isChargingKick: boolean;
  hasKickedThisPress: boolean; // Se já chutou durante este pressionamento da tecla
  kickFeedbackTime: number; // Tempo restante para mostrar feedback visual do chute (em segundos)
  isBot?: boolean;
  botBehavior?: BotBehavior;
  maxSpeedMultiplier?: number; // Multiplicador de velocidade máxima (0 a 1, padrão 1)
}

// ==================== NEW BOT INPUT SYSTEM ====================

/**
 * Direções possíveis de movimento (8 direções + parado)
 */
export type Direction = 
  | 'UP' 
  | 'DOWN' 
  | 'LEFT' 
  | 'RIGHT' 
  | 'UP_LEFT' 
  | 'UP_RIGHT' 
  | 'DOWN_LEFT' 
  | 'DOWN_RIGHT' 
  | null;

/**
 * Tipo de preset do bot
 */
export type BotPresetType = 'none' | 'patrol' | 'autonomous';

/**
 * Comportamento do bot (novo sistema unificado)
 */
export interface BotBehavior {
  preset: BotPresetType;
  config: NoneBehaviorConfig | PatrolBehaviorConfig | AutonomousBehaviorConfig;
}

/**
 * Preset None - Bot fica parado
 */
export interface NoneBehaviorConfig {
  kickOnContact?: boolean; // Chuta quando a bola encosta
}

/**
 * Comando de patrulha
 */
export interface PatrolCommand {
  action: 'move' | 'kick' | 'wait';
  direction?: Direction;
  durationMs: number;
}

/**
 * Preset Patrol - Sequência de comandos cronometrados
 */
export interface PatrolBehaviorConfig {
  commands: PatrolCommand[];
  loop?: boolean; // Repetir comandos (padrão: true)
}

/**
 * Estratégias de targeting para preset Autonomous
 */
export type AutonomousStrategy = 
  | 'chase_ball'       // Perseguir a bola
  | 'aim_at_goal'      // Posicionar para chutar no gol
  | 'mark_player'      // Marcar um jogador
  | 'intercept_ball'   // Interceptar trajetória da bola
  | 'stay_at_position'; // Manter posição fixa

/**
 * Preset Autonomous - IA dinâmica que calcula direções
 */
export interface AutonomousBehaviorConfig {
  strategy: AutonomousStrategy;
  
  // Parâmetros por estratégia
  targetPlayerId?: string;      // Para 'mark_player'
  targetPosition?: Vector2D;    // Para 'stay_at_position'
  keepDistance?: number;        // Distância mínima do alvo
  kickWhenAligned?: boolean;    // Chuta quando alinhado com o gol
  kickDistance?: number;        // Distância para ativar chute (padrão: 35)
  reactionDelayMs?: number;     // Delay de reação em ms (para simular humanidade)
}

export interface Ball {
  circle: Circle;
}

export interface GameState {
  players: Player[];
  ball: Ball;
  score: { red: number; blue: number };
  time: number;
  running: boolean;
  finished: boolean;
  winner: 'red' | 'blue' | 'draw' | null;
}

export interface BallConfig {
  radius: number;
  mass: number;
  damping: number;
  color: string;
  borderColor: string;
  borderWidth: number;
}

export interface GameConfig {
  timeLimit: number;
  scoreLimit: number;
  playersPerTeam: number;
  kickMode: 'classic' | 'chargeable';
  kickStrength: number;
  playerRadius: number;
  playerSpeed?: number; // Velocidade máxima do jogador (padrão 150)
  playerAcceleration?: number; // Aceleração do jogador (padrão 7.5)
  ballConfig: BallConfig;
  disableGoalReset?: boolean; // Se true, não reseta posições após gol
  kickSpeedMultiplier?: number; // Multiplicador de velocidade ao segurar chute (padrão 1.0)
  disableGameOver?: boolean; // Se true, não mostra tela de game over
  extrapolation?: number; // Tempo de extrapolation em ms (0-200, padrão 0 = desligado)
  interpolation?: boolean; // Se true, suaviza movimento entre frames (padrão true)
}

// Playlist System Types
export interface CheckpointObjective {
  type: 'checkpoint';
  position: Vector2D;
  radius: number;
  timeLimit?: number; // Tempo máximo para atingir este checkpoint (em segundos)
}

export interface PathObjective {
  type: 'path';
  points: Vector2D[]; // Sequência de pontos que formam o caminho
  width: number; // Largura do caminho
}

export interface GoalObjective {
  type: 'goal';
  team: 'red' | 'blue'; // Em qual gol precisa marcar
  scoredBy?: 'player' | 'bot'; // Quem deve fazer o gol (padrão: qualquer um)
  scoredByBotId?: string; // ID específico do bot que deve fazer o gol (apenas se scoredBy === 'bot')
}

export interface NoGoalObjective {
  type: 'no_goal';
  team: 'red' | 'blue'; // Qual gol não pode tomar
}

export interface KickCountObjective {
  type: 'kick_count';
  min?: number; // Número mínimo de chutes (se não especificado, sem mínimo)
  max?: number; // Número máximo de chutes (se não especificado, sem máximo)
  exact?: number; // Número exato de chutes (sobrescreve min/max se especificado)
}

export interface BallTouchObjective {
  type: 'ball_touch';
  targetBotId: string; // ID do bot que deve tocar na bola
  requiredTouches: number; // Número de toques necessários
  timeLimit?: number; // Tempo limite em segundos
}

export interface PreventTouchObjective {
  type: 'prevent_touch';
  preventBotIds: string[]; // IDs dos bots que NÃO devem tocar na bola
}

export type ScenarioObjective = CheckpointObjective | PathObjective | GoalObjective | NoGoalObjective | KickCountObjective | BallTouchObjective | PreventTouchObjective;

export interface Scenario {
  name: string;
  map: string; // 'default' | 'classic' ou nome de mapa customizado
  timeLimit: number; // Tempo limite para completar o cenário (segundos)
  objectives: ScenarioObjective[];
  initialBallVelocity?: Vector2D;
  initialPlayerVelocity?: Vector2D;
  ballSpawn?: Vector2D;
  playerSpawn?: Vector2D;
  bots?: BotDefinition[]; // Bots para este cenário
}

export interface BotDefinition {
  id: string;
  name: string;
  team: 'red' | 'blue';
  spawn: Vector2D;
  behavior: BotBehavior;
  initialVelocity?: Vector2D;
  radius?: number; // Raio customizado do bot (padrão: playerRadius da config)
}

export interface Playlist {
  name: string;
  description: string;
  scenarios: Scenario[];
  gameConfig?: Partial<GameConfig>; // Configurações de física opcionais (para garantir determinismo)
  randomizeOrder?: boolean; // Se true, os cenários são embaralhados antes de começar
}

export interface PlaylistProgress {
  currentScenarioIndex: number;
  completedScenarios: boolean[];
  scenarioStartTime: number;
  checkpointTimers: number[]; // Timer para cada checkpoint ativo
}
