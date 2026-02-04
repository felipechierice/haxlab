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
}

export interface RoomPlayer {
  id: string;
  name: string;
  team: 'red' | 'blue' | 'spectator';
  ping?: number; // Latência em ms
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
  ballConfig: BallConfig;
}
