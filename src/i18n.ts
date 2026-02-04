export type Language = 'en' | 'pt';

interface Translations {
  [key: string]: {
    en: string;
    pt: string;
  };
}

export const translations: Translations = {
  // Main Menu
  'menu.title': {
    en: '⚽ Ballers',
    pt: '⚽ Ballers'
  },
  'menu.play': {
    en: 'Play',
    pt: 'Jogar'
  },
  'menu.language': {
    en: 'Language',
    pt: 'Idioma'
  },

  // Play Menu
  'play.title': {
    en: '⚽ Ballers',
    pt: '⚽ Ballers'
  },
  'play.username': {
    en: 'Your Username',
    pt: 'Seu Nome de Usuário'
  },
  'play.randomName': {
    en: 'Generate random name',
    pt: 'Gerar nome aleatório'
  },
  'play.hostRoom': {
    en: 'Host Room',
    pt: 'Criar Sala'
  },
  'play.joinCode': {
    en: 'Join with Code',
    pt: 'Entrar com Código'
  },
  'play.listRooms': {
    en: 'List Rooms',
    pt: 'Listar Salas'
  },
  'play.back': {
    en: 'Back',
    pt: 'Voltar'
  },

  // Rooms List
  'rooms.title': {
    en: 'Available Rooms',
    pt: 'Salas Disponíveis'
  },
  'rooms.refresh': {
    en: '🔄 Refresh',
    pt: '🔄 Atualizar'
  },
  'rooms.loading': {
    en: 'Loading rooms...',
    pt: 'Carregando salas...'
  },
  'rooms.noRooms': {
    en: 'No public rooms available. Create one!',
    pt: 'Nenhuma sala pública disponível. Crie uma!'
  },
  'rooms.tableCode': {
    en: 'Room Code',
    pt: 'Código'
  },
  'rooms.tableName': {
    en: 'Name',
    pt: 'Nome'
  },
  'rooms.tablePlayers': {
    en: 'Players',
    pt: 'Jogadores'
  },
  'rooms.tableMode': {
    en: 'Mode',
    pt: 'Modo'
  },
  'rooms.tableKick': {
    en: 'Kick',
    pt: 'Chute'
  },
  'rooms.tableScore': {
    en: 'Score',
    pt: 'Placar'
  },
  'rooms.tableTime': {
    en: 'Time',
    pt: 'Tempo'
  },
  'rooms.tablePing': {
    en: 'Ping',
    pt: 'Ping'
  },
  'rooms.back': {
    en: 'Back',
    pt: 'Voltar'
  },

  // Host Room
  'host.title': {
    en: 'Host Room',
    pt: 'Criar Sala'
  },
  'host.roomName': {
    en: 'Room Name',
    pt: 'Nome da Sala'
  },
  'host.roomNamePlaceholder': {
    en: 'My Room',
    pt: 'Minha Sala'
  },
  'host.map': {
    en: 'Map',
    pt: 'Mapa'
  },
  'host.mapDefault': {
    en: 'Default Stadium',
    pt: 'Estádio Padrão'
  },
  'host.mapClassic': {
    en: 'Classic Arena',
    pt: 'Arena Clássica'
  },
  'host.playersPerTeam': {
    en: 'Players per Team',
    pt: 'Jogadores por Time'
  },
  'host.scoreLimit': {
    en: 'Score Limit',
    pt: 'Limite de Pontos'
  },
  'host.timeLimit': {
    en: 'Time Limit (minutes)',
    pt: 'Limite de Tempo (minutos)'
  },
  'host.kickMode': {
    en: 'Kick Mode',
    pt: 'Modo de Chute'
  },
  'host.kickClassic': {
    en: 'Classic (instant)',
    pt: 'Clássico (instantâneo)'
  },
  'host.kickChargeable': {
    en: 'Chargeable (hold to power up)',
    pt: 'Carregável (segure para carregar)'
  },
  'host.ballColor': {
    en: 'Ball Color',
    pt: 'Cor da Bola'
  },
  'host.ballBorderColor': {
    en: 'Ball Border Color',
    pt: 'Cor da Borda da Bola'
  },
  'host.ballRadius': {
    en: 'Ball Radius',
    pt: 'Raio da Bola'
  },
  'host.ballMass': {
    en: 'Ball Mass',
    pt: 'Massa da Bola'
  },
  'host.ballDamping': {
    en: 'Ball Damping (friction)',
    pt: 'Amortecimento da Bola (fricção)'
  },
  'host.password': {
    en: 'Password (optional)',
    pt: 'Senha (opcional)'
  },
  'host.passwordPlaceholder': {
    en: 'Leave empty for public room',
    pt: 'Deixe vazio para sala pública'
  },
  'host.create': {
    en: 'Create & Start',
    pt: 'Criar & Iniciar'
  },
  'host.back': {
    en: 'Back',
    pt: 'Voltar'
  },

  // Game
  'game.red': {
    en: 'Red',
    pt: 'Vermelho'
  },
  'game.blue': {
    en: 'Blue',
    pt: 'Azul'
  },
  'game.time': {
    en: 'Time',
    pt: 'Tempo'
  },
  'game.room': {
    en: 'Room',
    pt: 'Sala'
  },
  'game.copy': {
    en: 'Copy',
    pt: 'Copiar'
  },
  'game.backToMenu': {
    en: 'Back to Menu',
    pt: 'Voltar ao Menu'
  },
  'game.spectating': {
    en: '👁️ Spectating - Press ESC to open Room Menu',
    pt: '👁️ Espectando - Pressione ESC para abrir Menu da Sala'
  },
  'game.chatPlaceholder': {
    en: 'Press Enter to chat...',
    pt: 'Pressione Enter para conversar...'
  }
};

class I18n {
  private currentLang: Language = 'en';
  private listeners: Array<() => void> = [];

  constructor() {
    // Carregar idioma salvo ou detectar idioma do navegador
    const savedLang = localStorage.getItem('language') as Language | null;
    if (savedLang && (savedLang === 'en' || savedLang === 'pt')) {
      this.currentLang = savedLang;
    } else {
      // Detectar idioma do navegador
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('pt')) {
        this.currentLang = 'pt';
      }
    }
  }

  t(key: string): string {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
    return translation[this.currentLang];
  }

  getLanguage(): Language {
    return this.currentLang;
  }

  setLanguage(lang: Language): void {
    if (this.currentLang === lang) return;
    this.currentLang = lang;
    localStorage.setItem('language', lang);
    this.notifyListeners();
  }

  onChange(callback: () => void): void {
    this.listeners.push(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }
}

export const i18n = new I18n();
