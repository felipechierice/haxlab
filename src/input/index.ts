/**
 * Input Module - Export Principal
 * 
 * Este módulo fornece a abstração de input que unifica
 * o controle de jogadores humanos e bots.
 */

// Interface e tipos principais
export type { 
  InputController, 
  InputState
} from './InputController.js';

export {
  directionToVector,
  angleToDirection,
  vectorToDirection,
  directionToInputFlags,
  inputFlagsToDirection
} from './InputController.js';

// Controlador de teclado para jogadores humanos
export { KeyboardInputController } from './KeyboardInputController.js';

// Controlador virtual para bots
export { 
  BotVirtualInputController
} from './BotVirtualInputController.js';

// Types re-exported from types.ts via BotVirtualInputController
export type {
  BotPresetType,
  BotBehavior,
  PatrolCommand,
  NoneBehaviorConfig,
  PatrolBehaviorConfig,
  AutonomousBehaviorConfig,
  AutonomousStrategy
} from './BotVirtualInputController.js';

// Direction type is in types.ts, re-exported here for convenience
export type { Direction } from '../types.js';
