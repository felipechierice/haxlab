export interface KeyBindings {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  kick: string[];
  switchPlayer: string[];
}

const DEFAULT_KEYBINDINGS: KeyBindings = {
  up: ['ArrowUp', 'w', 'W'],
  down: ['ArrowDown', 's', 'S'],
  left: ['ArrowLeft', 'a', 'A'],
  right: ['ArrowRight', 'd', 'D'],
  kick: [' ', 'Space'],
  switchPlayer: ['Tab']
};

export class KeyBindingsManager {
  private bindings: KeyBindings;
  private storageKey = 'ballers-keybindings';

  constructor() {
    this.bindings = this.loadFromStorage() || { ...DEFAULT_KEYBINDINGS };
  }

  getBindings(): KeyBindings {
    return { ...this.bindings };
  }

  setBinding(action: keyof KeyBindings, keys: string[]): void {
    this.bindings[action] = keys;
    this.saveToStorage();
  }

  isKeyBound(key: string, action: keyof KeyBindings): boolean {
    return this.bindings[action].includes(key);
  }

  resetToDefault(): void {
    this.bindings = { ...DEFAULT_KEYBINDINGS };
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.bindings));
    } catch (e) {
      console.warn('Failed to save keybindings to localStorage');
    }
  }

  private loadFromStorage(): KeyBindings | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load keybindings from localStorage');
    }
    return null;
  }

  // Retorna string formatada para exibição
  getDisplayString(action: keyof KeyBindings): string {
    return this.bindings[action]
      .map(key => {
        if (key === ' ') return 'Space';
        if (key === 'ArrowUp') return '↑';
        if (key === 'ArrowDown') return '↓';
        if (key === 'ArrowLeft') return '←';
        if (key === 'ArrowRight') return '→';
        return key.toUpperCase();
      })
      .join(' / ');
  }
}

export const keyBindings = new KeyBindingsManager();
