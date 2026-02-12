import { Game } from './game.js';
import { DEFAULT_MAP, CLASSIC_MAP } from './maps.js';
import { GameConfig, Playlist } from './types.js';
import { i18n } from './i18n.js';
import { PlaylistMode } from './playlist.js';
import { keyBindings, KeyBindings } from './keybindings.js';
import { PlaylistEditor } from './editor.js';
import { getNickname, saveNickname, generateRandomNickname, isValidNickname } from './player.js';
import { submitScore, getTopScores, getPlayerHighscore, calculateScore, isOfficialPlaylist, RankingEntry } from './firebase.js';

function formatTime(time: number): string {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const cs = Math.floor((time % 1) * 100);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

let currentGame: Game | null = null;
let currentPlaylist: PlaylistMode | null = null;
let currentEditor: PlaylistEditor | null = null;
let currentConfig: GameConfig = getDefaultConfig();
let currentMapType: string = 'default';
let isPlaylistMode: boolean = false;
let currentlyConfiguringAction: keyof KeyBindings | null = null;

function getDefaultConfig(): GameConfig {
  return {
    timeLimit: 300,
    scoreLimit: 3,
    playersPerTeam: 2,
    kickMode: 'classic',
    kickStrength: 500,
    playerRadius: 15,
    playerSpeed: 260,
    playerAcceleration: 6.5,
    kickSpeedMultiplier: 0.5,
    ballConfig: {
      radius: 8,
      mass: 3,
      damping: 0.99,
      color: '#ffff00',
      borderColor: '#000000',
      borderWidth: 2
    }
  };
}

function hideAllScreens(): void {
  document.getElementById('menu')?.classList.add('hidden');
  document.getElementById('game-modes-menu')?.classList.add('hidden');
  document.getElementById('playlists-menu')?.classList.add('hidden');
  document.getElementById('settings-menu')?.classList.add('hidden');
  document.getElementById('game-container')?.classList.add('hidden');
  document.getElementById('playlist-hud')?.classList.add('hidden');
  document.getElementById('playlist-feedback')?.classList.add('hidden');
}

function updateTranslations(): void {
  // Atualizar todos os elementos com data-i18n
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (key) {
      // Preservar ícones Font Awesome ao traduzir
      const icon = element.querySelector('i.fas, i.fab, i.far');
      if (icon) {
        const iconHTML = icon.outerHTML;
        element.innerHTML = `${iconHTML} ${i18n.t(key)}`;
      } else {
        element.textContent = i18n.t(key);
      }
    }
  });

  // Atualizar placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (key && element instanceof HTMLInputElement) {
      element.placeholder = i18n.t(key);
    }
  });
}

function showLanguageMenu(): void {
  hideAllScreens();
  document.getElementById('menu')?.classList.remove('hidden');
  
  // Remover classe que previne scroll
  document.body.classList.remove('game-active');
  
  isPlaylistMode = false;
  
  if (currentGame) {
    currentGame.stop();
    currentGame = null;
  }
  
  // Parar playlist e HUD interval
  stopCurrentPlaylist();
  
  if (currentEditor) {
    currentEditor = null;
  }
}

function showGameModesMenu(): void {
  hideAllScreens();
  document.body.classList.remove('game-active');
  const menu = document.getElementById('game-modes-menu');
  menu?.classList.remove('hidden');
  menu?.style.removeProperty('display');
  
  // Resetar configurações para valores padrão ao sair do treino livre
  currentConfig = getDefaultConfig();
  currentMapType = 'default';
}

function showPlaylistsMenu(): void {
  hideAllScreens();
  document.body.classList.remove('game-active');
  const menu = document.getElementById('playlists-menu');
  menu?.classList.remove('hidden');
  menu?.style.removeProperty('display');
  
  // Parar playlist atual se existir (limpa timeouts e intervals)
  stopCurrentPlaylist();
  
  // Resetar configurações para valores padrão ao sair do treino livre
  currentConfig = getDefaultConfig();
  currentMapType = 'default';
  
  loadAvailablePlaylists();
}

function showSettingsMenu(): void {
  hideAllScreens();
  const menu = document.getElementById('settings-menu');
  menu?.classList.remove('hidden');
  menu?.style.removeProperty('display');
  
  // Pausar o jogo se estiver rodando
  if (currentGame) {
    currentGame.pause();
  }
  
  // Preencher campos com configurações atuais
  populateSettingsForm(currentConfig, currentMapType);
}

function populateSettingsForm(config: GameConfig, mapType: string): void {
  (document.getElementById('settings-map-select') as HTMLSelectElement).value = mapType;
  (document.getElementById('settings-score-limit') as HTMLInputElement).value = config.scoreLimit.toString();
  (document.getElementById('settings-time-limit') as HTMLInputElement).value = (config.timeLimit / 60).toString();
  (document.getElementById('settings-kick-mode') as HTMLSelectElement).value = config.kickMode;
  (document.getElementById('settings-kick-strength') as HTMLInputElement).value = config.kickStrength.toString();
  (document.getElementById('settings-kick-strength-value') as HTMLSpanElement).textContent = config.kickStrength.toString();
  (document.getElementById('settings-player-radius') as HTMLInputElement).value = config.playerRadius.toString();
  (document.getElementById('settings-player-radius-value') as HTMLSpanElement).textContent = config.playerRadius.toString();
  (document.getElementById('settings-player-speed') as HTMLInputElement).value = (config.playerSpeed ?? 260).toString();
  (document.getElementById('settings-player-speed-value') as HTMLSpanElement).textContent = (config.playerSpeed ?? 260).toString();
  (document.getElementById('settings-player-acceleration') as HTMLInputElement).value = (config.playerAcceleration ?? 6.5).toString();
  (document.getElementById('settings-player-acceleration-value') as HTMLSpanElement).textContent = (config.playerAcceleration ?? 6.5).toString();
  (document.getElementById('settings-ball-color') as HTMLInputElement).value = config.ballConfig.color;
  (document.getElementById('settings-ball-border-color') as HTMLInputElement).value = config.ballConfig.borderColor;
  (document.getElementById('settings-ball-radius') as HTMLInputElement).value = config.ballConfig.radius.toString();
  (document.getElementById('settings-ball-radius-value') as HTMLSpanElement).textContent = config.ballConfig.radius.toString();
  (document.getElementById('settings-ball-mass') as HTMLInputElement).value = config.ballConfig.mass.toString();
  (document.getElementById('settings-ball-mass-value') as HTMLSpanElement).textContent = config.ballConfig.mass.toString();
  (document.getElementById('settings-ball-damping') as HTMLInputElement).value = config.ballConfig.damping.toString();
  (document.getElementById('settings-ball-damping-value') as HTMLSpanElement).textContent = config.ballConfig.damping.toString();
  (document.getElementById('settings-kick-speed-multiplier') as HTMLInputElement).value = (config.kickSpeedMultiplier ?? 0.5).toString();
  (document.getElementById('settings-kick-speed-multiplier-value') as HTMLSpanElement).textContent = (config.kickSpeedMultiplier ?? 0.5).toString();
  
  // Preencher keybindings
  updateKeybindingsDisplay();
}

function getConfigFromSettingsForm(): GameConfig {
  return {
    timeLimit: parseInt((document.getElementById('settings-time-limit') as HTMLInputElement).value) * 60,
    scoreLimit: parseInt((document.getElementById('settings-score-limit') as HTMLInputElement).value),
    playersPerTeam: 2, // Mantém fixo por enquanto
    kickMode: (document.getElementById('settings-kick-mode') as HTMLSelectElement).value as 'classic' | 'chargeable',
    kickStrength: parseFloat((document.getElementById('settings-kick-strength') as HTMLInputElement).value),
    playerRadius: parseFloat((document.getElementById('settings-player-radius') as HTMLInputElement).value),
    playerSpeed: parseFloat((document.getElementById('settings-player-speed') as HTMLInputElement).value),
    playerAcceleration: parseFloat((document.getElementById('settings-player-acceleration') as HTMLInputElement).value),
    kickSpeedMultiplier: parseFloat((document.getElementById('settings-kick-speed-multiplier') as HTMLInputElement).value),
    ballConfig: {
      radius: parseFloat((document.getElementById('settings-ball-radius') as HTMLInputElement).value),
      mass: parseFloat((document.getElementById('settings-ball-mass') as HTMLInputElement).value),
      damping: parseFloat((document.getElementById('settings-ball-damping') as HTMLInputElement).value),
      color: (document.getElementById('settings-ball-color') as HTMLInputElement).value,
      borderColor: (document.getElementById('settings-ball-border-color') as HTMLInputElement).value,
      borderWidth: 2
    }
  };
}

function startGame(config: GameConfig, mapType: string): void {
  hideAllScreens();
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) gameContainer.classList.remove('hidden');
  
  // Parar playlist atual se existir (limpa timeouts e intervals)
  stopCurrentPlaylist();
  
  // Prevenir scroll durante o jogo
  document.body.classList.add('game-active');
  
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }
  
  const map = mapType === 'classic' ? CLASSIC_MAP : DEFAULT_MAP;
  
  isPlaylistMode = false;
  
  // Mostrar UI normal de jogo
  document.getElementById('game-info')?.classList.remove('hidden');
  document.getElementById('playlist-hud')?.classList.add('hidden');
  
  // Cria novo jogo single player
  currentGame = new Game(canvas, map, config);
  currentGame.initPlayers();
  currentGame.reset();
  currentGame.start();
  
  // Armazena configuração atual
  currentConfig = config;
  currentMapType = mapType;
}

function startEditor(): void {
  hideAllScreens();
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) gameContainer.classList.remove('hidden');
  
  // Parar playlist atual se existir (limpa timeouts e intervals)
  stopCurrentPlaylist();
  
  // Prevenir scroll durante o editor
  document.body.classList.add('game-active');
  
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }
  
  // Ocultar UI de jogo normal
  document.getElementById('game-info')?.classList.add('hidden');
  document.getElementById('playlist-hud')?.classList.add('hidden');
  document.getElementById('btn-menu')?.classList.add('hidden');
  
  // Criar editor
  currentEditor = new PlaylistEditor(canvas, currentMapType);
  currentEditor.start();
}

async function loadAvailablePlaylists(): Promise<void> {
  const listContainer = document.getElementById('playlists-list');
  if (!listContainer) return;
  
  // Lista hardcoded de playlists disponíveis
  const playlists = [
    { file: 'torneio-1.json', name: 'TORNEIO A.D. BRK - Edição 1', description: 'Playlist oficial do 1º Torneio A.D. BRK', icon: 'fa-trophy' },
    { file: 'cruzamento-facil.json', name: 'Cruzamento - Fácil', description: 'Pratique cruzamentos e finalizações', icon: 'fa-futbol' },
    { file: 'drible-e-gol.json', name: 'Drible e Gol', description: 'Melhore suas habilidades de drible', icon: 'fa-bullseye' },
    { file: 'conducao-facil.json', name: 'Condução - Fácil', description: 'Exercícios focados em condução de bola', icon: 'fa-person-running' }
  ];
  
  listContainer.innerHTML = '';
  
  for (const playlistInfo of playlists) {
    const btn = document.createElement('button');
    btn.className = 'playlist-item';
    btn.dataset.file = playlistInfo.file;
    btn.innerHTML = `
      <div class="playlist-item-content">
        <div class="playlist-emoji"><i class="fas ${playlistInfo.icon}"></i></div>
        <div class="playlist-info">
          <div class="playlist-item-name">${playlistInfo.name}</div>
          <div class="playlist-item-desc">${playlistInfo.description}</div>
        </div>
      </div>
    `;
    
    btn.onclick = () => selectPlaylist(playlistInfo.file, playlistInfo.name, playlistInfo.icon);
    
    listContainer.appendChild(btn);
  }
}

let selectedPlaylistData: { file: string; data: Playlist; name: string } | null = null;
let currentRankingPage = 0;
const RANKING_PAGE_SIZE = 20;
let isLoadingRanking = false;
let hasMoreRankings = true;

async function selectPlaylist(file: string, name: string, icon: string): Promise<void> {
  try {
    // Marcar item como selecionado visualmente
    document.querySelectorAll('.playlist-item').forEach(item => item.classList.remove('selected'));
    const selectedBtn = document.querySelector(`[data-file="${file}"]`);
    if (selectedBtn) selectedBtn.classList.add('selected');
    
    // Carregar dados da playlist
    const response = await fetch(`/playlists/${file}`);
    if (!response.ok) throw new Error('Failed to load playlist');
    
    const playlistData: Playlist = await response.json();
    selectedPlaylistData = { file, data: playlistData, name };
    
    
    // Mostrar painel de detalhes
    document.getElementById('playlist-details-empty')?.classList.add('hidden');
    document.getElementById('playlist-details-content')?.classList.remove('hidden');
    
    // Preencher informações
    const nameEl = document.getElementById('playlist-name');
    if (nameEl) nameEl.innerHTML = `<i class="fas ${icon}"></i> ${name}`;
    
    const descEl = document.getElementById('playlist-description');
    if (descEl) descEl.textContent = playlistData.description || 'Sem descrição disponível';
    
    const scenariosCountEl = document.getElementById('playlist-scenarios-count');
    if (scenariosCountEl) scenariosCountEl.textContent = `${playlistData.scenarios.length} cenários`;
    
    // Buscar estatísticas reais do Firebase
    try {
      const scores = await getTopScores(name, 100); // Buscar top 100 para estatísticas
      
      const avgTimeEl = document.getElementById('playlist-avg-time');
      const avgKicksEl = document.getElementById('playlist-avg-kicks');
      
      if (scores.length > 0) {
        // Calcular médias baseadas nos dados reais
        const avgTime = scores.reduce((sum, s) => sum + s.time, 0) / scores.length;
        const avgKicks = scores.reduce((sum, s) => sum + s.kicks, 0) / scores.length;
        
        if (avgTimeEl) {
          avgTimeEl.textContent = `${avgTime.toFixed(1)}s`;
        }
        if (avgKicksEl) {
          avgKicksEl.textContent = `${avgKicks.toFixed(1)} chutes`;
        }
      } else {
        // Se não houver dados, usar estimativa baseada nos cenários
        const totalTime = playlistData.scenarios.reduce((sum, s) => sum + (s.timeLimit || 0), 0);
        if (avgTimeEl) {
          avgTimeEl.textContent = `~${Math.ceil(totalTime)}s (estimado)`;
        }
        if (avgKicksEl) {
          avgKicksEl.textContent = 'N/A';
        }
      }
    } catch (error) {
      console.error('Error loading playlist stats:', error);
      // Fallback para estimativa
      const avgTimeEl = document.getElementById('playlist-avg-time');
      if (avgTimeEl) {
        const totalTime = playlistData.scenarios.reduce((sum, s) => sum + (s.timeLimit || 0), 0);
        avgTimeEl.textContent = `~${Math.ceil(totalTime)}s (estimado)`;
      }
      const avgKicksEl = document.getElementById('playlist-avg-kicks');
      if (avgKicksEl) {
        avgKicksEl.textContent = 'N/A';
      }
    }
    
    // Resetar e carregar ranking
    currentRankingPage = 0;
    hasMoreRankings = true;
    await loadPlaylistRanking(name, true);
    
    // Carregar highscore do jogador
    await loadPlayerHighscore(name);
    
  } catch (error) {
    console.error('Error selecting playlist:', error);
    alert('Erro ao carregar detalhes da playlist!');
  }
}

async function loadPlayerHighscore(playlistName: string): Promise<void> {
  const nickname = getNickname();
  const highscoreContainer = document.getElementById('player-highscore');
  
  if (!highscoreContainer) return;
  
  try {
    const highscore = await getPlayerHighscore(nickname, playlistName);
    
    if (highscore) {
      // Buscar posição do jogador
      const allScores = await getTopScores(playlistName, 1000); // Buscar muitos para encontrar a posição
      const playerRank = allScores.findIndex(s => s.nickname === nickname) + 1;
      
      document.getElementById('player-score')!.textContent = highscore.score.toLocaleString();
      document.getElementById('player-rank')!.textContent = playerRank > 0 ? `#${playerRank}` : 'N/A';
      document.getElementById('player-kicks')!.textContent = highscore.kicks.toString();
      document.getElementById('player-time')!.textContent = formatTime(highscore.time);
      
      highscoreContainer.classList.remove('hidden');
    } else {
      highscoreContainer.classList.add('hidden');
    }
  } catch (error) {
    console.error('Error loading player highscore:', error);
    highscoreContainer.classList.add('hidden');
  }
}

async function loadPlaylistRanking(playlistName: string, reset: boolean = false): Promise<void> {
  if (isLoadingRanking || (!hasMoreRankings && !reset)) return;
  
  isLoadingRanking = true;
  const rankingList = document.getElementById('ranking-list');
  const loadingIndicator = document.getElementById('ranking-loading');
  
  if (!rankingList || !loadingIndicator) {
    isLoadingRanking = false;
    return;
  }
  
  if (reset) {
    currentRankingPage = 0;
    hasMoreRankings = true;
    rankingList.innerHTML = '';
  }
  
  loadingIndicator.classList.remove('hidden');
  
  try {
    const limit = RANKING_PAGE_SIZE;
    const offset = currentRankingPage * RANKING_PAGE_SIZE;
    
    // Buscar scores (Firebase não suporta offset direto, então buscamos mais e filtramos)
    const allScores = await getTopScores(playlistName, offset + limit);
    const scores = allScores.slice(offset, offset + limit);
    
    if (scores.length < limit) {
      hasMoreRankings = false;
    }
    
    const playerNickname = getNickname();
    
    scores.forEach((score, index) => {
      const globalRank = offset + index + 1;
      const entry = document.createElement('div');
      entry.className = 'ranking-entry';
      
      if (score.nickname === playerNickname) {
        entry.classList.add('player-entry');
      }
      
      let rankClass = 'ranking-rank';
      if (globalRank === 1) rankClass += ' top-1';
      else if (globalRank === 2) rankClass += ' top-2';
      else if (globalRank === 3) rankClass += ' top-3';
      
      const medal = globalRank === 1 ? '<i class="fas fa-medal" style="color: #ffd700;"></i>' : globalRank === 2 ? '<i class="fas fa-medal" style="color: #c0c0c0;"></i>' : globalRank === 3 ? '<i class="fas fa-medal" style="color: #cd7f32;"></i>' : '';
      
      entry.innerHTML = `
        <div class="${rankClass}">${medal} #${globalRank}</div>
        <div class="ranking-nickname">${score.nickname}</div>
        <div class="ranking-stat"><strong>${score.score.toLocaleString()}</strong> pts</div>
        <div class="ranking-stat">${score.kicks} chutes</div>
        <div class="ranking-stat">${formatTime(score.time)}</div>
      `;
      
      rankingList.appendChild(entry);
    });
    
    currentRankingPage++;
    
  } catch (error) {
    console.error('Error loading ranking:', error);
  } finally {
    loadingIndicator.classList.add('hidden');
    isLoadingRanking = false;
  }
}

async function loadAndStartPlaylist(file: string): Promise<void> {
  try {
    const response = await fetch(`/playlists/${file}`);
    if (!response.ok) throw new Error('Failed to load playlist');
    
    const playlist: Playlist = await response.json();
    startPlaylistMode(playlist);
  } catch (error) {
    console.error('Error loading playlist:', error);
    alert('Erro ao carregar playlist!');
  }
}

function importPlaylistFromFile(): void {
  const fileInput = document.getElementById('playlist-file-input') as HTMLInputElement;
  if (!fileInput) return;
  
  fileInput.onchange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt: ProgressEvent<FileReader>) => {
      try {
        const content = evt.target?.result as string;
        const data = JSON.parse(content);
        
        let playlist: Playlist;
        
        // Verifica se é uma playlist completa ou um cenário individual
        if (data.scenarios && Array.isArray(data.scenarios)) {
          // É uma playlist completa
          if (!data.name) {
            throw new Error('Playlist must have a name');
          }
          playlist = data;
        } else if (data.name && data.objectives) {
          // É um cenário individual - converter para playlist
          playlist = {
            name: data.name,
            description: data.description || `Playlist criada a partir do cenário: ${data.name}`,
            scenarios: [data]
          };
        } else {
          throw new Error('Invalid format: must be a playlist or scenario');
        }
        
        startPlaylistMode(playlist);
      } catch (error) {
        console.error('Error parsing playlist:', error);
        alert('Erro ao importar playlist! Verifique se o arquivo JSON está no formato correto.');
      }
      
      // Limpa o input para permitir importar o mesmo arquivo novamente
      target.value = '';
    };
    
    reader.readAsText(file);
  };
  
  fileInput.click();
}

function startPlaylistMode(playlist: Playlist): void {
  hideAllScreens();
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) gameContainer.classList.remove('hidden');
  
  // Parar jogo atual se existir (treino livre)
  if (currentGame) {
    currentGame.stop();
    currentGame = null;
  }
  
  // Prevenir scroll durante o jogo
  document.body.classList.add('game-active');
  
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }
  
  // Parar playlist atual se existir
  if (currentPlaylist) {
    currentPlaylist.stop();
    currentPlaylist = null;
  }
  
  isPlaylistMode = true;
  
  // Mostrar HUD de playlist
  document.getElementById('playlist-hud')?.classList.remove('hidden');
  document.getElementById('game-info')?.classList.add('hidden');
  
  // Criar PlaylistMode
  currentPlaylist = new PlaylistMode(canvas, playlist, currentConfig, {
    onScenarioComplete: (index) => {
      showFeedback('<i class="fas fa-check"></i> Cenário Completo!', '#00ff00');
    },
    onPlaylistComplete: async () => {
      showFeedback('<i class="fas fa-trophy"></i> Playlist Completa!', '#ffff00', true);
      
      // Obter dados do resultado
      const nickname = getNickname();
      const kicks = currentPlaylist!.getTotalKicks();
      const time = currentPlaylist!.getPlaylistTime();
      const score = calculateScore(kicks, time);
      
      // Buscar highscore anterior do jogador ANTES de submeter o novo score
      let previousHighscore: RankingEntry | null = null;
      try {
        previousHighscore = await getPlayerHighscore(nickname, playlist.name);
      } catch (error) {
        console.error('Failed to get previous highscore:', error);
      }
      
      // Submeter score ao Firebase
      try {
        await submitScore(nickname, playlist.name, kicks, time);
        console.log('Score submitted!');
      } catch (error) {
        console.error('Failed to submit score:', error);
      }
      
      // Mostrar modal de resultado após um pequeno delay
      setTimeout(async () => {
        hideFeedback();
        await showPlaylistResultModal(playlist.name, kicks, time, score, previousHighscore);
      }, 1500);
    },
    onScenarioFail: (reason) => {
      showFeedback(`<i class="fas fa-times"></i> ${reason}`, '#ff0000');
    },
    onScenarioStart: (index) => {
      updatePlaylistHUD();
    }
  });
  
  // Atualizar HUD
  updatePlaylistHUD();
  
  // Resetar estatísticas da playlist
  currentPlaylist.resetPlaylistStats();
  
  // Iniciar primeiro cenário
  currentPlaylist.startScenario(0);
  
  // Iniciar loop de atualização do HUD
  startPlaylistHUDLoop();
}

function updatePlaylistHUD(): void {
  if (!currentPlaylist) return;
  
  const playlist = currentPlaylist.getPlaylist();
  const progress = currentPlaylist.getProgress();
  const scenario = currentPlaylist.getCurrentScenario();
  
  const playlistName = document.getElementById('playlist-name');
  const scenarioName = document.getElementById('scenario-name');
  const scenarioProgress = document.getElementById('scenario-progress');
  
  if (playlistName) playlistName.textContent = playlist.name;
  if (scenarioName) scenarioName.textContent = scenario?.name || '';
  if (scenarioProgress) {
    scenarioProgress.textContent = `${progress.currentScenarioIndex + 1}/${playlist.scenarios.length}`;
  }
}

let hudUpdateInterval: number | null = null;

function stopPlaylistHUDLoop(): void {
  if (hudUpdateInterval) {
    clearInterval(hudUpdateInterval);
    hudUpdateInterval = null;
  }
}

function stopCurrentPlaylist(): void {
  // Parar loop de atualização do HUD
  stopPlaylistHUDLoop();
  
  // Parar e limpar playlist atual
  if (currentPlaylist) {
    currentPlaylist.stop();
    currentPlaylist = null;
  }
  
  // Esconder HUD de playlist
  document.getElementById('playlist-hud')?.classList.add('hidden');
}

function startPlaylistHUDLoop(): void {
  if (hudUpdateInterval) clearInterval(hudUpdateInterval);
  
  hudUpdateInterval = window.setInterval(() => {
    if (!currentPlaylist) {
      if (hudUpdateInterval) clearInterval(hudUpdateInterval);
      return;
    }
    
    const progress = currentPlaylist.getProgress();
    const scenario = currentPlaylist.getCurrentScenario();
    
    if (!scenario) return;
    
    const elapsed = (Date.now() - progress.scenarioStartTime) / 1000;
    const remaining = Math.max(0, scenario.timeLimit - elapsed);
    
    const timerEl = document.getElementById('scenario-timer');
    if (timerEl) {
      timerEl.textContent = remaining.toFixed(1) + 's';
      
      // Mudar cor quando tempo estiver acabando
      if (remaining < 5) {
        timerEl.style.color = '#ff0000';
      } else if (remaining < 10) {
        timerEl.style.color = '#ffaa00';
      } else {
        timerEl.style.color = '#ffff00';
      }
    }
  }, 100);
}

function showFeedback(text: string, color: string, persistent: boolean = false): void {
  const feedback = document.getElementById('playlist-feedback');
  const feedbackText = document.getElementById('feedback-text');
  
  if (!feedback || !feedbackText) return;
  
  feedbackText.textContent = text;
  feedbackText.style.color = color;
  feedback.classList.remove('hidden');
  
  if (!persistent) {
    setTimeout(() => {
      feedback.classList.add('hidden');
    }, 1500);
  }
}

function hideFeedback(): void {
  const feedback = document.getElementById('playlist-feedback');
  if (feedback) feedback.classList.add('hidden');
}

// Variável para guardar a playlist atual (para retry)
let lastPlaylistData: Playlist | null = null;

async function showPlaylistResultModal(
  playlistName: string, 
  kicks: number, 
  time: number, 
  score: number,
  previousHighscore: RankingEntry | null
): Promise<void> {
  const modal = document.getElementById('playlist-result-modal');
  if (!modal) return;
  
  // Parar o jogo/playlist
  if (currentPlaylist) {
    lastPlaylistData = currentPlaylist.getPlaylist();
    currentPlaylist.stop();
  }
  
  // Esconder game container
  document.getElementById('game-container')?.classList.add('hidden');
  document.getElementById('playlist-hud')?.classList.add('hidden');
  document.body.classList.remove('game-active');
  
  // Mostrar modal
  modal.classList.remove('hidden');
  
  // Verificar se é playlist oficial
  const isOfficial = isOfficialPlaylist(playlistName);
  
  // Preencher dados do resultado
  const resultKicks = document.getElementById('result-kicks');
  const resultTime = document.getElementById('result-time');
  const resultScore = document.getElementById('result-score');
  const resultHighscore = document.getElementById('result-highscore');
  const resultNewRecord = document.getElementById('result-new-record');
  const resultHighscoreSection = document.getElementById('result-highscore-section');
  
  if (resultKicks) resultKicks.textContent = kicks.toString();
  if (resultTime) {
    resultTime.textContent = formatTime(time);
  }
  if (resultScore) resultScore.textContent = score.toLocaleString();
  
  // Highscore e ranking só para playlists oficiais
  if (isOfficial) {
    // Mostrar seções de highscore e ranking
    if (resultHighscoreSection) resultHighscoreSection.style.display = 'block';
    
    // Restaurar tabela de ranking se foi substituída
    const rankingContainer = document.querySelector('#playlist-result-modal .ranking-container');
    if (rankingContainer) {
      rankingContainer.innerHTML = `
        <h3 style="color: #fff; margin-bottom: 15px; font-size: 16px;"><i class="fas fa-trophy"></i> Top 10 - <span id="result-playlist-name">${playlistName}</span></h3>
        <div id="result-loading" style="text-align: center; padding: 20px; display: none;">
          <div style="color: #667eea; font-size: 16px;">Carregando ranking...</div>
        </div>
        <table style="width: 100%; border-collapse: collapse;" id="result-ranking-table">
          <thead>
            <tr style="border-bottom: 2px solid rgba(102, 126, 234, 0.5);">
              <th style="padding: 10px; text-align: left; color: #667eea; font-size: 14px;">#</th>
              <th style="padding: 10px; text-align: left; color: #667eea; font-size: 14px;">Jogador</th>
              <th style="padding: 10px; text-align: center; color: #667eea; font-size: 14px;">Chutes</th>
              <th style="padding: 10px; text-align: center; color: #667eea; font-size: 14px;">Tempo</th>
              <th style="padding: 10px; text-align: right; color: #667eea; font-size: 14px;">Score</th>
            </tr>
          </thead>
          <tbody id="result-ranking-tbody">
          </tbody>
        </table>
      `;
    }
    
    // Highscore e novo recorde
    const highscoreValue = previousHighscore ? previousHighscore.score : 0;
    const isNewRecord = score > highscoreValue;
    
    if (resultHighscore) {
      resultHighscore.textContent = isNewRecord ? score.toLocaleString() : highscoreValue.toLocaleString();
    }
    if (resultNewRecord) {
      resultNewRecord.style.display = isNewRecord ? 'block' : 'none';
    }
    
    // Carregar top 10
    await loadPlaylistResultRanking(playlistName);
  } else {
    // Esconder seções de ranking para playlists não oficiais
    if (resultHighscoreSection) resultHighscoreSection.style.display = 'none';
    
    const rankingContainer = document.querySelector('#playlist-result-modal .ranking-container');
    if (rankingContainer) {
      rankingContainer.innerHTML = `
        <div style="text-align: center; padding: 30px; color: #aaa;">
          <div style="font-size: 48px; margin-bottom: 15px;"><i class="fas fa-clipboard-list"></i></div>
          <div style="font-size: 16px;">Esta é uma playlist customizada.</div>
          <div style="font-size: 14px; margin-top: 10px; color: #666;">Rankings são salvos apenas para playlists oficiais.</div>
        </div>
      `;
    }
  }
}

async function loadPlaylistResultRanking(playlistName: string): Promise<void> {
  const loadingDiv = document.getElementById('result-loading');
  const tbody = document.getElementById('result-ranking-tbody');
  const nickname = getNickname();
  
  if (!tbody) return;
  
  if (loadingDiv) loadingDiv.style.display = 'block';
  tbody.innerHTML = '';
  
  try {
    const rankings = await getTopScores(playlistName, 10);
    
    rankings.forEach((entry, index) => {
      const row = document.createElement('tr');
      const isCurrentPlayer = entry.nickname === nickname;
      
      row.style.borderBottom = '1px solid rgba(102, 126, 234, 0.2)';
      if (isCurrentPlayer) {
        row.style.background = 'rgba(102, 126, 234, 0.2)';
      }
      
      const timeStr = formatTime(entry.time);
      
      // Medalhas para top 3
      let rankDisplay = (index + 1).toString();
      if (index === 0) rankDisplay = '<i class="fas fa-medal" style="color: #ffd700;"></i>';
      else if (index === 1) rankDisplay = '<i class="fas fa-medal" style="color: #c0c0c0;"></i>';
      else if (index === 2) rankDisplay = '<i class="fas fa-medal" style="color: #cd7f32;"></i>';
      
      row.innerHTML = `
        <td style="padding: 10px; font-weight: bold; font-size: 16px;">${rankDisplay}</td>
        <td style="padding: 10px; font-weight: ${isCurrentPlayer ? 'bold' : '500'}; color: ${isCurrentPlayer ? '#ffd700' : '#fff'};">${entry.nickname}</td>
        <td style="padding: 10px; text-align: center; color: #aaa;">${entry.kicks}</td>
        <td style="padding: 10px; text-align: center; color: #aaa;">${timeStr}</td>
        <td style="padding: 10px; text-align: right; font-weight: bold; color: #ffd700;">${entry.score.toLocaleString()}</td>
      `;
      
      tbody.appendChild(row);
    });
    
    if (rankings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #999;">Nenhum ranking ainda. Seja o primeiro!</td></tr>';
    }
  } catch (error) {
    console.error('Error loading playlist ranking:', error);
    tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #e74c3c;">Erro ao carregar ranking</td></tr>';
  } finally {
    if (loadingDiv) loadingDiv.style.display = 'none';
  }
}

function hidePlaylistResultModal(): void {
  const modal = document.getElementById('playlist-result-modal');
  if (modal) modal.classList.add('hidden');
}

function retryPlaylist(): void {
  if (lastPlaylistData) {
    const playlistToRetry = lastPlaylistData;
    lastPlaylistData = null;
    hidePlaylistResultModal();
    startPlaylistMode(playlistToRetry);
  }
}

function resumeGame(): void {
  hideAllScreens();
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) gameContainer.classList.remove('hidden');
  
  // Restaurar UI apropriada
  if (isPlaylistMode) {
    document.getElementById('playlist-hud')?.classList.remove('hidden');
    document.getElementById('game-info')?.classList.add('hidden');
  } else {
    document.getElementById('game-info')?.classList.remove('hidden');
    document.getElementById('playlist-hud')?.classList.add('hidden');
  }
  
  if (currentGame && !isPlaylistMode) {
    currentGame.resume();
  }
}

function restartGame(): void {
  const newConfig = getConfigFromSettingsForm();
  const newMapType = (document.getElementById('settings-map-select') as HTMLSelectElement).value;
  
  if (currentGame) {
    currentGame.stop();
  }
  
  startGame(newConfig, newMapType);
}

function setupSliderListeners(): void {
  const sliders = [
    { input: 'settings-kick-strength', value: 'settings-kick-strength-value' },
    { input: 'settings-player-radius', value: 'settings-player-radius-value' },
    { input: 'settings-player-speed', value: 'settings-player-speed-value' },
    { input: 'settings-player-acceleration', value: 'settings-player-acceleration-value' },
    { input: 'settings-ball-radius', value: 'settings-ball-radius-value' },
    { input: 'settings-ball-mass', value: 'settings-ball-mass-value' },
    { input: 'settings-ball-damping', value: 'settings-ball-damping-value' },
    { input: 'settings-kick-speed-multiplier', value: 'settings-kick-speed-multiplier-value' }
  ];
  
  sliders.forEach(({ input, value }) => {
    const inputEl = document.getElementById(input) as HTMLInputElement;
    const valueEl = document.getElementById(value);
    if (inputEl && valueEl) {
      inputEl.addEventListener('input', () => {
        valueEl.textContent = inputEl.value;
      });
    }
  });
}

function init(): void {
  // Botões principais
  const btnPlay = document.getElementById('btn-play');
  const btnMenu = document.getElementById('btn-menu');
  const btnBackLanguage = document.getElementById('btn-back-language');
  const btnFreeTraining = document.getElementById('btn-free-training');
  const btnPlaylists = document.getElementById('btn-playlists');
  const btnPlaylistEditor = document.getElementById('btn-playlist-editor');
  const btnBackFromPlaylists = document.getElementById('btn-back-from-playlists');
  const btnApplySettings = document.getElementById('btn-apply-settings');
  const btnResumeGame = document.getElementById('btn-resume-game');
  const btnViewRanking = document.getElementById('btn-view-ranking');
  const btnCloseRanking = document.getElementById('btn-close-ranking');
  const rankingPlaylistSelect = document.getElementById('ranking-playlist-select') as HTMLSelectElement;
  const btnRetryPlaylist = document.getElementById('btn-retry-playlist');
  const btnCloseResult = document.getElementById('btn-close-result');
  
  if (btnPlay) {
    btnPlay.addEventListener('click', showGameModesMenu);
  }
  
  if (btnMenu) {
    btnMenu.addEventListener('click', showLanguageMenu);
  }
  
  if (btnBackLanguage) {
    btnBackLanguage.addEventListener('click', showLanguageMenu);
  }
  
  if (btnFreeTraining) {
    btnFreeTraining.addEventListener('click', () => {
      startGame(currentConfig, currentMapType);
    });
  }
  
  if (btnPlaylists) {
    btnPlaylists.addEventListener('click', showPlaylistsMenu);
  }
  
  if (btnPlaylistEditor) {
    btnPlaylistEditor.addEventListener('click', () => {
      startEditor();
    });
  }
  
  if (btnBackFromPlaylists) {
    btnBackFromPlaylists.addEventListener('click', showGameModesMenu);
  }
  
  // Botões de ranking
  if (btnViewRanking) {
    btnViewRanking.addEventListener('click', showRankingModal);
  }
  
  if (btnCloseRanking) {
    btnCloseRanking.addEventListener('click', hideRankingModal);
  }
  
  if (rankingPlaylistSelect) {
    rankingPlaylistSelect.addEventListener('change', () => {
      const selectedPlaylist = rankingPlaylistSelect.value;
      loadRanking(selectedPlaylist || undefined);
    });
  }
  
  // Botões do modal de resultado de playlist
  if (btnRetryPlaylist) {
    btnRetryPlaylist.addEventListener('click', retryPlaylist);
  }
  
  if (btnCloseResult) {
    btnCloseResult.addEventListener('click', () => {
      hidePlaylistResultModal();
      showPlaylistsMenu();
    });
  }
  
  // Botão de importação de playlist
  const btnImportPlaylist = document.getElementById('btn-import-playlist');
  if (btnImportPlaylist) {
    btnImportPlaylist.addEventListener('click', importPlaylistFromFile);
  }
  
  if (btnApplySettings) {
    btnApplySettings.addEventListener('click', restartGame);
  }
  
  if (btnResumeGame) {
    btnResumeGame.addEventListener('click', resumeGame);
  }
  
  // Configurar tabs de playlist
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = (button as HTMLElement).dataset.tab;
      if (!tabName) return;
      
      // Atualizar botões
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Atualizar conteúdo
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`tab-${tabName}`)?.classList.add('active');
    });
  });
  
  // Botão de iniciar playlist
  const btnStartPlaylist = document.getElementById('btn-start-playlist');
  if (btnStartPlaylist) {
    btnStartPlaylist.addEventListener('click', () => {
      if (selectedPlaylistData) {
        startPlaylistMode(selectedPlaylistData.data);
      }
    });
  }
  
  // Scroll infinito no ranking
  const rankingList = document.getElementById('ranking-list');
  if (rankingList) {
    rankingList.addEventListener('scroll', () => {
      const scrollTop = rankingList.scrollTop;
      const scrollHeight = rankingList.scrollHeight;
      const clientHeight = rankingList.clientHeight;
      
      // Carregar mais quando estiver perto do final
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        if (selectedPlaylistData) {
          loadPlaylistRanking(selectedPlaylistData.name, false);
        }
      }
    });
  }
  
  // Configurar sliders
  setupSliderListeners();
  
  // Configurar seleção de idioma
  const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
  if (languageSelect) {
    languageSelect.value = i18n.getLanguage();
    
    languageSelect.addEventListener('change', () => {
      i18n.setLanguage(languageSelect.value as 'en' | 'pt');
      updateTranslations();
    });
  }
  
  // Listener para sair do editor
  window.addEventListener('editor-exit', () => {
    showGameModesMenu();
  });
  
  // Listener global para ESC abrir configurações durante o jogo
  window.addEventListener('keydown', (e) => {
    // Ignorar se estiver configurando keybind
    if (currentlyConfiguringAction) {
      return;
    }
    
    if (e.key === 'Escape') {
      e.preventDefault();
      
      // Ignorar se o editor acabou de sair do modo de teste
      if ((window as any)._editorJustExitedTest) {
        return;
      }
      
      // Se o menu de configurações está aberto, fecha e retoma o jogo
      const settingsMenu = document.getElementById('settings-menu');
      if (settingsMenu && !settingsMenu.classList.contains('hidden')) {
        resumeGame();
        return;
      }
      
      // Só abre configurações se estiver no jogo
      const gameContainer = document.getElementById('game-container');
      if (gameContainer && !gameContainer.classList.contains('hidden')) {
        if (isPlaylistMode) {
          // Sair do modo playlist
          showPlaylistsMenu();
        } else if (currentEditor) {
          // Ignorar ESC no editor (o editor tem seu próprio handler)
          return;
        } else {
          // Abrir configurações no modo normal
          showSettingsMenu();
        }
      }
    }
    
    // Controles do modo playlist
    if (isPlaylistMode && currentPlaylist) {
      const gameContainer = document.getElementById('game-container');
      if (gameContainer && !gameContainer.classList.contains('hidden')) {
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          hideFeedback();
          currentPlaylist.resetScenario();
          updatePlaylistHUD();
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          currentPlaylist.nextScenario();
          updatePlaylistHUD();
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          currentPlaylist.prevScenario();
          updatePlaylistHUD();
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          hideFeedback();
          currentPlaylist.restartPlaylist();
          updatePlaylistHUD();
        }
      }
    }
  });

  // Atualizar traduções na inicialização
  updateTranslations();
  
  // Inicializar nickname
  initNickname();
  
  showLanguageMenu();
}

// Funções para gerenciar keybindings
function updateKeybindingsDisplay(): void {
  const actions: (keyof KeyBindings)[] = ['up', 'down', 'left', 'right', 'kick', 'switchPlayer'];
  actions.forEach(action => {
    const input = document.getElementById(`keybind-${action}`) as HTMLInputElement;
    if (input) {
      input.value = keyBindings.getDisplayString(action);
    }
  });
}

(window as any).configureKeybind = function(action: keyof KeyBindings): void {
  currentlyConfiguringAction = action;
  const input = document.getElementById(`keybind-${action}`) as HTMLInputElement;
  if (input) {
    input.value = 'Press any key...';
    input.style.background = '#fff3cd';
  }
};

(window as any).resetKeybindings = function(): void {
  keyBindings.resetToDefault();
  updateKeybindingsDisplay();
};

// Listener para capturar teclas durante configuração
document.addEventListener('keydown', (e) => {
  if (currentlyConfiguringAction) {
    e.preventDefault();
    
    // Ignora Escape para cancelar
    if (e.key === 'Escape') {
      currentlyConfiguringAction = null;
      updateKeybindingsDisplay();
      return;
    }
    
    // Define a nova tecla (só uma por ação para simplificar)
    keyBindings.setBinding(currentlyConfiguringAction, [e.key]);
    
    // Atualiza display
    const input = document.getElementById(`keybind-${currentlyConfiguringAction}`) as HTMLInputElement;
    if (input) {
      input.style.background = '#f5f5f5';
    }
    
    currentlyConfiguringAction = null;
    updateKeybindingsDisplay();
  }
});

// Funções para gerenciar nickname
function initNickname(): void {
  const nicknameInput = document.getElementById('nickname-input') as HTMLInputElement;
  if (nicknameInput) {
    nicknameInput.value = getNickname();
    
    nicknameInput.addEventListener('change', () => {
      const value = nicknameInput.value.trim();
      if (isValidNickname(value)) {
        saveNickname(value);
      } else {
        alert('Nickname must be 3-16 alphanumeric characters');
        nicknameInput.value = getNickname();
      }
    });
  }
  
  const btnRandomNickname = document.getElementById('btn-random-nickname');
  if (btnRandomNickname) {
    btnRandomNickname.addEventListener('click', () => {
      const newNickname = generateRandomNickname();
      saveNickname(newNickname);
      if (nicknameInput) nicknameInput.value = newNickname;
    });
  }
}

// Funções para gerenciar ranking
async function showRankingModal(): Promise<void> {
  const modal = document.getElementById('ranking-modal');
  if (!modal) return;
  
  modal.classList.remove('hidden');
  
  // Carregar playlists no select
  const playlistSelect = document.getElementById('ranking-playlist-select') as HTMLSelectElement;
  if (playlistSelect) {
    // Adicionar playlists disponíveis
    const playlists = [
      { name: 'Cruzamento - Fácil', value: 'Cruzamento - Fácil' },
      { name: 'Drible e Gol', value: 'Drible e Gol' }
    ];
    playlistSelect.innerHTML = '<option value="">Global (All Playlists)</option>';
    playlists.forEach(playlist => {
      const option = document.createElement('option');
      option.value = playlist.value;
      option.textContent = playlist.name;
      playlistSelect.appendChild(option);
    });
  }
  
  await loadRanking();
}

async function loadRanking(playlistName?: string): Promise<void> {
  const loadingDiv = document.getElementById('ranking-loading');
  const tbody = document.getElementById('ranking-tbody');
  
  if (!tbody) return;
  
  if (loadingDiv) loadingDiv.style.display = 'block';
  tbody.innerHTML = '';
  
  try {
    let rankings: RankingEntry[];
    
    if (playlistName) {
      rankings = await getTopScores(playlistName, 50);
    } else {
      rankings = await (await import('./firebase.js')).getGlobalRanking(50);
    }
    
    rankings.forEach((entry, index) => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid #e0e0e0';
      
      const timeStr = formatTime(entry.time);
      
      row.innerHTML = `
        <td style="padding: 10px; font-weight: bold; color: ${index < 3 ? '#f39c12' : '#333'};">${index + 1}</td>
        <td style="padding: 10px; font-weight: 500;">${entry.nickname}</td>
        <td style="padding: 10px; color: #666; font-size: 14px;">${entry.playlistName}</td>
        <td style="padding: 10px; text-align: center;">${entry.kicks}</td>
        <td style="padding: 10px; text-align: center;">${timeStr}</td>
        <td style="padding: 10px; text-align: right; font-weight: bold; color: #667eea;">${entry.score.toLocaleString()}</td>
      `;
      
      tbody.appendChild(row);
    });
    
    if (rankings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #999;">No rankings yet</td></tr>';
    }
  } catch (error) {
    console.error('Error loading ranking:', error);
    tbody.innerHTML = '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #e74c3c;">Error loading rankings</td></tr>';
  } finally {
    if (loadingDiv) loadingDiv.style.display = 'none';
  }
}

function hideRankingModal(): void {
  const modal = document.getElementById('ranking-modal');
  if (modal) modal.classList.add('hidden');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
