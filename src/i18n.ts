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
  'menu.ranking': {
    en: 'Ranking',
    pt: 'Ranking',
    es: 'Clasificación'
  },
  'menu.settings': {
    en: 'Settings',
    pt: 'Configurações',
    es: 'Configuración'
  },
  'menu.credits': {
    en: 'Credits',
    pt: 'Créditos',
    es: 'Créditos'
  },
  'menu.changelogs': {
    en: 'Changelogs',
    pt: 'Changelogs',
    es: 'Cambios'
  },

  // App Settings
  'appSettings.title': {
    en: 'Settings',
    pt: 'Configurações',
    es: 'Configuración'
  },
  'appSettings.language': {
    en: 'Language',
    pt: 'Idioma',
    es: 'Idioma'
  },
  'appSettings.soundVolume': {
    en: 'Sound Effects Volume',
    pt: 'Volume dos Efeitos Sonoros',
    es: 'Volumen de Efectos de Sonido'
  },
  'appSettings.extrapolation': {
    en: 'Extrapolation',
    pt: 'Extrapolação',
    es: 'Extrapolación'
  },
  'appSettings.extrapolationHint': {
    en: 'Predicts future positions to reduce perceived input lag. 0 = off, 20-60ms = recommended.',
    pt: 'Prevê posições futuras para reduzir input lag percebido. 0 = desligado, 20-60ms = recomendado.',
    es: 'Predice posiciones futuras para reducir el lag de entrada percibido. 0 = apagado, 20-60ms = recomendado.'
  },
  'appSettings.interpolation': {
    en: 'Interpolation',
    pt: 'Interpolação',
    es: 'Interpolación'
  },
  'appSettings.interpolationHint': {
    en: 'Smooths movement between frames. Enabled by default.',
    pt: 'Suaviza movimento entre frames. Ativado por padrão.',
    es: 'Suaviza el movimiento entre fotogramas. Activado por defecto.'
  },
  'appSettings.controlIndicatorOpacity': {
    en: 'Control Indicator Opacity',
    pt: 'Opacidade do Círculo de Controle',
    es: 'Opacidad del Círculo de Control'
  },
  'appSettings.controlIndicatorOpacityHint': {
    en: 'Adjusts the transparency of the dotted circle around your player.',
    pt: 'Ajusta a transparência do círculo pontilhado ao redor do seu jogador.',
    es: 'Ajusta la transparencia del círculo punteado alrededor de tu jugador.'
  },
  'appSettings.enabled': {
    en: 'Enabled',
    pt: 'Ativado',
    es: 'Activado'
  },
  'appSettings.disabled': {
    en: 'Disabled',
    pt: 'Desativado',
    es: 'Desactivado'
  },
  'appSettings.back': {
    en: 'Back',
    pt: 'Voltar',
    es: 'Volver'
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
  'playlists.previous': {
    en: 'previous',
    pt: 'anterior',
    es: 'anterior'
  },
  'playlists.next': {
    en: 'next',
    pt: 'próxima',
    es: 'siguiente'
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
  
  // Auth & Community Playlists
  'auth.guest': {
    en: 'Guest',
    pt: 'Convidado',
    es: 'Invitado'
  },
  'auth.clickToManage': {
    en: 'Click to manage account',
    pt: 'Clique para gerenciar conta',
    es: 'Clic para gestionar cuenta'
  },
  'auth.login': {
    en: 'Login',
    pt: 'Login',
    es: 'Iniciar Sesión'
  },
  'auth.logout': {
    en: 'Logout',
    pt: 'Sair',
    es: 'Cerrar Sesión'
  },
  'auth.register': {
    en: 'Register',
    pt: 'Cadastrar',
    es: 'Registrarse'
  },
  'auth.profile': {
    en: 'Profile',
    pt: 'Perfil',
    es: 'Perfil'
  },
  'playlists.official': {
    en: 'Official',
    pt: 'Oficiais',
    es: 'Oficiales'
  },
  'playlists.community': {
    en: 'Community',
    pt: 'Comunidade',
    es: 'Comunidad'
  },
  'playlists.publish': {
    en: 'Publish',
    pt: 'Publicar',
    es: 'Publicar'
  },
  'playlists.published': {
    en: 'Published',
    pt: 'Publicado',
    es: 'Publicado'
  },
  'playlists.publishSuccess': {
    en: 'Playlist published successfully!',
    pt: 'Playlist publicada com sucesso!',
    es: '¡Lista publicada exitosamente!'
  },
  'playlists.publishError': {
    en: 'Error publishing playlist',
    pt: 'Erro ao publicar playlist',
    es: 'Error al publicar la lista'
  },
  'playlists.loginRequired': {
    en: 'You need to login to publish playlists',
    pt: 'Você precisa fazer login para publicar playlists',
    es: 'Necesitas iniciar sesión para publicar listas'
  },
  'playlists.sortBy': {
    en: 'Sort by:',
    pt: 'Ordenar por:',
    es: 'Ordenar por:'
  },
  'playlists.sortTrending': {
    en: 'Trending',
    pt: 'Destaques',
    es: 'Destacados'
  },
  'playlists.sortLikes': {
    en: 'Likes',
    pt: 'Likes',
    es: 'Me gusta'
  },
  'playlists.sortRecent': {
    en: 'Recent',
    pt: 'Recentes',
    es: 'Recientes'
  },
  'playlists.sortPlays': {
    en: 'Most Played',
    pt: 'Mais Jogadas',
    es: 'Más Jugadas'
  },
  'playlists.sortName': {
    en: 'Name',
    pt: 'Nome',
    es: 'Nombre'
  },
  'playlists.author': {
    en: 'By',
    pt: 'Por',
    es: 'Por'
  },
  'playlists.likes': {
    en: 'likes',
    pt: 'likes',
    es: 'me gusta'
  },
  'playlists.plays': {
    en: 'plays',
    pt: 'jogadas',
    es: 'jugadas'
  },
  'playlists.noCommunityPlaylists': {
    en: 'No community playlists yet',
    pt: 'Ainda não há playlists da comunidade',
    es: 'Aún no hay listas de la comunidad'
  },
  'playlists.deletePlaylist': {
    en: 'Delete playlist',
    pt: 'Excluir playlist',
    es: 'Eliminar lista'
  },
  'playlists.confirmDelete': {
    en: 'Are you sure you want to delete this playlist? This action cannot be undone.',
    pt: 'Tem certeza que deseja excluir esta playlist? Esta ação não pode ser desfeita.',
    es: '¿Estás seguro de que quieres eliminar esta lista? Esta acción no se puede deshacer.'
  },
  'playlists.deleteError': {
    en: 'Error deleting playlist',
    pt: 'Erro ao excluir playlist',
    es: 'Error al eliminar la lista'
  },
  'playlists.guestCantLike': {
    en: 'You need to create an account to like playlists. Click on your profile to sign up.',
    pt: 'Você precisa criar uma conta para curtir playlists. Clique no seu perfil para se cadastrar.',
    es: 'Necesitas crear una cuenta para dar me gusta a las listas. Haz clic en tu perfil para registrarte.'
  },
  'playlists.likeError': {
    en: 'Error liking playlist',
    pt: 'Erro ao curtir playlist',
    es: 'Error al dar me gusta a la lista'
  },
  'playlists.dislikeError': {
    en: 'Error disliking playlist',
    pt: 'Erro ao descurtir playlist',
    es: 'Error al dar no me gusta a la lista'
  },
  'playlists.randomizeOrder': {
    en: 'Random scenario order',
    pt: 'Ordem aleatória dos cenários',
    es: 'Orden aleatorio de escenarios'
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
  'result.ratePlaylist': {
    en: 'Rate this Playlist',
    pt: 'Avaliar esta Playlist',
    es: 'Calificar esta Lista'
  },
  'result.like': {
    en: 'Like',
    pt: 'Curtir',
    es: 'Me Gusta'
  },
  'result.dislike': {
    en: 'Dislike',
    pt: 'Descurtir',
    es: 'No Me Gusta'
  },
  'result.officialPlaylist': {
    en: 'Official Playlist',
    pt: 'Playlist Oficial',
    es: 'Lista Oficial'
  },
  'result.communityPlaylist': {
    en: 'Community Playlist',
    pt: 'Playlist da Comunidade',
    es: 'Lista de la Comunidad'
  },
  'result.by': {
    en: 'by',
    pt: 'por',
    es: 'por'
  },
  'result.official': {
    en: 'Official',
    pt: 'Oficial',
    es: 'Oficial'
  },
  'result.community': {
    en: 'Community',
    pt: 'Comunidade',
    es: 'Comunidad'
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
  'ranking.search': {
    en: 'Search Player:',
    pt: 'Buscar Jogador:',
    es: 'Buscar Jugador:'
  },
  'ranking.searchPlaceholder': {
    en: 'Type a nickname...',
    pt: 'Digite um nickname...',
    es: 'Escribe un apodo...'
  },
  'ranking.topPlayers': {
    en: 'Top Players',
    pt: 'Melhores Jogadores',
    es: 'Mejores Jugadores'
  },
  'ranking.resultsFound': {
    en: 'results found',
    pt: 'resultados encontrados',
    es: 'resultados encontrados'
  },
  'ranking.noResults': {
    en: 'No players found with that name',
    pt: 'Nenhum jogador encontrado com esse nome',
    es: 'No se encontraron jugadores con ese nombre'
  },
  'ranking.playlists': {
    en: 'Playlists',
    pt: 'Playlists',
    es: 'Listas'
  },
  'ranking.loadingMore': {
    en: 'Loading more...',
    pt: 'Carregando mais...',
    es: 'Cargando más...'
  },
  'ranking.endOfList': {
    en: '— End of ranking —',
    pt: '— Fim do ranking —',
    es: '— Fin de la clasificación —'
  },
  'ranking.replay': {
    en: 'Replay',
    pt: 'Replay',
    es: 'Repetición'
  },
  'ranking.watchReplay': {
    en: 'Watch Replay',
    pt: 'Assistir Replay',
    es: 'Ver Repetición'
  },

  // Replay Viewer
  'replay.title': {
    en: 'Watch Replay',
    pt: 'Assistir Replay',
    es: 'Ver Repetición'
  },
  'replay.close': {
    en: 'Close',
    pt: 'Fechar',
    es: 'Cerrar'
  },
  'replay.loading': {
    en: 'Loading replay...',
    pt: 'Carregando replay...',
    es: 'Cargando repetición...'
  },
  'replay.notFound': {
    en: 'Replay not found',
    pt: 'Replay não encontrado',
    es: 'Repetición no encontrada'
  },
  'replay.loadError': {
    en: 'Error loading replay',
    pt: 'Erro ao carregar replay',
    es: 'Error al cargar repetición'
  },
  'replay.playlistNotFound': {
    en: 'Playlist not found',
    pt: 'Playlist não encontrada',
    es: 'Lista de reproducción no encontrada'
  },
  'replay.startError': {
    en: 'Error starting replay',
    pt: 'Erro ao iniciar replay',
    es: 'Error al iniciar repetición'
  },
  'replay.time': {
    en: 'Time',
    pt: 'Tempo',
    es: 'Tiempo'
  },
  'replay.scenarios': {
    en: 'Scenarios',
    pt: 'Cenários',
    es: 'Escenarios'
  },
  'replay.inputs': {
    en: 'Inputs',
    pt: 'Comandos',
    es: 'Entradas'
  },
  'replay.recordedAt': {
    en: 'Recorded',
    pt: 'Gravado em',
    es: 'Grabado el'
  },
  'replay.watch': {
    en: 'Watch Replay',
    pt: 'Assistir',
    es: 'Ver'
  },
  'replay.stop': {
    en: 'Stop',
    pt: 'Parar',
    es: 'Detener'
  },
  'replay.noData': {
    en: 'No replay data available',
    pt: 'Sem dados de replay',
    es: 'Sin datos de repetición'
  },
  'replay.retry': {
    en: 'Retry',
    pt: 'Tentar Novamente',
    es: 'Reintentar'
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
  'settings.ballBounce': {
    en: 'Ball Bounce (wall)',
    pt: 'Quique da Bola (parede)',
    es: 'Rebote del Balón (pared)'
  },
  'settings.ballPlayerRestitution': {
    en: 'Ball Restitution (player)',
    pt: 'Restituição da Bola (jogador)',
    es: 'Restitución del Balón (jugador)'
  },
  'settings.playerDamping': {
    en: 'Player Damping (friction)',
    pt: 'Amortecimento do Jogador (fricção)',
    es: 'Amortiguación del Jugador (fricción)'
  },
  'settings.playerMass': {
    en: 'Player Mass',
    pt: 'Massa do Jogador',
    es: 'Masa del Jugador'
  },
  'settings.playerBounce': {
    en: 'Player Bounce (wall)',
    pt: 'Quique do Jogador (parede)',
    es: 'Rebote del Jugador (pared)'
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
  },
  'game.settings': {
    en: 'Settings',
    pt: 'Configurações',
    es: 'Configuración'
  },
  'game.toExit': {
    en: 'to exit',
    pt: 'para sair',
    es: 'para salir'
  },
  'game.exitConfirmTitle': {
    en: 'Exit Training?',
    pt: 'Sair do Treino?',
    es: '¿Salir del Entrenamiento?'
  },
  'game.exitConfirmMessage': {
    en: 'Do you want to leave free training and go back to the menu?',
    pt: 'Deseja sair do treino livre e voltar ao menu?',
    es: '¿Desea salir del entrenamiento libre y volver al menú?'
  },
  'game.exitPlaylistTitle': {
    en: 'Exit Playlist?',
    pt: 'Sair da Playlist?',
    es: '¿Salir de la Playlist?'
  },
  'game.exitPlaylistMessage': {
    en: 'Do you want to leave the playlist? Your progress will be lost.',
    pt: 'Deseja sair da playlist? O progresso será perdido.',
    es: '¿Desea salir de la playlist? El progreso se perderá.'
  },
  'game.exitYes': {
    en: 'Yes, exit',
    pt: 'Sim, sair',
    es: 'Sí, salir'
  },
  'game.exitNo': {
    en: 'Cancel',
    pt: 'Cancelar',
    es: 'Cancelar'
  },

  // Credits Page
  'credits.title': {
    en: 'Credits',
    pt: 'Créditos',
    es: 'Créditos'
  },
  'credits.back': {
    en: 'Back',
    pt: 'Voltar',
    es: 'Volver'
  },
  'credits.team': {
    en: 'Team',
    pt: 'Equipe',
    es: 'Equipo'
  },
  'credits.mainDeveloper': {
    en: 'Creator and Main Developer',
    pt: 'Criador e Desenvolvedor Principal',
    es: 'Creador y Desarrollador Principal'
  },
  'credits.developerAndPlaylists': {
    en: 'Developer and Playlist Creator',
    pt: 'Desenvolvedor e Criador de Playlists',
    es: 'Desarrollador y Creador de Listas'
  },
  'credits.acknowledgments': {
    en: 'Acknowledgments',
    pt: 'Agradecimentos',
    es: 'Agradecimientos'
  },
  'credits.acknowledgmentsText': {
    en: 'Special thanks to the community for the continuous support and feedback that makes HaxLab better every day!',
    pt: 'Agradecimentos especiais à comunidade pelo apoio contínuo e feedback que torna o HaxLab melhor a cada dia!',
    es: '¡Agradecimientos especiales a la comunidad por el apoyo continuo y la retroalimentación que hace que HaxLab mejore cada día!'
  },
  'credits.basroThankYou': {
    en: 'Creator of Haxball, the main inspiration for this game',
    pt: 'Criador do Haxball, a principal inspiração deste jogo',
    es: 'Creador de Haxball, la principal inspiración de este juego'
  },
  'credits.testerThankYou': {
    en: 'For helping test and improve the game',
    pt: 'Por ajudar a testar e melhorar o jogo',
    es: 'Por ayudar a probar y mejorar el juego'
  },
  'credits.communityTestersThankYou': {
    en: 'And many other members of the Haxball community who played the early versions, helping to test and validate the game.',
    pt: 'E vários outros membros da comunidade Haxball que jogaram nas primeiras versões, ajudando a testar e validar o jogo.',
    es: 'Y muchos otros miembros de la comunidad Haxball que jugaron las primeras versiones, ayudando a probar y validar el juego.'
  },
  'credits.technologies': {
    en: 'Technologies Used',
    pt: 'Tecnologias Utilizadas',
    es: 'Tecnologías Utilizadas'
  },
  'credits.supportTitle': {
    en: 'Support the Project',
    pt: 'Apoie o Projeto',
    es: 'Apoya el Proyecto'
  },
  'credits.supportDescription': {
    en: 'If you enjoy HaxLab and want to support its development, consider sending a Pix!',
    pt: 'Se você gosta do HaxLab e quer apoiar seu desenvolvimento, considere enviar um Pix!',
    es: 'Si disfrutas de HaxLab y quieres apoyar su desarrollo, ¡considera enviar un Pix!'
  },
  'credits.pixKey': {
    en: 'Pix Key',
    pt: 'Chave Pix',
    es: 'Clave Pix'
  },
  'credits.copyPixKey': {
    en: 'Copy Pix key',
    pt: 'Copiar chave Pix',
    es: 'Copiar clave Pix'
  },
  'credits.buyCoffee': {
    en: 'Buy Me a Coffee',
    pt: 'Me Pague um Café',
    es: 'Cómprame un Café'
  },
  'credits.madeWith': {
    en: 'Made with',
    pt: 'Feito com',
    es: 'Hecho con'
  },
  'credits.forCommunity': {
    en: 'for the community',
    pt: 'para a comunidade',
    es: 'para la comunidad'
  },
  'credits.allRightsReserved': {
    en: 'All Rights Reserved',
    pt: 'Todos os Direitos Reservados',
    es: 'Todos los Derechos Reservados'
  },

  // Changelogs Page
  'changelogs.title': {
    en: 'Changelogs',
    pt: 'Changelogs',
    es: 'Registro de Cambios'
  },
  'changelogs.back': {
    en: 'Back',
    pt: 'Voltar',
    es: 'Volver'
  },
  'changelogs.currentVersion': {
    en: 'Current Version',
    pt: 'Versão Atual',
    es: 'Versión Actual'
  },
  'changelogs.latest': {
    en: 'Latest',
    pt: 'Mais Recente',
    es: 'Más Reciente'
  },
  'changelogs.types.feature': {
    en: 'New Feature',
    pt: 'Nova Funcionalidade',
    es: 'Nueva Función'
  },
  'changelogs.types.improvement': {
    en: 'Improvement',
    pt: 'Melhoria',
    es: 'Mejora'
  },
  'changelogs.types.bugfix': {
    en: 'Bug Fix',
    pt: 'Correção de Bug',
    es: 'Corrección de Error'
  },
  'changelogs.types.breaking': {
    en: 'Breaking Change',
    pt: 'Mudança Importante',
    es: 'Cambio Importante'
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
