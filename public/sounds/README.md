# Sistema de Áudio Sintetizado

O jogo usa Web Audio API para sintetizar sons configuráveis via JSON.

## Estrutura da Configuração

Cada som pode ter dois formatos:

### 1. Som Simples (com sweep de frequência)

```json
{
  "kick": {
    "type": "sine",           // Tipo de onda: "sine", "square", "sawtooth", "triangle"
    "frequency": 150,         // Frequência inicial em Hz
    "frequencyEnd": 40,       // Frequência final em Hz (opcional)
    "duration": 0.15,         // Duração em segundos
    "volume": 0.4,            // Volume (0.0 a 1.0)
    "attack": 0.001,          // Tempo de ataque em segundos
    "release": 0.1            // Tempo de release em segundos
  }
}
```

### 2. Som com Múltiplas Notas

```json
{
  "goal": {
    "type": "square",
    "notes": [
      { 
        "frequency": 523,     // Nota C5
        "startTime": 0,       // Início relativo em segundos
        "duration": 0.15,     // Duração da nota
        "volume": 0.3         // Volume relativo
      },
      { 
        "frequency": 659,     // Nota E5
        "startTime": 0.08, 
        "duration": 0.15, 
        "volume": 0.3 
      }
    ],
    "duration": 0.5,          // Duração total
    "volume": 0.3,            // Volume base
    "attack": 0.01,
    "release": 0.15
  }
}
```

## Tipos de Onda

- **sine** - Onda senoidal (suave, tom puro)
- **square** - Onda quadrada (8-bit, retrô)
- **sawtooth** - Onda serra (brilhante, agressiva)
- **triangle** - Onda triangular (meio termo entre sine e square)

## Frequências Musicais Comuns

| Nota | Frequência (Hz) |
|------|-----------------|
| C4   | 261.63         |
| D4   | 293.66         |
| E4   | 329.63         |
| F4   | 349.23         |
| G4   | 392.00         |
| A4   | 440.00         |
| B4   | 493.88         |
| C5   | 523.25         |
| D5   | 587.33         |
| E5   | 659.25         |
| F5   | 698.46         |
| G5   | 783.99         |

## Carregar Configuração Customizada

```typescript
import { audioManager } from './audio.js';

// Carregar de JSON
fetch('sounds/custom-sounds.json')
  .then(r => r.json())
  .then(config => audioManager.loadSounds(config));

// Ou atualizar som individual
audioManager.updateSound('kick', {
  type: 'square',
  frequency: 200,
  frequencyEnd: 50,
  duration: 0.2,
  volume: 0.5,
  attack: 0.001,
  release: 0.1
});
```

## Exemplos de Sons

### Chute Grave (Kick Pesado)
```json
{
  "type": "sine",
  "frequency": 180,
  "frequencyEnd": 30,
  "duration": 0.2,
  "volume": 0.5,
  "attack": 0.001,
  "release": 0.15
}
```

### Sucesso Épico
```json
{
  "type": "triangle",
  "notes": [
    { "frequency": 392, "startTime": 0, "duration": 0.12, "volume": 0.3 },
    { "frequency": 523, "startTime": 0.08, "duration": 0.12, "volume": 0.3 },
    { "frequency": 659, "startTime": 0.16, "duration": 0.12, "volume": 0.35 },
    { "frequency": 784, "startTime": 0.24, "duration": 0.2, "volume": 0.4 }
  ],
  "duration": 0.5,
  "volume": 0.3,
  "attack": 0.01,
  "release": 0.1
}
```

### Falha Dramática
```json
{
  "type": "sawtooth",
  "frequency": 300,
  "frequencyEnd": 80,
  "duration": 0.4,
  "volume": 0.3,
  "attack": 0.02,
  "release": 0.2
}
```
