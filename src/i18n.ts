export type Language = 'en' | 'pt' | 'es';

interface Translations {
  [key: string]: {
    en: string;
    pt: string;
    es: string;
  };
}

export const translations: Translations = {
  // Main Menu
  'menu.title': {
    en: 'HaxLab',
    pt: 'HaxLab',
    es: 'HaxLab'
  },
  'menu.play': {
    en: 'Play',
    pt: 'Jogar',
    es: 'Jugar'
  },
  'menu.language': {
    en: 'Language',
    pt: 'Idioma',
    es: 'Idioma'
  },
  'menu.nickname': {
    en: 'Nickname',
    pt: 'Nickname',
    es: 'Apodo'
  },
  'menu.nickname.placeholder': {
    en: 'Enter your nickname',
    pt: 'Digite seu nickname',
    es: 'Ingresa tu apodo'
  },
  'menu.nickname.random': {
    en: 'Random nickname',
    pt: 'Nome aleatório',
    es: 'Apodo aleatorio'
  },
  'menu.ranking': {
    en: 'Ranking',
    pt: 'Ranking',
    es: 'Clasificación'
  },

  // Game Modes Menu
  'modes.title': {
    en: 'Game Modes',
    pt: 'Modos de Jogo',
    es: 'Modos de Juego'
  },
  'modes.freeTraining': {
    en: 'Free Training',
    pt: 'Treino Livre',
    es: 'Entrenamiento Libre'
  },
  'modes.playlists': {
    en: 'Playlists',
    pt: 'Playlists',
    es: 'Listas de Reproducción'
  },
  'modes.playlistEditor': {
    en: 'Playlist Editor',
    pt: 'Editor de Playlists',
    es: 'Editor de Listas'
  },
  'modes.back': {
    en: 'Back',
    pt: 'Voltar',
    es: 'Volver'
  },

  // Playlists Menu
  'playlists.title': {
    en: 'Training Playlists',
    pt: 'Playlists de Treino',
    es: 'Listas de Entrenamiento'
  },
  'playlists.back': {
    en: 'Back',
    pt: 'Voltar',
    es: 'Volver'
  },
  'playlists.import': {
    en: 'Import Playlist JSON',
    pt: 'Importar Playlist JSON',
    es: 'Importar Lista JSON'
  },
  'playlists.importError': {
    en: 'Error importing playlist! Check if the JSON file is in the correct format.',
    pt: 'Erro ao importar playlist! Verifique se o arquivo JSON está no formato correto.',
    es: '¡Error al importar la lista! Verifica que el archivo JSON esté en el formato correcto.'
  },
  'playlists.loadError': {
    en: 'Error loading playlist details!',
    pt: 'Erro ao carregar detalhes da playlist!',
    es: '¡Error al cargar detalles de la lista!'
  },
  'playlists.selectPrompt': {
    en: 'Select a playlist to view details',
    pt: 'Selecione uma playlist para ver detalhes',
    es: 'Selecciona una lista para ver detalles'
  },
  'playlists.startPlaylist': {
    en: 'Start Playlist',
    pt: 'Iniciar Playlist',
    es: 'Iniciar Lista'
  },
  'playlists.info': {
    en: 'Information',
    pt: 'Informações',
    es: 'Información'
  },
  'playlists.ranking': {
    en: 'Ranking',
    pt: 'Ranking',
    es: 'Clasificación'
  },
  'playlists.description': {
    en: 'Description:',
    pt: 'Descrição:',
    es: 'Descripción:'
  },
  'playlists.noDescription': {
    en: 'No description available',
    pt: 'Sem descrição disponível',
    es: 'Sin descripción disponible'
  },
  'playlists.scenarios': {
    en: 'Scenarios:',
    pt: 'Cenários:',
    es: 'Escenarios:'
  },
  'playlists.scenariosCount': {
    en: 'scenarios',
    pt: 'cenários',
    es: 'escenarios'
  },
  'playlists.avgTime': {
    en: 'Average time:',
    pt: 'Tempo médio:',
    es: 'Tiempo promedio:'
  },
  'playlists.avgKicks': {
    en: 'Average kicks:',
    pt: 'Média de chutes:',
    es: 'Patadas promedio:'
  },
  'playlists.yourBestScore': {
    en: 'Your Best Score',
    pt: 'Seu Melhor Score',
    es: 'Tu Mejor Puntuación'
  },
  'playlists.score': {
    en: 'Score:',
    pt: 'Pontuação:',
    es: 'Puntuación:'
  },
  'playlists.position': {
    en: 'Position:',
    pt: 'Posição:',
    es: 'Posición:'
  },
  'playlists.kicks': {
    en: 'Kicks:',
    pt: 'Chutes:',
    es: 'Patadas:'
  },
  'playlists.time': {
    en: 'Time:',
    pt: 'Tempo:',
    es: 'Tiempo:'
  },
  'playlists.topPlayers': {
    en: 'Top Players',
    pt: 'Top Players',
    es: 'Mejores Jugadores'
  },
  'playlists.loading': {
    en: 'Loading...',
    pt: 'Carregando...',
    es: 'Cargando...'
  },
  'playlists.pts': {
    en: 'pts',
    pt: 'pts',
    es: 'pts'
  },
  'playlists.kicksUnit': {
    en: 'kicks',
    pt: 'chutes',
    es: 'patadas'
  },

  // Playlist Result Modal
  'result.title': {
    en: 'Playlist Complete!',
    pt: 'Playlist Completa!',
    es: '¡Lista Completa!'
  },
  'result.yourResult': {
    en: 'Your Result',
    pt: 'Seu Resultado',
    es: 'Tu Resultado'
  },
  'result.kicks': {
    en: 'Kicks',
    pt: 'Chutes',
    es: 'Patadas'
  },
  'result.time': {
    en: 'Time',
    pt: 'Tempo',
    es: 'Tiempo'
  },
  'result.score': {
    en: 'Score',
    pt: 'Score',
    es: 'Puntuación'
  },
  'result.yourHighscore': {
    en: 'Your Highscore',
    pt: 'Seu Highscore',
    es: 'Tu Puntuación Máxima'
  },
  'result.bestScore': {
    en: 'Best score:',
    pt: 'Melhor pontuação:',
    es: 'Mejor puntuación:'
  },
  'result.newRecord': {
    en: 'NEW RECORD!',
    pt: 'NOVO RECORDE!',
    es: '¡NUEVO RÉCORD!'
  },
  'result.top10': {
    en: 'Top 10',
    pt: 'Top 10',
    es: 'Top 10'
  },
  'result.loadingRanking': {
    en: 'Loading ranking...',
    pt: 'Carregando ranking...',
    es: 'Cargando clasificación...'
  },
  'result.rank': {
    en: '#',
    pt: '#',
    es: '#'
  },
  'result.player': {
    en: 'Player',
    pt: 'Jogador',
    es: 'Jugador'
  },
  'result.noRankings': {
    en: 'No rankings yet. Be the first!',
    pt: 'Nenhum ranking ainda. Seja o primeiro!',
    es: '¡Aún no hay clasificaciones. Sé el primero!'
  },
  'result.customPlaylist': {
    en: 'This is a custom playlist.',
    pt: 'Esta é uma playlist customizada.',
    es: 'Esta es una lista personalizada.'
  },
  'result.customPlaylistNote': {
    en: 'Rankings are saved only for official playlists.',
    pt: 'Rankings são salvos apenas para playlists oficiais.',
    es: 'Las clasificaciones se guardan solo para listas oficiales.'
  },
  'result.tryAgain': {
    en: 'Try Again',
    pt: 'Tentar Novamente',
    es: 'Intentar de Nuevo'
  },
  'result.backToPlaylists': {
    en: 'Back to Playlists',
    pt: 'Voltar às Playlists',
    es: 'Volver a las Listas'
  },

  // Ranking Modal
  'ranking.title': {
    en: 'Ranking',
    pt: 'Ranking',
    es: 'Clasificación'
  },
  'ranking.playlist': {
    en: 'Playlist:',
    pt: 'Playlist:',
    es: 'Lista:'
  },
  'ranking.global': {
    en: 'Global (All Playlists)',
    pt: 'Global (Todas Playlists)',
    es: 'Global (Todas las Listas)'
  },
  'ranking.loading': {
    en: 'Loading...',
    pt: 'Carregando...',
    es: 'Cargando...'
  },
  'ranking.nickname': {
    en: 'Nickname',
    pt: 'Nickname',
    es: 'Apodo'
  },
  'ranking.playlistName': {
    en: 'Playlist',
    pt: 'Playlist',
    es: 'Lista'
  },
  'ranking.noRankings': {
    en: 'No rankings yet',
    pt: 'Nenhum ranking ainda',
    es: 'Aún no hay clasificaciones'
  },
  'ranking.close': {
    en: 'Close',
    pt: 'Fechar',
    es: 'Cerrar'
  },

  // Settings Menu
  'settings.title': {
    en: 'Match Settings',
    pt: 'Configurações da Partida',
    es: 'Configuración del Partido'
  },
  'settings.matchRules': {
    en: 'Match Rules',
    pt: 'Regras da Partida',
    es: 'Reglas del Partido'
  },
  'settings.player': {
    en: 'Player',
    pt: 'Jogador',
    es: 'Jugador'
  },
  'settings.ball': {
    en: 'Ball',
    pt: 'Bola',
    es: 'Balón'
  },
  'settings.controls': {
    en: 'Controls',
    pt: 'Controles',
    es: 'Controles'
  },
  'settings.map': {
    en: 'Map',
    pt: 'Mapa',
    es: 'Mapa'
  },
  'settings.mapDefault': {
    en: 'Default Stadium',
    pt: 'Estádio Padrão',
    es: 'Estadio Predeterminado'
  },
  'settings.mapClassic': {
    en: 'Classic Arena',
    pt: 'Arena Clássica',
    es: 'Arena Clásica'
  },
  'settings.scoreLimit': {
    en: 'Score Limit',
    pt: 'Limite de Pontos',
    es: 'Límite de Puntos'
  },
  'settings.timeLimit': {
    en: 'Time Limit (minutes)',
    pt: 'Limite de Tempo (minutos)',
    es: 'Límite de Tiempo (minutos)'
  },
  'settings.kickMode': {
    en: 'Kick Mode',
    pt: 'Modo de Chute',
    es: 'Modo de Patada'
  },
  'settings.kickClassic': {
    en: 'Classic (instant)',
    pt: 'Clássico (instantâneo)',
    es: 'Clásico (instantáneo)'
  },
  'settings.kickChargeable': {
    en: 'Chargeable (hold to power up)',
    pt: 'Carregável (segure para carregar)',
    es: 'Cargable (mantén para cargar)'
  },
  'settings.playerSize': {
    en: 'Size',
    pt: 'Tamanho',
    es: 'Tamaño'
  },
  'settings.playerSpeed': {
    en: 'Speed',
    pt: 'Velocidade',
    es: 'Velocidad'
  },
  'settings.playerAcceleration': {
    en: 'Acceleration',
    pt: 'Aceleração',
    es: 'Aceleración'
  },
  'settings.kickStrength': {
    en: 'Kick Strength',
    pt: 'Força do Chute',
    es: 'Fuerza de Patada'
  },
  'settings.kickSpeedMultiplier': {
    en: 'Speed While Holding Kick',
    pt: 'Velocidade ao Segurar Chute',
    es: 'Velocidad al Mantener Patada'
  },
  'settings.ballColor': {
    en: 'Ball Color',
    pt: 'Cor da Bola',
    es: 'Color del Balón'
  },
  'settings.ballBorderColor': {
    en: 'Ball Border Color',
    pt: 'Cor da Borda da Bola',
    es: 'Color del Borde del Balón'
  },
  'settings.ballRadius': {
    en: 'Ball Radius',
    pt: 'Raio da Bola',
    es: 'Radio del Balón'
  },
  'settings.ballMass': {
    en: 'Ball Mass',
    pt: 'Massa da Bola',
    es: 'Masa del Balón'
  },
  'settings.ballDamping': {
    en: 'Ball Damping (friction)',
    pt: 'Amortecimento da Bola (fricção)',
    es: 'Amortiguación del Balón (fricción)'
  },
  'settings.resetDefault': {
    en: 'Restore default',
    pt: 'Restaurar padrão',
    es: 'Restaurar predeterminado'
  },
  'settings.moveUp': {
    en: 'Move Up',
    pt: 'Mover Cima',
    es: 'Mover Arriba'
  },
  'settings.moveDown': {
    en: 'Move Down',
    pt: 'Mover Baixo',
    es: 'Mover Abajo'
  },
  'settings.moveLeft': {
    en: 'Move Left',
    pt: 'Mover Esquerda',
    es: 'Mover Izquierda'
  },
  'settings.moveRight': {
    en: 'Move Right',
    pt: 'Mover Direita',
    es: 'Mover Derecha'
  },
  'settings.kick': {
    en: 'Kick',
    pt: 'Chutar',
    es: 'Patear'
  },
  'settings.switchPlayer': {
    en: 'Switch Player',
    pt: 'Trocar Jogador',
    es: 'Cambiar Jugador'
  },
  'settings.pressKey': {
    en: 'Press a key...',
    pt: 'Pressione uma tecla...',
    es: 'Presiona una tecla...'
  },
  'settings.change': {
    en: 'Change',
    pt: 'Mudar',
    es: 'Cambiar'
  },
  'settings.resetDefaults': {
    en: 'Restore Defaults',
    pt: 'Restaurar Padrões',
    es: 'Restaurar Predeterminados'
  },
  'settings.apply': {
    en: 'Apply & Restart',
    pt: 'Aplicar & Reiniciar',
    es: 'Aplicar y Reiniciar'
  },
  'settings.resume': {
    en: 'Resume',
    pt: 'Retomar',
    es: 'Reanudar'
  },

  // Play Menu
  'play.title': {
    en: 'HaxLab',
    pt: 'HaxLab',
    es: 'HaxLab'
  },
  'play.username': {
    en: 'Your Username',
    pt: 'Seu Nome de Usuário',
    es: 'Tu Nombre de Usuario'
  },
  'play.randomName': {
    en: 'Generate random name',
    pt: 'Gerar nome aleatório',
    es: 'Generar nombre aleatorio'
  },
  'play.back': {
    en: 'Back',
    pt: 'Voltar',
    es: 'Volver'
  },

  // Game
  'game.red': {
    en: 'Red',
    pt: 'Vermelho',
    es: 'Rojo'
  },
  'game.blue': {
    en: 'Blue',
    pt: 'Azul',
    es: 'Azul'
  },
  'game.time': {
    en: 'Time',
    pt: 'Tempo',
    es: 'Tiempo'
  },
  'game.backToMenu': {
    en: 'Back to Menu',
    pt: 'Voltar ao Menu',
    es: 'Volver al Menú'
  }
};

class I18n {
  private currentLang: Language = 'en';
  private listeners: Array<() => void> = [];

  constructor() {
    // Carregar idioma salvo ou detectar idioma do navegador
    const savedLang = localStorage.getItem('language') as Language | null;
    if (savedLang && (savedLang === 'en' || savedLang === 'pt' || savedLang === 'es')) {
      this.currentLang = savedLang;
    } else {
      // Detectar idioma do navegador
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('pt')) {
        this.currentLang = 'pt';
      } else if (browserLang.startsWith('es')) {
        this.currentLang = 'es';
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
