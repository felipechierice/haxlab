/**
 * KeyboardInputController - Controlador de Input para Jogadores Humanos
 * 
 * Captura inputs do teclado e os converte para a interface InputController.
 * Este controlador é usado pelo jogador humano e é compatível com o sistema
 * de extrapolação.
 */

import { 
  InputController, 
  Direction, 
  InputState,
  inputFlagsToDirection 
} from './InputController.js';
import { keyBindings } from '../keybindings.js';
import type { ReplayRecorder } from '../replay.js';
import { keyToReplayAction } from '../replay.js';

export class KeyboardInputController implements InputController {
  private keyState: Map<string, boolean> = new Map();
  private kickPressed: boolean = false;
  private currentDirection: Direction = null;
  
  // Event handlers (guardados para remoção)
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  
  // Callback para quando o kick é pressionado (para integração com sistema de charge)
  private onKickDown: (() => void) | null = null;
  private onKickUp: (() => void) | null = null;
  
  // Flag para ignorar inputs (quando digitando em input/textarea)
  private ignoreInputs: boolean = false;
  
  // Replay recorder (opcional)
  private replayRecorder: ReplayRecorder | null = null;
  
  // Modo passivo: apenas grava inputs sem interferir no jogo
  private passiveMode: boolean = false;
  
  constructor(options?: { passiveMode?: boolean }) {
    this.passiveMode = options?.passiveMode ?? false;
    this.setupEventListeners();
  }
  
  /**
   * Define o replay recorder para gravar inputs
   */
  setReplayRecorder(recorder: ReplayRecorder | null): void {
    this.replayRecorder = recorder;
  }
  
  private setupEventListeners(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      // Ignora se está digitando em campo de texto
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        this.ignoreInputs = true;
        return;
      }
      this.ignoreInputs = false;
      
      // Evita key repeat
      if (e.repeat) return;
      
      // Gravar evento no replay se estiver gravando
      const action = keyToReplayAction(e.key);
      if (action && this.replayRecorder) {
        this.replayRecorder.recordInputEvent('keydown', action);
      }
      
      // Em modo passivo, apenas grava - não interfere no jogo
      if (this.passiveMode) return;
      
      this.keyState.set(e.key, true);
      
      // Chute
      if (keyBindings.isKeyBound(e.key, 'kick')) {
        e.preventDefault();
        this.kickPressed = true;
        if (this.onKickDown) {
          this.onKickDown();
        }
      }
    };
    
    this.keyupHandler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }
      
      // Gravar evento no replay se estiver gravando
      const action = keyToReplayAction(e.key);
      if (action && this.replayRecorder) {
        this.replayRecorder.recordInputEvent('keyup', action);
      }
      
      // Em modo passivo, apenas grava - não interfere no jogo
      if (this.passiveMode) return;
      
      this.keyState.set(e.key, false);
      
      // Soltar tecla de chute
      if (keyBindings.isKeyBound(e.key, 'kick')) {
        this.kickPressed = false;
        if (this.onKickUp) {
          this.onKickUp();
        }
      }
    };
    
    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.keyupHandler);
  }
  
  /**
   * Define callbacks para eventos de kick (para integração com sistema de charge)
   */
  setKickCallbacks(onDown: () => void, onUp: () => void): void {
    this.onKickDown = onDown;
    this.onKickUp = onUp;
  }
  
  /**
   * Remove callbacks de kick
   */
  clearKickCallbacks(): void {
    this.onKickDown = null;
    this.onKickUp = null;
  }
  
  getMovementDirection(): Direction {
    return this.currentDirection;
  }
  
  isKickPressed(): boolean {
    return this.kickPressed;
  }
  
  getInputState(): InputState {
    return {
      direction: this.currentDirection,
      kicking: this.kickPressed
    };
  }
  
  /**
   * Atualiza a direção baseado no estado atual das teclas
   */
  update(_dt: number, _simulationTime: number): void {
    if (this.ignoreInputs) {
      this.currentDirection = null;
      return;
    }
    
    const binds = keyBindings.getBindings();
    
    const input = {
      up: binds.up.some(key => this.keyState.get(key)),
      down: binds.down.some(key => this.keyState.get(key)),
      left: binds.left.some(key => this.keyState.get(key)),
      right: binds.right.some(key => this.keyState.get(key))
    };
    
    this.currentDirection = inputFlagsToDirection(input);
  }
  
  reset(): void {
    this.keyState.clear();
    this.kickPressed = false;
    this.currentDirection = null;
  }
  
  /**
   * Remove event listeners (chamado ao destruir o controller)
   */
  destroy(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.keyupHandler) {
      window.removeEventListener('keyup', this.keyupHandler);
      this.keyupHandler = null;
    }
    this.onKickDown = null;
    this.onKickUp = null;
  }
  
  /**
   * Verifica se uma tecla específica está pressionada (para funcionalidades extras)
   */
  isKeyPressed(key: string): boolean {
    return this.keyState.get(key) ?? false;
  }
  
  /**
   * Retorna o estado bruto das teclas (para debug)
   */
  getRawKeyState(): { up: boolean; down: boolean; left: boolean; right: boolean; kick: boolean } {
    const binds = keyBindings.getBindings();
    return {
      up: binds.up.some(key => this.keyState.get(key)),
      down: binds.down.some(key => this.keyState.get(key)),
      left: binds.left.some(key => this.keyState.get(key)),
      right: binds.right.some(key => this.keyState.get(key)),
      kick: this.kickPressed
    };
  }
}
