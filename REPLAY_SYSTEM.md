# Sistema de Replay - HaxLab

## Visão Geral

O sistema de replay permite gravar e reproduzir execuções completas de playlists de treino, capturando cada pressionamento e soltura de tecla com timestamps precisos.

## Características

### Gravação de Replays

- ✅ Grava todos os inputs do jogador (movimento e chute)
- ✅ Registra timestamps em milissegundos
- ✅ Rastreia mudanças de cenário
- ✅ Inclui cenários resetados com R
- ✅ Descarta e recomeça ao pressionar Backspace
- ✅ Salva automaticamente no Firebase ao completar playlist

### Reprodução de Replays

- ✅ Reproduz inputs gravados no tempo exato
- ✅ Suporta todas as direções de movimento (8 direções)
- ✅ Sincroniza chutes com precisão
- ✅ Mantém consistência física determinística

### Interface de Usuário

- ✅ Botão "Assistir Replay" nas entradas de ranking
- ✅ Suporte para playlists oficiais e da comunidade
- ✅ Indicador visual quando replay não está disponível

## Arquitetura

### Arquivos Principais

#### `src/types.ts`
Define os tipos TypeScript para o sistema de replay:
- `ReplayInputEvent`: Evento individual de input
- `ReplayScenarioInfo`: Informação sobre cenários
- `ReplayData`: Estrutura completa do replay

#### `src/replay.ts`
Funções principais do sistema de replay:
- `ReplayRecorder`: Classe para gravar replays
- `saveReplay()`: Salva replay no Firebase
- `getReplayById()`: Busca replay por ID
- `getReplayForRankingEntry()`: Encontra replay associado a um ranking

#### `src/input/ReplayInputController.ts`
Controlador que reproduz inputs gravados:
- Implementa interface `InputController`
- Processa eventos baseado em tempo
- Simula inputs do jogador original

#### `src/input/KeyboardInputController.ts`
Modificado para gravar inputs:
- Adiciona suporte a `ReplayRecorder`
- Grava eventos keydown/keyup
- Mapeia teclas para ações de replay

#### `src/playlist.ts`
Integração com PlaylistRunner:
- `startReplayRecording()`: Inicia gravação
- `stopReplayRecording()`: Para e retorna dados
- `getReplayRecorder()`: Acessa recorder atual
- Grava mudanças de cenário automaticamente

#### `src/legacy-init.ts`
Integração no fluxo principal:
- Inicia gravação ao começar playlist
- Salva replay ao completar
- Associa replayId ao ranking

### Firebase

#### Coleções

1. **replays** (playlists oficiais)
   - `playlistName`: Nome da playlist
   - `playerNickname`: Nickname do jogador
   - `totalTime`: Tempo total em segundos
   - `events`: Array de eventos de input
   - `scenarios`: Array de informações de cenários
   - `recordedAt`: Timestamp de gravação
   - `version`: Versão do jogo

2. **community_replays** (playlists da comunidade)
   - Mesmos campos de `replays`
   - `playlistId`: ID da playlist da comunidade

3. **rankings** e **community_rankings**
   - Adicionado campo `replayId` (opcional)

## Fluxo de Execução

### Gravação

1. Jogador inicia playlist
2. `PlaylistRunner` cria `ReplayRecorder`
3. `KeyboardInputController` recebe referência ao recorder
4. A cada input, o recorder registra:
   - Timestamp (ms desde início)
   - Tipo de evento (keydown/keyup)
   - Ação (up/down/left/right/kick)
   - Índice do cenário atual
5. A cada mudança de cenário:
   - Recorder registra início do cenário
   - Marca se foi reset (tecla R)
6. Se pressionar Backspace:
   - Descarta todos os eventos gravados
   - Reinicia gravação do zero
7. Ao completar playlist:
   - Recorder para gravação
   - Dados são salvos no Firebase
   - `replayId` é associado ao ranking

### Reprodução

1. Usuário clica no botão "Assistir Replay"
2. Sistema busca replay pelo `replayId`
3. Cria `ReplayInputController` com os dados
4. Inicia playlist com o controller de replay
5. A cada frame:
   - Controller processa eventos até tempo atual
   - Aplica inputs correspondentes
   - Atualiza direção e estado de chute
6. Física do jogo reproduz movimentos originais

## Uso

### Para Gravar

A gravação é automática ao jogar qualquer playlist. Não requer ação do usuário.

### Para Assistir

1. Abra o ranking (oficial ou da comunidade)
2. Localize uma entrada com replay disponível
3. Clique no botão ▶️ (Play)
4. O replay será carregado e reproduzido

## Considerações Técnicas

### Determinismo

O sistema depende de física determinística para funcionar corretamente:
- Fixed timestep (60Hz)
- Mesma configuração de jogo
- Mesmos spawns e velocidades iniciais

### Otimizações

- Apenas grava eventos de input (não estados do jogo)
- Usa timestamps relativos (desde início da playlist)
- Compacta eventos em estrutura eficiente

### Limitações

- Replays dependem da versão do jogo (campo `version`)
- Mudanças na física podem invalidar replays antigos
- Tamanho do replay cresce com duração e quantidade de inputs

## Estrutura de Dados

### ReplayInputEvent
```typescript
{
  timestamp: number;      // ms desde início
  type: 'keydown' | 'keyup';
  action: 'up' | 'down' | 'left' | 'right' | 'kick';
  scenarioIndex: number;  // cenário ativo
}
```

### ReplayData
```typescript
{
  playlistName: string;
  playlistId?: string;
  playerNickname: string;
  totalTime: number;
  events: ReplayInputEvent[];
  scenarios: ReplayScenarioInfo[];
  recordedAt: number;
  version: string;
}
```

## Manutenção

### Adicionar Novo Tipo de Input

1. Adicionar à `ReplayAction` em `types.ts`
2. Atualizar `keyToReplayAction()` em `replay.ts`
3. Atualizar `applyEvent()` em `ReplayInputController.ts`

### Modificar Estrutura de Dados

1. Atualizar tipos em `types.ts`
2. Incrementar `APP_VERSION` em `version.ts`
3. Adicionar migração se necessário

## Firebase Security Rules

As regras do Firestore estão configuradas em `firestore.rules`:
- Leitura pública de replays
- Escrita apenas para usuários autenticados
- Validação de estrutura de dados
- Sem atualização de replays (imutáveis)

## Deploy

Após modificar as regras do Firestore:
```bash
firebase deploy --only firestore:rules
```

## Testes Recomendados

1. ✅ Gravar replay curto (1 cenário)
2. ✅ Gravar replay longo (múltiplos cenários)
3. ✅ Testar reset de cenário (tecla R)
4. ✅ Testar restart de playlist (Backspace)
5. ✅ Verificar salvamento no Firebase
6. ✅ Reproduzir replay salvo
7. ✅ Verificar botão no ranking
8. ✅ Testar com playlist da comunidade
