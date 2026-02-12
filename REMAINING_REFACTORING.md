# Refatoração restante

Itens remanescentes após a migração para React (fases 1–7).

---

## 🔴 Alta prioridade — Funcionalidade quebrada

### 1. Game Over não funciona (`src/game.ts`)

`showGameOver()` (linha ~753) busca `document.getElementById('game-container')` para anexar o overlay de fim de jogo, e `showMenu()` (linha ~832) busca `getElementById('menu')` para voltar ao menu. Ambos os elementos **não existem mais** — o React usa `className="game-container"` (sem `id`) e o `#menu` foi removido na fase 7.

**Resultado:** o overlay de game-over nunca aparece. O botão "Play Again" e "Back to Menu" não funcionam.

**Correção sugerida:** refatorar `showGameOver()` e `showMenu()` em `game.ts` para disparar eventos customizados (`game-over`, `game-menu`) que o `GamePage.tsx` escuta — similar ao padrão já usado com `playlist-complete`. O overlay passaria a ser um componente React renderizado condicionalmente dentro do GamePage.

```
game.ts:  showGameOver()     → window.dispatchEvent(new CustomEvent('game-over', { detail: { winner, score } }))
game.ts:  showMenu()         → window.dispatchEvent(new CustomEvent('game-back-to-menu'))
GamePage: useEffect listener → setState para renderizar overlay React / navegar para /modes
```

---

### 2. `game-info` sem `id` (`src/legacy-init.ts` ↔ `src/pages/GamePage.tsx`)

`initGameCanvas`, `initEditorCanvas` e `initPlaylistCanvas` em `legacy-init.ts` fazem `getElementById('game-info')` para alternar a visibilidade entre modo livre e playlist. Porém `GamePage.tsx` renderiza `<div className="game-info">` — sem `id`.

**Resultado:** os toggles de visibilidade de `game-info` são silenciosamente ignorados (retornam `null`). Na prática o div fica sempre visível, mesmo em modo playlist/editor onde deveria estar oculto.

**Correção sugerida (rápida):** adicionar `id="game-info"` ao div em `GamePage.tsx`.

**Correção sugerida (ideal):** controlar a visibilidade via estado React (`showGameInfo`) definido por eventos do legacy-init, eliminando a manipulação direta de DOM.

---

## 🟡 Média prioridade — Código morto / conflitos

### 3. Seção de keybind em `legacy-init.ts` é dead code (linhas ~141–190)

Todo o bloco de configuração de keybindings em `legacy-init.ts` é obsoleto:

- **`updateKeybindingsDisplay()`** — referencia inputs DOM (`keybind-up`, `keybind-down`, etc.) que não existem mais em nenhum HTML ou componente React.
- **`window.configureKeybind`** e **`window.resetKeybindings`** — sobrescritos pelo `SettingsPage.tsx` quando a página é montada, e deletados quando desmontada. As versões de legacy-init referenciam DOM inexistente.
- **Listener global de `keydown`** (linha ~170) — intercepta teclas quando `currentlyConfiguringAction` está setado, mas manipula inputs DOM que não existem. Pode conflitar com o listener do `SettingsPage.tsx`.
- **`currentlyConfiguringKeybind`** (linha ~143) — variável declarada mas **nunca usada** (o código usa `currentlyConfiguringAction` do topo do arquivo).

**Correção sugerida:** deletar o bloco inteiro (linhas ~141–190) e remover `currentlyConfiguringAction` do topo se não for mais necessário após a remoção.

---

### 4. `game-container` sem `id` em GamePage

Assim como o `game-info`, o `<div className="game-container">` em `GamePage.tsx` não tem `id`. Atualmente nenhum código no bridge (`legacy-init.ts`) faz `getElementById('game-container')`, então o impacto é apenas no `game.ts` (coberto pelo item 1). Mas se futuramente for necessário manipular o container de fora, o `id` será necessário.

**Correção sugerida:** adicionar `id="game-container"` ao div (ou resolver via item 1).

---

## 🟢 Baixa prioridade — Lixo residual

### 5. Evento `language-change` nunca consumido (`src/hooks/useI18n.ts`)

O hook `useI18n` (linha ~28) despacha `new Event('language-change')` no `window`, mas **nenhum código** escuta esse evento. Era usado para atualizar elementos DOM legados via `updateTranslations()`, que foi removida na fase 7.

**Correção:** remover as linhas 28–29 de `useI18n.ts`.

---

### 6. Dependências não utilizadas no `package.json`

| Pacote         | Tipo           | Motivo                                                  |
| -------------- | -------------- | ------------------------------------------------------- |
| `concurrently` | devDependency  | Usado no workflow antigo (pré-Vite). Nenhum script o referencia. |
| `http-server`  | devDependency  | Substituído pelo dev server do Vite. Nenhum script o referencia. |

**Correção:** `pnpm remove -D concurrently http-server`

---

## 📋 Resumo

| #   | Arquivo             | Severidade | Descrição                                                |
| --- | ------------------- | ---------- | -------------------------------------------------------- |
| 1   | `game.ts`           | 🔴 Alta    | Game-over overlay e `showMenu()` referem DOM inexistente |
| 2   | `legacy-init.ts`    | 🔴 Alta    | `getElementById('game-info')` retorna `null`             |
| 3   | `legacy-init.ts`    | 🟡 Média   | Bloco de keybind (~50 linhas) é 100% dead code           |
| 4   | `GamePage.tsx`      | 🟡 Média   | `game-container` como class sem id                       |
| 5   | `useI18n.ts`        | 🟢 Baixa   | Evento `language-change` disparado sem listener           |
| 6   | `package.json`      | 🟢 Baixa   | `concurrently` e `http-server` não utilizados             |
