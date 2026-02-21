import { GameMap } from './types.js';

export const DEFAULT_MAP: GameMap = {
  width: 1000,
  height: 600,
  segments: [
    {
      p1: { x: 0, y: 0 },
      p2: { x: 1000, y: 0 },
      normal: { x: 0, y: 1 },
      bounce: 0.5,
      playerCollision: true
    },
    {
      p1: { x: 1000, y: 0 },
      p2: { x: 1000, y: 600 },
      normal: { x: -1, y: 0 },
      bounce: 0.5,
      playerCollision: true
    },
    {
      p1: { x: 1000, y: 600 },
      p2: { x: 0, y: 600 },
      normal: { x: 0, y: -1 },
      bounce: 0.5,
      playerCollision: true
    },
    {
      p1: { x: 0, y: 600 },
      p2: { x: 0, y: 0 },
      normal: { x: 1, y: 0 },
      bounce: 0.5,
      playerCollision: true
    },
    {
      p1: { x: 50, y: 50 },
      p2: { x: 950, y: 50 },
      normal: { x: 0, y: 1 },
      bounce: 0.5
    },
    {
      p1: { x: 950, y: 50 },
      p2: { x: 950, y: 225 },
      normal: { x: -1, y: 0 },
      bounce: 0.5
    },
    {
      p1: { x: 950, y: 375 },
      p2: { x: 950, y: 550 },
      normal: { x: -1, y: 0 },
      bounce: 0.5
    },
    {
      p1: { x: 950, y: 550 },
      p2: { x: 50, y: 550 },
      normal: { x: 0, y: -1 },
      bounce: 0.5
    },
    {
      p1: { x: 50, y: 550 },
      p2: { x: 50, y: 375 },
      normal: { x: 1, y: 0 },
      bounce: 0.5
    },
    {
      p1: { x: 50, y: 225 },
      p2: { x: 50, y: 50 },
      normal: { x: 1, y: 0 },
      bounce: 0.5
    }
  ],
  goals: [
    {
      p1: { x: 50, y: 225 },
      p2: { x: 50, y: 375 },
      team: 'red'
    },
    {
      p1: { x: 950, y: 225 },
      p2: { x: 950, y: 375 },
      team: 'blue'
    }
  ],
  goalposts: [
    // Gol vermelho (esquerdo)
    { pos: { x: 50, y: 225 }, radius: 8, bounce: 0.8, team: 'red' },
    { pos: { x: 50, y: 375 }, radius: 8, bounce: 0.8, team: 'red' },
    // Gol azul (direito)
    { pos: { x: 950, y: 225 }, radius: 8, bounce: 0.8, team: 'blue' },
    { pos: { x: 950, y: 375 }, radius: 8, bounce: 0.8, team: 'blue' }
  ],
  spawnPoints: {
    red: [
      { x: 200, y: 300 },
      { x: 300, y: 200 },
      { x: 300, y: 400 }
    ],
    blue: [
      { x: 800, y: 300 },
      { x: 700, y: 200 },
      { x: 700, y: 400 }
    ],
    ball: { x: 500, y: 300 }
  }
};

export const CLASSIC_MAP: GameMap = {
  width: 1000,
  height: 600,
  segments: [
    {
      p1: { x: 0, y: 0 },
      p2: { x: 1000, y: 0 },
      normal: { x: 0, y: 1 },
      bounce: 0.5,
      playerCollision: true
    },
    {
      p1: { x: 1000, y: 0 },
      p2: { x: 1000, y: 600 },
      normal: { x: -1, y: 0 },
      bounce: 0.5,
      playerCollision: true
    },
    {
      p1: { x: 1000, y: 600 },
      p2: { x: 0, y: 600 },
      normal: { x: 0, y: -1 },
      bounce: 0.5,
      playerCollision: true
    },
    {
      p1: { x: 0, y: 600 },
      p2: { x: 0, y: 0 },
      normal: { x: 1, y: 0 },
      bounce: 0.5,
      playerCollision: true
    },
    {
      p1: { x: 100, y: 100 },
      p2: { x: 900, y: 100 },
      normal: { x: 0, y: 1 },
      bounce: 0.5
    },
    {
      p1: { x: 900, y: 100 },
      p2: { x: 900, y: 240 },
      normal: { x: -1, y: 0 },
      bounce: 0.5
    },
    {
      p1: { x: 900, y: 360 },
      p2: { x: 900, y: 500 },
      normal: { x: -1, y: 0 },
      bounce: 0.5
    },
    {
      p1: { x: 900, y: 500 },
      p2: { x: 100, y: 500 },
      normal: { x: 0, y: -1 },
      bounce: 0.5
    },
    {
      p1: { x: 100, y: 500 },
      p2: { x: 100, y: 360 },
      normal: { x: 1, y: 0 },
      bounce: 0.5
    },
    {
      p1: { x: 100, y: 240 },
      p2: { x: 100, y: 100 },
      normal: { x: 1, y: 0 },
      bounce: 0.5
    }
  ],
  goals: [
    {
      p1: { x: 100, y: 240 },
      p2: { x: 100, y: 360 },
      team: 'red'
    },
    {
      p1: { x: 900, y: 240 },
      p2: { x: 900, y: 360 },
      team: 'blue'
    }
  ],
  goalposts: [
    // Gol vermelho (esquerdo)
    { pos: { x: 100, y: 240 }, radius: 8, bounce: 0.8, team: 'red' },
    { pos: { x: 100, y: 360 }, radius: 8, bounce: 0.8, team: 'red' },
    // Gol azul (direito)
    { pos: { x: 900, y: 240 }, radius: 8, bounce: 0.8, team: 'blue' },
    { pos: { x: 900, y: 360 }, radius: 8, bounce: 0.8, team: 'blue' }
  ],
  spawnPoints: {
    red: [
      { x: 250, y: 300 },
      { x: 350, y: 250 },
      { x: 350, y: 350 }
    ],
    blue: [
      { x: 750, y: 300 },
      { x: 650, y: 250 },
      { x: 650, y: 350 }
    ],
    ball: { x: 500, y: 300 }
  }
};
