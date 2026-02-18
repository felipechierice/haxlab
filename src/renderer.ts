import { GameState, GameMap, Circle, Segment, Goal, Vector2D, BallConfig, Player } from './types.js';
import { ExtrapolatedPositions } from './extrapolation.js';

/** Dados de interpolação para renderização suave entre frames de física */
export interface InterpolationData {
  alpha: number; // 0 = posição anterior, 1 = posição atual
  prevBallPos: Vector2D;
  prevPlayerPos: Map<string, Vector2D>;
  ballCollided?: boolean; // Flag para indicar que a bola colidiu com parede ou player
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  
  // Constantes pré-calculadas
  private readonly PI2 = Math.PI * 2;
  private readonly halfWidth: number;
  private readonly halfHeight: number;
  
  // Rastro da bola (circular buffer para evitar unshift O(n))
  private ballTrail: Vector2D[] = [];
  private trailHead: number = 0; // Índice do elemento mais recente (cabeça)
  private trailLength: number = 0; // Quantidade atual de elementos no trail
  private readonly TRAIL_MAX_LENGTH = 25;
  private readonly TRAIL_MIN_SPEED_SQ = 400; // velocidade mínima² para mostrar rastro (20²)
  
  // Cache de cores
  private readonly colors = {
    background: '#1a1a2e',
    white: '#ffffff',
    red: '#ff4757',
    blue: '#5352ed',
    line: '#444',
    indicator: '#fff700'
  };
  
  // Opacidade do indicador de controle (círculo pontilhado)
  private controlIndicatorOpacity: number = 0.3;
  
  // Cache de arrays para evitar alocações por frame
  private readonly lineDashPattern = [10, 10];
  private readonly lineDashEmpty: number[] = [];

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
    ctx.setLineDash(this.lineDashPattern);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.halfWidth, 50);
    ctx.lineTo(this.halfWidth, this.height - 50);
    ctx.stroke();
    ctx.setLineDash(this.lineDashEmpty);

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

  private updateBallTrail(ball: Circle): void {
    const speedSq = ball.vel.x * ball.vel.x + ball.vel.y * ball.vel.y;
    
    // Só adiciona ao rastro se a bola estiver em movimento
    if (speedSq > this.TRAIL_MIN_SPEED_SQ) {
      // Circular buffer: avança o head e escreve a posição
      if (this.trailLength < this.TRAIL_MAX_LENGTH) {
        // Buffer ainda não está cheio, adiciona ao final
        if (!this.ballTrail[this.trailLength]) {
          this.ballTrail[this.trailLength] = { x: ball.pos.x, y: ball.pos.y };
        } else {
          this.ballTrail[this.trailLength].x = ball.pos.x;
          this.ballTrail[this.trailLength].y = ball.pos.y;
        }
        this.trailHead = this.trailLength;
        this.trailLength++;
      } else {
        // Buffer cheio: sobrescreve o mais antigo
        this.trailHead = (this.trailHead + 1) % this.TRAIL_MAX_LENGTH;
        this.ballTrail[this.trailHead].x = ball.pos.x;
        this.ballTrail[this.trailHead].y = ball.pos.y;
      }
    } else {
      // Se a bola parou, vai apagando o rastro gradualmente
      if (this.trailLength > 0) {
        this.trailLength--;
      }
    }
  }

  /**
   * Retorna o elemento do trail no índice lógico i (0 = mais recente, trailLength-1 = mais antigo)
   */
  private getTrailPoint(i: number): Vector2D {
    // i=0 é o mais recente (head), i=trailLength-1 é o mais antigo
    const idx = (this.trailHead - i + this.TRAIL_MAX_LENGTH) % this.TRAIL_MAX_LENGTH;
    return this.ballTrail[idx];
  }

  private drawBallTrail(ballRadius: number): void {
    if (this.trailLength < 2) return;
    
    const ctx = this.ctx;
    const len = this.trailLength;
    
    ctx.save();
    
    // Desenha o rastro como um polígono que afina
    ctx.beginPath();
    
    // Largura máxima na ponta (perto da bola) - um pouco menor que o raio da bola
    const maxWidth = ballRadius;
    
    // Lado "direito" do rastro (indo da bola para a cauda)
    for (let i = 0; i < len - 1; i++) {
      const curr = this.getTrailPoint(i);
      const next = this.getTrailPoint(i + 1);
      
      // Direção perpendicular ao movimento
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      
      if (segLen === 0) continue;
      
      // Normal perpendicular
      const nx = -dy / segLen;
      const ny = dx / segLen;
      
      // Largura diminui ao longo do rastro
      const t = i / (len - 1);
      const width = maxWidth * (1 - t);
      
      const px = curr.x + nx * width;
      const py = curr.y + ny * width;
      
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    
    // Ponta da cauda (ponto final)
    const lastPoint = this.getTrailPoint(len - 1);
    ctx.lineTo(lastPoint.x, lastPoint.y);
    
    // Lado "esquerdo" do rastro (voltando da cauda para a bola)
    for (let i = len - 2; i >= 0; i--) {
      const curr = this.getTrailPoint(i);
      const next = this.getTrailPoint(i + 1);
      
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      
      if (segLen === 0) continue;
      
      const nx = -dy / segLen;
      const ny = dx / segLen;
      
      const t = i / (len - 1);
      const width = maxWidth * (1 - t);
      
      const px = curr.x - nx * width;
      const py = curr.y - ny * width;
      
      ctx.lineTo(px, py);
    }
    
    ctx.closePath();
    
    // Gradiente de opacidade linear da bola até o fim do rastro
    const firstPoint = this.getTrailPoint(0);
    const gradLastPoint = this.getTrailPoint(len - 1);
    
    const gradient = ctx.createLinearGradient(
      firstPoint.x, firstPoint.y,
      gradLastPoint.x, gradLastPoint.y
    );
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');    // Mais opaco perto da bola
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');  // Meio do rastro
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');      // Transparente no final
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.restore();
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
    ctx.globalAlpha = this.controlIndicatorOpacity;
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

  drawState(
    state: GameState, 
    map: GameMap, 
    controlledPlayerId?: string, 
    time: number = 0, 
    ballConfig?: BallConfig,
    extrapolatedPositions?: ExtrapolatedPositions,
    interpolation?: InterpolationData
  ): void {
    this.clear();
    this.drawMap(map);

    const ball = state.ball.circle;
    
    // Prioridade: extrapolação > interpolação > posição atual
    // Quando extrapolação está ativa, NÃO usar interpolação (causa conflito/tremor)
    let ballX: number, ballY: number;
    
    if (extrapolatedPositions) {
      // Usa extrapolação (predição de input)
      ballX = extrapolatedPositions.ball.x;
      ballY = extrapolatedPositions.ball.y;
    } else if (interpolation) {
      // Usa interpolação entre frame anterior e atual (suavização visual)
      const a = interpolation.alpha;
      ballX = interpolation.prevBallPos.x + (ball.pos.x - interpolation.prevBallPos.x) * a;
      ballY = interpolation.prevBallPos.y + (ball.pos.y - interpolation.prevBallPos.y) * a;
    } else {
      // Posição atual
      ballX = ball.pos.x;
      ballY = ball.pos.y;
    }

    // Desenha a bola
    if (ballConfig) {
      this.drawBallWithConfig(ballX, ballY, ball.radius, ballConfig);
    } else {
      this.drawCircle(ballX, ballY, ball.radius, this.colors.white, true);
    }

    // Desenha jogadores
    const rotation = time * 3;
    for (let i = 0; i < state.players.length; i++) {
      const player = state.players[i];
      const color = player.team === 'red' ? this.colors.red : this.colors.blue;
      const circle = player.circle;
      
      // Prioridade: extrapolação > interpolação > posição atual
      let drawX: number, drawY: number;
      if (extrapolatedPositions) {
        const playerPos = extrapolatedPositions.players.get(player.id);
        drawX = playerPos?.x ?? circle.pos.x;
        drawY = playerPos?.y ?? circle.pos.y;
      } else if (interpolation) {
        const prevPos = interpolation.prevPlayerPos.get(player.id);
        if (prevPos) {
          const a = interpolation.alpha;
          drawX = prevPos.x + (circle.pos.x - prevPos.x) * a;
          drawY = prevPos.y + (circle.pos.y - prevPos.y) * a;
        } else {
          drawX = circle.pos.x;
          drawY = circle.pos.y;
        }
      } else {
        drawX = circle.pos.x;
        drawY = circle.pos.y;
      }
      
      this.drawCircle(drawX, drawY, circle.radius, color, true);
      
      // Desenha círculo de carregamento de chute
      // Para bots: mostra sempre que está carregando (mesmo após chutar, enquanto comando ativo)
      // Para jogadores: só mostra se não tiver chutado ainda
      // Sempre mostra durante feedback visual (após chute)
      const shouldShowKickIndicator = player.isChargingKick && (player.isBot || !player.hasKickedThisPress) || player.kickFeedbackTime > 0;
      if (shouldShowKickIndicator) {
        // Se está no feedback visual (após chute), mostra círculo completo
        const chargeToShow = player.kickFeedbackTime > 0 ? 1 : player.kickCharge;
        this.drawKickChargeIndicator(drawX, drawY, circle.radius, chargeToShow);
      }
      
      if (player.id === controlledPlayerId) {
        this.drawControlIndicator(drawX, drawY, circle.radius, rotation);
      }
      
      // Desenha nome do jogador
      this.drawPlayerName(drawX, drawY, circle.radius, player.name);
    }
  }

  private drawKickChargeIndicator(x: number, y: number, playerRadius: number, charge: number): void {
    const ctx = this.ctx;
    const ringRadius = playerRadius + 5; // Círculo ao redor do player (reduzido)
    const lineWidth = 2.5; // Mais fino
    
    ctx.save();
    
    // Círculo de fundo (opcional, mais discreto)
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, this.PI2);
    ctx.stroke();
    
    // Círculo de progresso
    const endAngle = -Math.PI / 2 + (charge * this.PI2); // Começa no topo e cresce
    ctx.globalAlpha = 1.0; // Completamente opaco
    ctx.strokeStyle = '#ffffff'; // Branco brilhante
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, -Math.PI / 2, endAngle);
    ctx.stroke();
    
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

  clearBallTrail(): void {
    this.trailLength = 0;
    this.trailHead = 0;
  }
  
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
  
  setControlIndicatorOpacity(opacity: number): void {
    this.controlIndicatorOpacity = Math.max(0, Math.min(1, opacity));
  }
}
