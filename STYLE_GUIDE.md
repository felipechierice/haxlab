# HaxLab - Style Guide

## Visão Geral
HaxLab é um jogo de treinamento para Haxball, focado em melhorar habilidades de chute, drible e controle de bola. O estilo visual deve transmitir modernidade, profissionalismo e atmosfera de jogo esportivo.

## Paleta de Cores

### Cores Primárias
- **Primary Purple**: `#6366f1` (indigo-500) - Cor principal para botões e elementos interativos
- **Primary Dark**: `#4f46e5` (indigo-600) - Hover states e elementos de destaque
- **Accent Cyan**: `#06b6d4` (cyan-500) - Elementos secundários e detalhes

### Cores Neutras
- **Background Dark**: `#0f172a` (slate-900) - Fundo principal quando em jogo
- **Surface Dark**: `#1e293b` (slate-800) - Cards e containers
- **Surface Light**: `#334155` (slate-700) - Elementos elevados
- **Border**: `#475569` (slate-600) - Bordas sutis

### Cores de Estado
- **Success**: `#10b981` (emerald-500) - Ações positivas, gols, sucesso
- **Error**: `#ef4444` (red-500) - Erros, falhas
- **Warning**: `#f59e0b` (amber-500) - Avisos
- **Info**: `#3b82f6` (blue-500) - Informações neutras

### Cores de Time (Mantidas)
- **Red Team**: `#ff4757` - Time vermelho
- **Blue Team**: `#5352ed` - Time azul

## Tipografia

### Fontes
- **Primary**: `'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif` - Interface principal
- **Display**: `'Space Grotesk', 'Inter', sans-serif` - Títulos e números grandes
- **Monospace**: `'Fira Code', 'Courier New', monospace` - Console e códigos

### Hierarquia
- **H1**: 48px (3rem), font-weight: 800, letter-spacing: -0.02em
- **H2**: 36px (2.25rem), font-weight: 700, letter-spacing: -0.01em
- **H3**: 24px (1.5rem), font-weight: 600
- **Body**: 16px (1rem), font-weight: 400, line-height: 1.5
- **Small**: 14px (0.875rem), font-weight: 400

## Componentes

### Botões
- **Primary**: Background `#6366f1`, hover `#4f46e5`, padding 14px 32px, border-radius 12px
- **Secondary**: Background `rgba(100, 102, 241, 0.1)`, border `2px solid #6366f1`, hover adiciona opacidade
- **Success**: Background `#10b981`, usado para ações positivas (confirmar, aplicar)
- **Danger**: Background `#ef4444`, usado para ações destrutivas (deletar, cancelar)

### Cards/Modais
- Background: `rgba(30, 41, 59, 0.95)` com blur backdrop
- Border: `1px solid rgba(100, 102, 241, 0.2)`
- Border-radius: `20px`
- Box-shadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5)`
- Padding: `32px`

### Inputs
- Background: `rgba(51, 65, 85, 0.5)`
- Border: `2px solid rgba(100, 102, 241, 0.3)`
- Border-radius: `10px`
- Padding: `12px 16px`
- Focus: Border muda para `#6366f1`, adiciona glow com box-shadow

### Menu Principal
- Background: Gradient escuro `linear-gradient(135deg, #0f172a 0%, #1e293b 100%)`
- Cards flutuantes com glass-morphism
- Animações suaves de transição (0.3s ease)

## Animações

### Transições Padrão
- Duração: `300ms` (0.3s)
- Timing: `cubic-bezier(0.4, 0, 0.2, 1)` para suavidade

### Hover Effects
- Botões: `transform: translateY(-2px)` + `box-shadow` aumentado
- Cards: `transform: scale(1.02)` ou `translateY(-4px)`

### Feedback Visual
- Loading: Spinner ou pulsação
- Success: Fade-in com escala (scale de 0.9 para 1)
- Error: Shake animation

## Acessibilidade

### Contraste
- Texto sobre fundo escuro: mínimo 4.5:1 (WCAG AA)
- Botões e elementos interativos: mínimo 3:1
- Estados de foco claramente visíveis

### Interatividade
- Todos os elementos interativos devem ter estados de hover, focus e active
- Feedback visual imediato em todas as ações
- Tamanho mínimo de toque: 44x44px (para mobile/PWA)

## Elementos Específicos do Jogo

### HUD (Heads-Up Display)
- Fundo semi-transparente escuro: `rgba(15, 23, 42, 0.9)`
- Bordas arredondadas: `12px`
- Texto branco com sombra para legibilidade

### Placar
- Números grandes e destacados
- Cores de time nas pontuações
- Timer centralizado e proeminente

### Console
- Background: `rgba(0, 0, 0, 0.85)`
- Monospace font
- Scroll suave
- Mensagens com diferentes níveis de importância (cores diferentes)

## Responsividade

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Adaptações Mobile (PWA)
- Botões maiores (mínimo 48px altura)
- Menus full-screen em mobile
- Touch-friendly spacing (mínimo 8px entre elementos clicáveis)
- Orientação landscape preferencial para gameplay

## Efeitos Especiais

### Glass-morphism
```css
background: rgba(30, 41, 59, 0.7);
backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.1);
```

### Glow Effect (para destaque)
```css
box-shadow: 0 0 20px rgba(99, 102, 241, 0.5),
            0 0 40px rgba(99, 102, 241, 0.2);
```

### Gradient Text (títulos especiais)
```css
background: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

## Iconografia

- Usar emojis para ações rápidas: ⚽ 🎯 📋 ⚙️ 🏆
- Icons devem ter 20-24px de tamanho
- Sempre acompanhados de label textual

## Estados de Loading

- Skeleton screens para carregamento de listas
- Spinners para ações assíncronas
- Progress bars para processos longos
- Mensagens de feedback claras

## Microinterações

- Botões reagem ao clique com ligeira compressão (scale 0.95)
- Modais aparecem com fade + scale
- Toasts/notificações deslizam de cima
- Transições de página com fade
