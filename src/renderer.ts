import { GameState, GameMap, Circle, Segment, Goal, Vector2D, BallConfig } from './types.js';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  
  // Constantes pré-calculadas
  private readonly PI2 = Math.PI * 2;
  private readonly halfWidth: number;
  private readonly halfHeight: number;
  
  // Cache de cores
  private readonly colors = {
    background: '#1a1a2e',
    white: '#ffffff',
    red: '#ff4757',
    blue: '#5352ed',
    line: '#444',
    indicator: '#fff700'
  };

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not get canvas context');
    
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
    this.halfWidth = canvas.width / 2;
    this.halfHeight = canvas.height / 2;
  }

  private clear(): void {
    this.ctx.fillStyle = this.colors.background;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawMap(map: GameMap): void {
    const ctx = this.ctx;
    
    // Desenha segmentos
    ctx.strokeStyle = this.colors.white;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const segment of map.segments) {
      ctx.moveTo(segment.p1.x, segment.p1.y);
      ctx.lineTo(segment.p2.x, segment.p2.y);
    }
    ctx.stroke();

    // Desenha gols
    for (const goal of map.goals) {
      ctx.strokeStyle = goal.team === 'red' ? this.colors.red : this.colors.blue;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(goal.p1.x, goal.p1.y);
      ctx.lineTo(goal.p2.x, goal.p2.y);
      ctx.stroke();
    }

    // Linha central
    ctx.strokeStyle = this.colors.line;
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.halfWidth, 50);
    ctx.lineTo(this.halfWidth, this.height - 50);
    ctx.stroke();
    ctx.setLineDash([]);

    // Círculo central
    ctx.beginPath();
    ctx.arc(this.halfWidth, this.halfHeight, 80, 0, this.PI2);
    ctx.stroke();
  }

  private drawCircle(x: number, y: number, radius: number, color: string, outline: boolean): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, this.PI2);
    ctx.fill();

    if (outline) {
      ctx.strokeStyle = this.colors.white;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  private drawBallWithConfig(x: number, y: number, radius: number, ballConfig: BallConfig): void {
    const ctx = this.ctx;
    ctx.fillStyle = ballConfig.color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, this.PI2);
    ctx.fill();

    if (ballConfig.borderWidth > 0) {
      ctx.strokeStyle = ballConfig.borderColor;
      ctx.lineWidth = ballConfig.borderWidth;
      ctx.stroke();
    }
  }

  private drawControlIndicator(x: number, y: number, radius: number, rotation: number): void {
    const ctx = this.ctx;
    const indicatorRadius = radius + 10;
    const segments = 10;
    
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = this.colors.indicator;
    ctx.lineWidth = 4;
    
    const segmentArc = this.PI2 / segments;
    const halfSegment = segmentArc * 0.5;
    
    for (let i = 0; i < segments; i++) {
      const startAngle = i * segmentArc + rotation;
      const endAngle = startAngle + halfSegment;
      
      ctx.beginPath();
      ctx.arc(x, y, indicatorRadius, startAngle, endAngle);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  drawState(state: GameState, map: GameMap, controlledPlayerId?: string, time: number = 0, ballConfig?: BallConfig): void {
    this.clear();
    this.drawMap(map);

    // Bola
    const ball = state.ball.circle;
    if (ballConfig) {
      this.drawBallWithConfig(ball.pos.x, ball.pos.y, ball.radius, ballConfig);
    } else {
      this.drawCircle(ball.pos.x, ball.pos.y, ball.radius, this.colors.white, true);
    }

    // Jogadores
    const rotation = time * 3;
    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      const color = player.team === 'red' ? this.colors.red : this.colors.blue;
      const circle = player.circle;
      
      this.drawCircle(circle.pos.x, circle.pos.y, circle.radius, color, true);
      
      // Desenha indicador de força de chute se estiver carregando
      if (player.kickCharge > 0) {
        this.drawKickChargeIndicator(circle.pos.x, circle.pos.y, circle.radius, player.kickCharge);
      }
      
      if (player.id === controlledPlayerId) {
        this.drawControlIndicator(circle.pos.x, circle.pos.y, circle.radius, rotation);
      }
      
      // Desenha nome do jogador
      this.drawPlayerName(circle.pos.x, circle.pos.y, circle.radius, player.name);
    }
  }

  private drawKickChargeIndicator(x: number, y: number, playerRadius: number, charge: number): void {
    const ctx = this.ctx;
    const chargeRadius = playerRadius * charge; // Cresce até o raio total do jogador
    
    ctx.save();
    ctx.globalAlpha = 0.5; // Semi-transparente
    ctx.fillStyle = this.colors.white;
    ctx.beginPath();
    ctx.arc(x, y, chargeRadius, 0, this.PI2);
    ctx.fill();
    ctx.restore();
  }

  private drawPlayerName(x: number, y: number, playerRadius: number, name: string): void {
    const ctx = this.ctx;
    const yOffset = playerRadius + 15; // Posiciona abaixo do círculo
    
    ctx.save();
    ctx.globalAlpha = 0.6; // Mais transparente/discreto
    ctx.fillStyle = this.colors.white;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    ctx.fillText(name, x, y + yOffset);
    
    ctx.restore();
  }
}
