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

// Bot AI Behaviors
export interface BotBehavior {
  type: 'programmed' | 'ai_preset';
  config: ProgrammedBehavior | AIPresetBehavior;
}

// Movimento totalmente programado pelo JSON
export interface ProgrammedBehavior {
  type: 'programmed';
  movements: ProgrammedMovement[];
  loop?: boolean; // Se deve repetir os movimentos
}

export interface ProgrammedMovement {
  duration: number; // Duração em segundos
  direction?: Vector2D; // Direção normalizada (-1 a 1 para cada eixo)
  speed?: number; // Velocidade (0 a 1, onde 1 = velocidade máxima)
  kick?: boolean; // Se deve chutar durante este movimento
}

// Comportamentos de IA predefinidos
export interface AIPresetBehavior {
  type: 'ai_preset';
  preset: 'chase_ball' | 'mark_player' | 'intercept' | 'stay_near' | 'patrol';
  params: ChaseBallParams | MarkPlayerParams | InterceptParams | StayNearParams | PatrolParams;
}

export interface ChaseBallParams {
  type: 'chase_ball';
  speed: number; // 0 a 1
  keepDistance?: number; // Distância mínima da bola
  kickWhenClose?: boolean; // Se deve chutar quando próximo
  kickDistance?: number; // Distância para chutar
  reactionTime?: number; // Tempo de reação em segundos (delay para mudar direção)
  aimAtGoal?: boolean; // Se deve se posicionar para chutar em direção ao gol
}

export interface MarkPlayerParams {
  type: 'mark_player';
  targetPlayerId?: string; // ID do jogador a marcar (se não especificado, marca o jogador controlado)
  distance: number; // Distância ideal para marcar
  speed: number; // 0 a 1
  reactionTime?: number; // Tempo de reação em segundos (delay para mudar direção)
  interceptLine?: {
    target: 'goal' | 'position' | 'bot';
    targetId?: string; // Se target for 'bot', ID do bot alvo
    targetPosition?: Vector2D; // Se target for 'position'
  };
}

export interface InterceptParams {
  type: 'intercept';
  speed: number; // 0 a 1
  predictBallPath: boolean; // Se deve prever o caminho da bola
  stealBall: boolean; // Se deve tentar roubar a bola quando próximo
  reactionTime?: number; // Tempo de reação em segundos (delay para mudar direção)
}

export interface StayNearParams {
  type: 'stay_near';
  position: Vector2D;
  radius: number; // Raio de movimento ao redor da posição
  speed: number; // 0 a 1
  reactionTime?: number; // Tempo de reação em segundos (delay para mudar direção)
  kickWhenBallNear?: boolean; // Se deve chutar quando a bola está próxima
  kickDistance?: number; // Distância para chutar a bola
}

export interface PatrolParams {
  type: 'patrol';
  points: Vector2D[]; // Pontos de patrulha
  speed: number; // 0 a 1
  waitTime?: number; // Tempo de espera em cada ponto (segundos)
  reactionTime?: number; // Tempo de reação em segundos (delay para mudar direção)
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
  ballConfig: BallConfig;
  disableGoalReset?: boolean; // Se true, não reseta posições após gol
  kickSpeedMultiplier?: number; // Multiplicador de velocidade ao segurar chute (padrão 0.5)
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
}

export interface Playlist {
  name: string;
  description: string;
  scenarios: Scenario[];
}

export interface PlaylistProgress {
  currentScenarioIndex: number;
  completedScenarios: boolean[];
  scenarioStartTime: number;
  checkpointTimers: number[]; // Timer para cada checkpoint ativo
}
