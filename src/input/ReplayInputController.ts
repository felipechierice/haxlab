/**
 * ReplayInputController - Controlador para Reprodução de Replays
 * 
 * Reproduz inputs gravados de um replay, simulando as ações do jogador
 * no momento exato em que foram executadas.
 */

import { 
  InputController, 
  Direction, 
  InputState,
  inputFlagsToDirection 
} from './InputController.js';
import { ReplayData, ReplayInputEvent, ReplayAction } from '../types.js';

/**
 * Estado dos inputs no momento atual do replay
 */
interface ReplayInputFlags {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  kick: boolean;
}

export class ReplayInputController implements InputController {
  private replayData: ReplayData;
  private currentTime: number = 0; // Tempo atual em ms desde o início
  private eventIndex: number = 0; // Índice do próximo evento a processar
  private inputFlags: ReplayInputFlags;
  private currentDirection: Direction = null;
  private isPlaying: boolean = false;
  
  constructor(replayData: ReplayData) {
    this.replayData = replayData;
    this.inputFlags = {
      up: false,
      down: false,
      left: false,
      right: false,
      kick: false
    };
  }
  
  /**
   * Inicia a reprodução do replay
   */
  start(): void {
    this.isPlaying = true;
    this.currentTime = 0;
    this.eventIndex = 0;
    this.resetInputs();
  }
  
  /**
   * Para a reprodução do replay
   */
  stop(): void {
    this.isPlaying = false;
    this.resetInputs();
  }
  
  /**
   * Reseta todos os inputs para falso
   */
  private resetInputs(): void {
    this.inputFlags.up = false;
    this.inputFlags.down = false;
    this.inputFlags.left = false;
    this.inputFlags.right = false;
    this.inputFlags.kick = false;
    this.updateDirection();
  }
  
  /**
   * Processa eventos do replay baseado no tempo atual
   */
  private processEvents(): void {
    if (!this.isPlaying || !this.replayData.events) return;
    
    // Processar todos os eventos que deveriam ter ocorrido até o tempo atual
    while (
      this.eventIndex < this.replayData.events.length &&
      this.replayData.events[this.eventIndex].timestamp <= this.currentTime
    ) {
      const event = this.replayData.events[this.eventIndex];
      this.applyEvent(event);
      this.eventIndex++;
    }
    
    this.updateDirection();
  }
  
  /**
   * Aplica um evento de input aos flags
   */
  private applyEvent(event: ReplayInputEvent): void {
    const isPressed = event.type === 'keydown';
    
    switch (event.action) {
      case 'up':
        this.inputFlags.up = isPressed;
        break;
      case 'down':
        this.inputFlags.down = isPressed;
        break;
      case 'left':
        this.inputFlags.left = isPressed;
        break;
      case 'right':
        this.inputFlags.right = isPressed;
        break;
      case 'kick':
        this.inputFlags.kick = isPressed;
        break;
    }
  }
  
  /**
   * Atualiza a direção baseado nos flags atuais
   */
  private updateDirection(): void {
    this.currentDirection = inputFlagsToDirection(this.inputFlags);
  }
  
  /**
   * Atualiza o controlador (chamado a cada frame)
   */
  update(dt: number, _simulationTime: number): void {
    if (!this.isPlaying) return;
    
    // Incrementar tempo em milissegundos
    this.currentTime += dt * 1000;
    
    // Processar eventos até o tempo atual
    this.processEvents();
  }
  
  getMovementDirection(): Direction {
    return this.currentDirection;
  }
  
  isKickPressed(): boolean {
    return this.inputFlags.kick;
  }
  
  getInputState(): InputState {
    return {
      direction: this.currentDirection,
      kicking: this.inputFlags.kick
    };
  }
  
  reset(): void {
    this.currentTime = 0;
    this.eventIndex = 0;
    this.resetInputs();
  }
  
  /**
   * Retorna o tempo atual da reprodução em segundos
   */
  getCurrentTime(): number {
    return this.currentTime / 1000;
  }
  
  /**
   * Define o tempo atual da reprodução (para seek)
   */
  setCurrentTime(timeInSeconds: number): void {
    const newTime = timeInSeconds * 1000;
    
    // Se estamos voltando no tempo, resetar e reprocessar
    if (newTime < this.currentTime) {
      this.currentTime = 0;
      this.eventIndex = 0;
      this.resetInputs();
    }
    
    this.currentTime = newTime;
    this.processEvents();
  }
  
  /**
   * Verifica se o replay terminou
   */
  isFinished(): boolean {
    return this.currentTime >= this.replayData.totalTime * 1000;
  }
  
  /**
   * Retorna o tempo total do replay em segundos
   */
  getTotalTime(): number {
    return this.replayData.totalTime;
  }
  
  /**
   * Retorna os dados do replay
   */
  getReplayData(): ReplayData {
    return this.replayData;
  }
}
