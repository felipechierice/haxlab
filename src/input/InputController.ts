/**
 * Input Controller - Interface Comum para Controle de Jogadores e Bots
 * 
 * Este módulo implementa o padrão Input Adapter para unificar a lógica de controle
 * entre jogadores humanos e bots. A extrapolação funciona de forma idêntica para ambos,
 * pois todos usam a mesma interface baseada em direções discretas.
 */

/**
 * Direções possíveis de movimento (8 direções + parado)
 * Mapeia diretamente para as teclas direcionais
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
 * Estado de input normalizado
 * Usado para debug, replay e serialização
 */
export interface InputState {
  direction: Direction;
  kicking: boolean;
}

/**
 * Interface comum para todos os controladores de input
 * Tanto jogadores humanos quanto bots implementam esta interface
 */
export interface InputController {
  /**
   * Retorna a direção de movimento atual
   * @returns Uma das 8 direções cardinais/diagonais ou null (parado)
   */
  getMovementDirection(): Direction;
  
  /**
   * Verifica se o chute está sendo pressionado
   * @returns true se deve chutar
   */
  isKickPressed(): boolean;
  
  /**
   * Retorna o estado completo de input (para debug/replay)
   */
  getInputState(): InputState;
  
  /**
   * Atualiza o controlador (chamado a cada frame)
   * @param dt Delta time em segundos
   * @param simulationTime Tempo de simulação absoluto (para determinismo)
   */
  update(dt: number, simulationTime: number): void;
  
  /**
   * Reseta o controlador para o estado inicial
   */
  reset(): void;
  
  /**
   * Define o estado do jogo (opcional, usado por bots)
   */
  setGameState?(state: any): void;
}

/**
 * Converte uma Direction para um vetor unitário normalizado
 * O vetor diagonal tem magnitude 1 (não √2), garantindo velocidade consistente
 */
export function directionToVector(direction: Direction): { x: number; y: number } {
  const SQRT2_INV = 1 / Math.SQRT2; // ≈ 0.707
  
  switch (direction) {
    case 'UP':         return { x: 0, y: -1 };
    case 'DOWN':       return { x: 0, y: 1 };
    case 'LEFT':       return { x: -1, y: 0 };
    case 'RIGHT':      return { x: 1, y: 0 };
    case 'UP_LEFT':    return { x: -SQRT2_INV, y: -SQRT2_INV };
    case 'UP_RIGHT':   return { x: SQRT2_INV, y: -SQRT2_INV };
    case 'DOWN_LEFT':  return { x: -SQRT2_INV, y: SQRT2_INV };
    case 'DOWN_RIGHT': return { x: SQRT2_INV, y: SQRT2_INV };
    case null:         return { x: 0, y: 0 };
  }
}

/**
 * Converte um ângulo (em graus, -180 a 180) para a direção mais próxima
 * Útil para bots que calculam vetores de movimento
 */
export function angleToDirection(angleDegrees: number): Direction {
  // Normaliza para 0-360
  const angle = ((angleDegrees % 360) + 360) % 360;
  
  // Cada direção ocupa 45° de arco
  // RIGHT = 0°, DOWN_RIGHT = 45°, DOWN = 90°, etc.
  if (angle < 22.5 || angle >= 337.5) return 'RIGHT';
  if (angle < 67.5) return 'DOWN_RIGHT';
  if (angle < 112.5) return 'DOWN';
  if (angle < 157.5) return 'DOWN_LEFT';
  if (angle < 202.5) return 'LEFT';
  if (angle < 247.5) return 'UP_LEFT';
  if (angle < 292.5) return 'UP';
  return 'UP_RIGHT';
}

/**
 * Converte um vetor de direção para a Direction mais próxima
 * Ignora vetores muito pequenos (retorna null)
 */
export function vectorToDirection(x: number, y: number, deadzone: number = 0.1): Direction {
  const magnitude = Math.sqrt(x * x + y * y);
  
  // Se o vetor é muito pequeno, considera parado
  if (magnitude < deadzone) return null;
  
  // Calcula o ângulo em graus
  const angle = Math.atan2(y, x) * (180 / Math.PI);
  
  return angleToDirection(angle);
}

/**
 * Converte Direction para flags de input booleanos (compatibilidade com sistema antigo)
 */
export function directionToInputFlags(direction: Direction): {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
} {
  return {
    up: direction === 'UP' || direction === 'UP_LEFT' || direction === 'UP_RIGHT',
    down: direction === 'DOWN' || direction === 'DOWN_LEFT' || direction === 'DOWN_RIGHT',
    left: direction === 'LEFT' || direction === 'UP_LEFT' || direction === 'DOWN_LEFT',
    right: direction === 'RIGHT' || direction === 'UP_RIGHT' || direction === 'DOWN_RIGHT',
  };
}

/**
 * Converte flags de input booleanos para Direction
 */
export function inputFlagsToDirection(input: {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}): Direction {
  const { up, down, left, right } = input;
  
  // Direções cancelam quando opostas são pressionadas
  const verticalUp = up && !down;
  const verticalDown = down && !up;
  const horizontalLeft = left && !right;
  const horizontalRight = right && !left;
  
  if (verticalUp && horizontalLeft) return 'UP_LEFT';
  if (verticalUp && horizontalRight) return 'UP_RIGHT';
  if (verticalDown && horizontalLeft) return 'DOWN_LEFT';
  if (verticalDown && horizontalRight) return 'DOWN_RIGHT';
  if (verticalUp) return 'UP';
  if (verticalDown) return 'DOWN';
  if (horizontalLeft) return 'LEFT';
  if (horizontalRight) return 'RIGHT';
  
  return null;
}
