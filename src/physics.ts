import { Vector2D, Circle, Segment } from './types.js';

// Vetores reutilizáveis para evitar alocações no loop de física
const _tempVec1: Vector2D = { x: 0, y: 0 };
const _tempVec2: Vector2D = { x: 0, y: 0 };

export class Physics {
  static readonly FRICTION = 0.98;
  static readonly AIR_DAMPING = 0.985;
  static readonly PLAYER_ACCELERATION = 7.5;
  static readonly PLAYER_MAX_SPEED = 260;
  static readonly PLAYER_DAMPING = 0.96;
  static readonly BALL_DAMPING = 0.992;
  static readonly KICK_STRENGTH = 500;
  static readonly KICK_MARGIN = 15;
  static readonly MAX_SAFE_VELOCITY = 400; // Velocidade máxima antes de aplicar sub-stepping

  static createVector(x: number = 0, y: number = 0): Vector2D {
    return { x, y };
  }

  static vectorAdd(v1: Vector2D, v2: Vector2D): Vector2D {
    return { x: v1.x + v2.x, y: v1.y + v2.y };
  }

  static vectorSub(v1: Vector2D, v2: Vector2D): Vector2D {
    return { x: v1.x - v2.x, y: v1.y - v2.y };
  }

  static vectorScale(v: Vector2D, scale: number): Vector2D {
    return { x: v.x * scale, y: v.y * scale };
  }

  static vectorLength(v: Vector2D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  static vectorLengthSq(v: Vector2D): number {
    return v.x * v.x + v.y * v.y;
  }

  static vectorNormalize(v: Vector2D): Vector2D {
    const len = this.vectorLength(v);
    if (len === 0) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
  }

  static vectorDot(v1: Vector2D, v2: Vector2D): number {
    return v1.x * v2.x + v1.y * v2.y;
  }

  static createCircle(x: number, y: number, radius: number, mass: number = 1, damping?: number): Circle {
    return {
      pos: { x, y },
      vel: { x: 0, y: 0 },
      radius,
      mass,
      damping: damping !== undefined ? damping : (mass > 5 ? Physics.PLAYER_DAMPING : Physics.BALL_DAMPING),
      invMass: mass > 0 ? 1 / mass : 0
    };
  }

  

  static updateCircle(circle: Circle, dt: number): void {
    circle.pos.x += circle.vel.x * dt;
    circle.pos.y += circle.vel.y * dt;
    
    // Damping normalizado para 60fps: Math.pow(damping, dt * 60) garante
    // que a desaceleração é idêntica independente do refresh rate do monitor
    const dampingFactor = Math.pow(circle.damping, dt * 60);
    circle.vel.x *= dampingFactor;
    circle.vel.y *= dampingFactor;
  }

  /**
   * Atualiza círculo com sub-stepping para evitar tunneling em altas velocidades
   * @param circle - Círculo a ser atualizado
   * @param dt - Delta time
   * @param segments - Segmentos para verificar colisão (paredes)
   * @param maxVelocity - Velocidade máxima antes de aplicar sub-steps (padrão: MAX_SAFE_VELOCITY)
   */
  static updateCircleWithSubsteps(circle: Circle, dt: number, segments: Segment[], maxVelocity: number = Physics.MAX_SAFE_VELOCITY): void {
    const speed = Math.sqrt(circle.vel.x * circle.vel.x + circle.vel.y * circle.vel.y);
    
    // Se velocidade é baixa, usa atualização normal
    if (speed <= maxVelocity) {
      circle.pos.x += circle.vel.x * dt;
      circle.pos.y += circle.vel.y * dt;
      
      // Verifica colisões com segmentos
      for (const segment of segments) {
        if (Physics.checkSegmentCollision(circle, segment)) {
          Physics.resolveSegmentCollision(circle, segment);
        }
      }
    } else {
      // Calcula número de sub-steps necessários baseado na velocidade
      const substeps = Math.ceil(speed / maxVelocity);
      const subDt = dt / substeps;
      
      // Executa movimento em pequenos passos
      for (let i = 0; i < substeps; i++) {
        circle.pos.x += circle.vel.x * subDt;
        circle.pos.y += circle.vel.y * subDt;
        
        // Verifica colisões após cada sub-step
        for (const segment of segments) {
          if (Physics.checkSegmentCollision(circle, segment)) {
            Physics.resolveSegmentCollision(circle, segment);
          }
        }
      }
    }
    
    // Aplica damping
    const dampingFactor = Math.pow(circle.damping, dt * 60);
    circle.vel.x *= dampingFactor;
    circle.vel.y *= dampingFactor;
  }

  static checkCircleCollision(c1: Circle, c2: Circle): boolean {
    const dx = c2.pos.x - c1.pos.x;
    const dy = c2.pos.y - c1.pos.y;
    const distSq = dx * dx + dy * dy;
    const minDist = c1.radius + c2.radius;
    return distSq < minDist * minDist;
  }

  static resolveCircleCollision(c1: Circle, c2: Circle): void {
    const dx = c2.pos.x - c1.pos.x;
    const dy = c2.pos.y - c1.pos.y;
    const distSq = dx * dx + dy * dy;
    const minDist = c1.radius + c2.radius;
    
    if (distSq === 0 || distSq >= minDist * minDist) return;
    
    const dist = Math.sqrt(distSq);
    const invDist = 1 / dist;
    
    // Normal inline (evita criar objeto)
    const nx = dx * invDist;
    const ny = dy * invDist;
    const overlap = minDist - dist;

    const totalMass = c1.mass + c2.mass;
    const ratio1 = c2.mass / totalMass;
    const ratio2 = c1.mass / totalMass;

    c1.pos.x -= nx * overlap * ratio1;
    c1.pos.y -= ny * overlap * ratio1;
    c2.pos.x += nx * overlap * ratio2;
    c2.pos.y += ny * overlap * ratio2;

    // Velocidade relativa inline
    const relVelX = c2.vel.x - c1.vel.x;
    const relVelY = c2.vel.y - c1.vel.y;
    const velAlongNormal = relVelX * nx + relVelY * ny;

    if (velAlongNormal > 0) return;

    const restitution = 0.2;
    const impulse = -(1 + restitution) * velAlongNormal;
    const impulseMagnitude = impulse / (c1.invMass + c2.invMass);

    c1.vel.x -= nx * impulseMagnitude * c1.invMass;
    c1.vel.y -= ny * impulseMagnitude * c1.invMass;
    c2.vel.x += nx * impulseMagnitude * c2.invMass;
    c2.vel.y += ny * impulseMagnitude * c2.invMass;
  }

  static checkSegmentCollision(circle: Circle, segment: Segment): boolean {
    // Inline para evitar criação de objetos
    const toStartX = circle.pos.x - segment.p1.x;
    const toStartY = circle.pos.y - segment.p1.y;
    const segDirX = segment.p2.x - segment.p1.x;
    const segDirY = segment.p2.y - segment.p1.y;
    const segmentLengthSq = segDirX * segDirX + segDirY * segDirY;
    const segmentLength = Math.sqrt(segmentLengthSq);
    
    if (segmentLength === 0) return false;
    
    const invSegLen = 1 / segmentLength;
    const segNormX = segDirX * invSegLen;
    const segNormY = segDirY * invSegLen;

    const projection = toStartX * segNormX + toStartY * segNormY;
    const closestPoint = Math.max(0, Math.min(segmentLength, projection));

    const closestX = segment.p1.x + segNormX * closestPoint;
    const closestY = segment.p1.y + segNormY * closestPoint;
    
    const distX = circle.pos.x - closestX;
    const distY = circle.pos.y - closestY;
    const distSq = distX * distX + distY * distY;

    return distSq < circle.radius * circle.radius;
  }

  static resolveSegmentCollision(circle: Circle, segment: Segment): void {
    const toStartX = circle.pos.x - segment.p1.x;
    const toStartY = circle.pos.y - segment.p1.y;
    const segDirX = segment.p2.x - segment.p1.x;
    const segDirY = segment.p2.y - segment.p1.y;
    const segmentLengthSq = segDirX * segDirX + segDirY * segDirY;
    const segmentLength = Math.sqrt(segmentLengthSq);
    
    if (segmentLength === 0) return;
    
    const invSegLen = 1 / segmentLength;
    const segNormX = segDirX * invSegLen;
    const segNormY = segDirY * invSegLen;

    const projection = toStartX * segNormX + toStartY * segNormY;
    const closestPoint = Math.max(0, Math.min(segmentLength, projection));

    const closestX = segment.p1.x + segNormX * closestPoint;
    const closestY = segment.p1.y + segNormY * closestPoint;
    
    const deltaX = circle.pos.x - closestX;
    const deltaY = circle.pos.y - closestY;
    const distSq = deltaX * deltaX + deltaY * deltaY;
    const dist = Math.sqrt(distSq);

    if (dist === 0 || dist >= circle.radius) return;

    // Normal inline
    let normalX: number, normalY: number;
    if (dist > 0) {
      const invDist = 1 / dist;
      normalX = deltaX * invDist;
      normalY = deltaY * invDist;
    } else {
      normalX = segment.normal.x;
      normalY = segment.normal.y;
    }
    
    const overlap = circle.radius - dist;

    circle.pos.x += normalX * overlap;
    circle.pos.y += normalY * overlap;

    const velAlongNormal = circle.vel.x * normalX + circle.vel.y * normalY;
    if (velAlongNormal < 0) {
      const bounce = segment.bounce || 0.9;
      circle.vel.x -= normalX * velAlongNormal * (1 + bounce);
      circle.vel.y -= normalY * velAlongNormal * (1 + bounce);
    }
  }
}
