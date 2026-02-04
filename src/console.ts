export interface ConsoleMessage {
  type: 'event' | 'chat';
  text: string;
  timestamp: number;
}

export class GameConsole {
  private messagesElement: HTMLElement;
  private inputContainer: HTMLElement;
  private inputElement: HTMLInputElement;
  private messages: ConsoleMessage[] = [];
  private maxMessages: number = 100;
  private isInputActive: boolean = false;
  private onChatMessageCallback: ((message: string) => void) | null = null;
  private onEventBroadcastCallback: ((text: string, type: 'event' | 'chat') => void) | null = null;

  constructor() {
    this.messagesElement = document.getElementById('console-messages')!;
    this.inputContainer = document.getElementById('console-input-container')!;
    this.inputElement = document.getElementById('console-input') as HTMLInputElement;
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Enter para ativar/desativar modo digitação
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        
        if (this.isInputActive) {
          // Se está digitando, envia a mensagem
          const message = this.inputElement.value.trim();
          if (message) {
            this.sendChatMessage(message);
          }
          this.deactivateInput();
        } else {
          // Se não está digitando, ativa o modo digitação
          this.activateInput();
        }
      } else if (e.key === 'Escape' && this.isInputActive) {
        // ESC para cancelar digitação
        e.preventDefault();
        this.deactivateInput();
      }
    });

    // Impede que o input perca o foco enquanto está ativo
    this.inputElement.addEventListener('blur', () => {
      if (this.isInputActive) {
        setTimeout(() => this.inputElement.focus(), 0);
      }
    });
  }

  private activateInput(): void {
    this.isInputActive = true;
    this.inputContainer.classList.add('active');
    this.inputElement.value = '';
    this.inputElement.focus();
  }

  private deactivateInput(): void {
    this.isInputActive = false;
    this.inputContainer.classList.remove('active');
    this.inputElement.value = '';
    this.inputElement.blur();
  }

  private sendChatMessage(message: string): void {
    if (this.onChatMessageCallback) {
      this.onChatMessageCallback(message);
    }
  }

  public addMessage(text: string, type: 'event' | 'chat' = 'event', broadcast: boolean = true): void {
    const message: ConsoleMessage = {
      type,
      text,
      timestamp: Date.now()
    };

    this.messages.push(message);
    
    // Limita o número de mensagens
    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }

    this.renderMessage(message);
    this.scrollToBottom();
    
    // Notifica para broadcast (se for host e se broadcast=true)
    // Chat messages não devem usar esse sistema (têm sistema próprio)
    if (broadcast && type === 'event' && this.onEventBroadcastCallback) {
      this.onEventBroadcastCallback(text, type);
    }
  }

  private renderMessage(message: ConsoleMessage): void {
    const div = document.createElement('div');
    div.className = `console-message ${message.type}`;
    
    // Parse de códigos de cor: ^1 = vermelho, ^2 = verde, ^3 = amarelo, ^4 = azul, ^5 = ciano, ^6 = magenta, ^7 = branco, ^0 = preto
    const colorCodes: { [key: string]: string } = {
      '^0': '#000',
      '^1': '#f00',
      '^2': '#0f0',
      '^3': '#ff0',
      '^4': '#00f',
      '^5': '#0ff',
      '^6': '#f0f',
      '^7': '#fff',
      '^8': '#ffa500',
      '^9': '#999'
    };

    let html = '';
    let currentColor = message.type === 'chat' ? '#fff' : '#aaa';
    let i = 0;
    
    while (i < message.text.length) {
      // Verifica se há um código de cor
      if (message.text[i] === '^' && i + 1 < message.text.length) {
        const code = message.text.substring(i, i + 2);
        if (colorCodes[code]) {
          currentColor = colorCodes[code];
          i += 2;
          continue;
        }
      }
      
      // Adiciona o caractere com a cor atual
      const char = message.text[i];
      if (char === '<') {
        html += '&lt;';
      } else if (char === '>') {
        html += '&gt;';
      } else if (char === '&') {
        html += '&amp;';
      } else {
        html += `<span style="color: ${currentColor}">${char}</span>`;
      }
      i++;
    }

    div.innerHTML = html;
    this.messagesElement.appendChild(div);
  }

  private scrollToBottom(): void {
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  }

  public isTyping(): boolean {
    return this.isInputActive;
  }

  public onEventBroadcast(callback: (text: string, type: 'event' | 'chat') => void): void {
    this.onEventBroadcastCallback = callback;
  }

  public onChatMessage(callback: (message: string) => void): void {
    this.onChatMessageCallback = callback;
  }

  public clear(): void {
    this.messages = [];
    this.messagesElement.innerHTML = '';
  }

  // Métodos de conveniência para eventos comuns
  public logPlayerJoined(playerName: string): void {
    this.addMessage(`^2${playerName}^7 joined the room`, 'event');
  }

  public logPlayerLeft(playerName: string): void {
    this.addMessage(`^1${playerName}^7 left the room`, 'event');
  }

  public logTeamChange(playerName: string, team: string): void {
    const teamColor = team === 'red' ? '^1' : team === 'blue' ? '^4' : '^9';
    const teamName = team === 'spectator' ? 'Spectators' : `${team.charAt(0).toUpperCase() + team.slice(1)} Team`;
    this.addMessage(`^7${playerName}^7 moved to ${teamColor}${teamName}`, 'event');
  }

  public logGoal(playerName: string, team: 'red' | 'blue'): void {
    const teamColor = team === 'red' ? '^1' : '^4';
    this.addMessage(`${teamColor}⚽ GOAL! ${playerName}^7 scored!`, 'event');
  }

  public logGameStart(): void {
    this.addMessage('^2▶ Game started!', 'event');
  }

  public logGamePause(): void {
    this.addMessage('^3⏸ Game paused', 'event');
  }

  public logGameResume(): void {
    this.addMessage('^2▶ Game resumed', 'event');
  }

  public logGameEnd(winner: 'red' | 'blue' | 'draw'): void {
    if (winner === 'draw') {
      this.addMessage('^3⏹ Game ended - Draw!', 'event');
    } else {
      const color = winner === 'red' ? '^1' : '^4';
      this.addMessage(`${color}⏹ Game ended - ${winner.toUpperCase()} WINS!`, 'event');
    }
  }

  public addChatMessage(playerName: string, message: string): void {
    // Chat messages usam broadcast=false porque têm sistema próprio de network
    this.addMessage(`^7${playerName}^7: ${message}`, 'chat', false);
  }
}
