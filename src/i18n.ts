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
    en: 'HaxLab',
    pt: 'HaxLab'
  },
  'menu.play': {
    en: 'Play',
    pt: 'Jogar'
  },
  'menu.language': {
    en: 'Language',
    pt: 'Idioma'
  },

  // Game Modes Menu
  'modes.title': {
    en: 'Game Modes',
    pt: 'Modos de Jogo'
  },
  'modes.freeTraining': {
    en: 'Free Training',
    pt: 'Treino Livre'
  },
  'modes.playlists': {
    en: 'Playlists',
    pt: 'Playlists'
  },
  'modes.back': {
    en: 'Back',
    pt: 'Voltar'
  },

  // Playlists Menu
  'playlists.title': {
    en: 'Training Playlists',
    pt: 'Playlists de Treino'
  },
  'playlists.back': {
    en: 'Back',
    pt: 'Voltar'
  },

  // Settings Menu
  'settings.title': {
    en: 'Match Settings',
    pt: 'Configurações da Partida'
  },
  'settings.map': {
    en: 'Map',
    pt: 'Mapa'
  },
  'settings.mapDefault': {
    en: 'Default Stadium',
    pt: 'Estádio Padrão'
  },
  'settings.mapClassic': {
    en: 'Classic Arena',
    pt: 'Arena Clássica'
  },
  'settings.scoreLimit': {
    en: 'Score Limit',
    pt: 'Limite de Pontos'
  },
  'settings.timeLimit': {
    en: 'Time Limit (minutes)',
    pt: 'Limite de Tempo (minutos)'
  },
  'settings.kickMode': {
    en: 'Kick Mode',
    pt: 'Modo de Chute'
  },
  'settings.kickClassic': {
    en: 'Classic (instant)',
    pt: 'Clássico (instantâneo)'
  },
  'settings.kickChargeable': {
    en: 'Chargeable (hold to power up)',
    pt: 'Carregável (segure para carregar)'
  },
  'settings.ballColor': {
    en: 'Ball Color',
    pt: 'Cor da Bola'
  },
  'settings.ballBorderColor': {
    en: 'Ball Border Color',
    pt: 'Cor da Borda da Bola'
  },
  'settings.ballRadius': {
    en: 'Ball Radius',
    pt: 'Raio da Bola'
  },
  'settings.ballMass': {
    en: 'Ball Mass',
    pt: 'Massa da Bola'
  },
  'settings.ballDamping': {
    en: 'Ball Damping (friction)',
    pt: 'Amortecimento da Bola (fricção)'
  },
  'settings.apply': {
    en: 'Apply & Restart',
    pt: 'Aplicar & Reiniciar'
  },
  'settings.resume': {
    en: 'Resume',
    pt: 'Retomar'
  },

  // Play Menu
  'play.title': {
    en: 'HaxLab',
    pt: 'HaxLab'
  },
  'play.username': {
    en: 'Your Username',
    pt: 'Seu Nome de Usuário'
  },
  'play.randomName': {
    en: 'Generate random name',
    pt: 'Gerar nome aleatório'
  },
  'play.back': {
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
  'game.backToMenu': {
    en: 'Back to Menu',
    pt: 'Voltar ao Menu'
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
