# Plano de Refatoração: Sistema de Controllers

## Objetivo

Unificar a arquitetura de jogadores e bots para que ambos sejam instâncias idênticas de `Player`, diferenciando-se apenas pelo **controlador** acoplado (teclado para humanos, IA para bots).

---

## Por que refatorar?

### Problemas Atuais

1. **Duplicação de código**
   - `addPlayer()` e `addBot()` em `game.ts` são quase idênticos
   - A única diferença real é `isBot: true` e a criação da instância `BotAI`

2. **Acoplamento do input de teclado**
   - A lógica de keybindings está embutida diretamente na classe `Game`
   - `setupControls()` e `updatePlayerInput()` misturam responsabilidades

3. **Gestão paralela desnecessária**
   - `state.players[]` contém todos os jogadores
   - `bots: Map<string, BotAI>` existe separadamente para gerenciar IAs
   - Isso cria sincronização manual e complexidade

4. **Flags booleanas para polimorfismo**
   - `isBot?: boolean` e `botBehavior?: BotBehavior` no `Player`
   - Usar flags para diferenciar comportamento é anti-pattern

### Benefícios da Refatoração

- **Single Responsibility**: Cada classe faz uma coisa só
- **Extensibilidade**: Fácil adicionar gamepad, touch, network player
- **Testabilidade**: Controllers podem ser testados isoladamente
- **Simplicidade**: `Game` não precisa saber se é bot ou humano
- **Base sólida**: Facilitará implementar dificuldades de bots

---

## Arquitetura Proposta

### Nova Estrutura de Arquivos

```
src/
├── controllers/
│   ├── index.ts              # Exportações públicas
│   ├── Controller.ts         # Interface base
│   ├── KeyboardController.ts # Controle via teclado
│   └── BotController.ts      # Controle via IA (atual BotAI)
├── types.ts                  # Player simplificado
├── game.ts                   # Lógica unificada
└── ...
```

### Interface Controller

```typescript
// src/controllers/Controller.ts

import { Player, GameState } from '../types.js';

export interface Controller {
  /**
   * Atualiza o input do player baseado na fonte de controle.
   * Chamado a cada frame do jogo.
   */
  update(player: Player, gameState: GameState, dt: number): void;
  
  /**
   * Reseta o estado interno do controller.
   * Chamado quando o jogo reinicia.
   */
  reset(): void;
  
  /**
   * Libera recursos (event listeners, etc).
   * Chamado quando o controller é removido.
   */
  destroy(): void;
}
```

### KeyboardController

```typescript
// src/controllers/KeyboardController.ts

export class KeyboardController implements Controller {
  private keyState: Record<string, boolean> = {};
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.setupListeners();
  }

  update(player: Player, gameState: GameState, dt: number): void {
    const binds = keyBindings.getBindings();
    
    player.input.up = binds.up.some(key => this.keyState[key]);
    player.input.down = binds.down.some(key => this.keyState[key]);
    player.input.left = binds.left.some(key => this.keyState[key]);
    player.input.right = binds.right.some(key => this.keyState[key]);
    // kick é tratado via eventos separados
  }

  reset(): void {
    this.keyState = {};
  }

  destroy(): void {
    // Remove event listeners
  }

  // Métodos para kick handling...
}
```

### BotController

```typescript
// src/controllers/BotController.ts

export class BotController implements Controller {
  private behavior: BotBehavior;
  private movementQueue: Movement[] = [];
  // ... estado interno atual do BotAI

  constructor(behavior: BotBehavior) {
    this.behavior = behavior;
  }

  update(player: Player, gameState: GameState, dt: number): void {
    // Lógica atual do BotAI.update()
  }

  reset(): void {
    // Lógica atual do BotAI.reset()
  }

  destroy(): void {
    // Limpa filas, etc
  }
}
```

### Player Simplificado

```typescript
// src/types.ts

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
  kickCharge: number;
  isChargingKick: boolean;
  hasKickedThisPress: boolean;
  kickFeedbackTime: number;
  maxSpeedMultiplier?: number;
  
  // NOVO: Controller opcional
  controller?: Controller;
}

// REMOVER: isBot, botBehavior
```

### Game Unificado

```typescript
// src/game.ts

export class Game {
  // REMOVER: bots: Map<string, BotAI>
  
  /**
   * Adiciona uma entidade (jogador ou bot) ao jogo.
   */
  addEntity(config: {
    id: string;
    name: string;
    team: 'red' | 'blue';
    spawn: Vector2D;
    controller?: Controller;
    radius?: number;
    initialVelocity?: Vector2D;
  }): Player {
    const player: Player = {
      id: config.id,
      name: config.name,
      team: config.team,
      circle: Physics.createCircle(
        config.spawn.x, 
        config.spawn.y, 
        config.radius ?? this.config.playerRadius, 
        10
      ),
      input: { up: false, down: false, left: false, right: false, kick: false },
      kickCharge: 0,
      isChargingKick: false,
      hasKickedThisPress: false,
      kickFeedbackTime: 0,
      controller: config.controller
    };

    if (config.initialVelocity) {
      player.circle.vel = { ...config.initialVelocity };
    }

    this.state.players.push(player);
    return player;
  }

  private update(dt: number): void {
    // Atualiza todos os controllers
    for (const player of this.state.players) {
      if (player.controller) {
        player.controller.update(player, this.state, dt);
      }
    }

    // Resto da física...
  }
}
```

---

## Plano de Execução

### Etapa 1: Criar estrutura de Controllers
- [ ] Criar pasta `src/controllers/`
- [ ] Criar `Controller.ts` com interface
- [ ] Criar `index.ts` com exports

### Etapa 2: Implementar KeyboardController
- [ ] Mover lógica de `setupControls()` e `updatePlayerInput()` de `game.ts`
- [ ] Mover handlers de keydown/keyup
- [ ] Mover lógica de kick (handleKickInput, handleKickRelease)

### Etapa 3: Implementar BotController
- [ ] Copiar/adaptar `BotAI` para implementar interface `Controller`
- [ ] Manter toda a lógica de comportamentos (chase_ball, patrol, etc)

### Etapa 4: Atualizar types.ts
- [ ] Adicionar `controller?: Controller` ao `Player`
- [ ] Remover `isBot?: boolean`
- [ ] Remover `botBehavior?: BotBehavior`

### Etapa 5: Refatorar Game
- [ ] Criar método unificado `addEntity()`
- [ ] Remover `bots: Map<string, BotAI>`
- [ ] Atualizar loop de update para chamar `controller.update()`
- [ ] Adaptar `addPlayer()` e `addBot()` como wrappers (retrocompatibilidade)

### Etapa 6: Atualizar consumidores
- [ ] `main.ts` - usar novos métodos
- [ ] `playlist.ts` - atualizar criação de bots
- [ ] `editor.ts` - se necessário

### Etapa 7: Limpeza
- [ ] Remover `botAI.ts` (movido para controllers/)
- [ ] Remover código morto
- [ ] Testar todos os modos de jogo

---

## Exemplo de Uso Final

```typescript
// Modo treino livre com bots
const game = new Game(canvas, map, config);

// Jogador humano
game.addEntity({
  id: 'player-1',
  name: 'Você',
  team: 'red',
  spawn: { x: 200, y: 300 },
  controller: new KeyboardController()
});

// Bot amador (reação lenta, impreciso)
game.addEntity({
  id: 'bot-1',
  name: 'Bot Amador',
  team: 'blue',
  spawn: { x: 800, y: 300 },
  controller: new BotController({
    type: 'ai_preset',
    config: BOT_PRESETS.amateur // Preset pré-definido
  })
});

// Bot craque (reação rápida, preciso)
game.addEntity({
  id: 'bot-2',
  name: 'Bot Craque',
  team: 'blue', 
  spawn: { x: 800, y: 200 },
  controller: new BotController({
    type: 'ai_preset',
    config: BOT_PRESETS.pro
  })
});

game.start();
```

---

## Presets de Dificuldade (Fase 2)

Após a refatoração, criar presets de dificuldade será trivial:

```typescript
// src/controllers/botPresets.ts

export const BOT_PRESETS = {
  amateur: {
    reactionTime: 0.5,      // 500ms de delay
    speed: 0.5,             // 50% da velocidade
    accuracy: 0.6,          // Erros de posicionamento
    kickPrecision: 0.5      // Chutes imprecisos
  },
  
  juvenile: {
    reactionTime: 0.3,
    speed: 0.7,
    accuracy: 0.75,
    kickPrecision: 0.7
  },
  
  professional: {
    reactionTime: 0.15,
    speed: 0.9,
    accuracy: 0.9,
    kickPrecision: 0.85
  },
  
  star: {
    reactionTime: 0.05,     // Quase instantâneo
    speed: 1.0,             // Velocidade máxima
    accuracy: 0.98,         // Quase perfeito
    kickPrecision: 0.95     // Chutes precisos
  }
};
```

---

## Notas de Compatibilidade

Para manter compatibilidade durante a transição:

```typescript
// Wrappers temporários em game.ts

addPlayer(id: string, name: string, team: 'red' | 'blue'): void {
  const spawn = this.getSpawnPoint(team);
  this.addEntity({
    id,
    name,
    team,
    spawn,
    controller: id === this.controlledPlayerId 
      ? this.keyboardController 
      : undefined
  });
}

addBot(id: string, name: string, team: 'red' | 'blue', spawn: Vector2D, behavior: BotBehavior): void {
  this.addEntity({
    id,
    name,
    team,
    spawn,
    controller: new BotController(behavior)
  });
}
```

Esses wrappers podem ser removidos depois que todo o código for migrado.
