import { Game } from './game.js';
import { DEFAULT_MAP, CLASSIC_MAP } from './maps.js';
import { GameConfig, Playlist } from './types.js';
import { i18n } from './i18n.js';
import { PlaylistMode } from './playlist.js';
import { keyBindings, KeyBindings } from './keybindings.js';

let currentGame: Game | null = null;
let currentPlaylist: PlaylistMode | null = null;
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
      element.textContent = i18n.t(key);
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
  
  if (currentPlaylist) {
    currentPlaylist.stop();
    currentPlaylist = null;
  }
}

function showGameModesMenu(): void {
  hideAllScreens();
  document.body.classList.remove('game-active');
  const menu = document.getElementById('game-modes-menu');
  menu?.classList.remove('hidden');
  menu?.style.removeProperty('display');
}

function showPlaylistsMenu(): void {
  hideAllScreens();
  document.body.classList.remove('game-active');
  const menu = document.getElementById('playlists-menu');
  menu?.classList.remove('hidden');
  menu?.style.removeProperty('display');
  
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

async function loadAvailablePlaylists(): Promise<void> {
  const listContainer = document.getElementById('playlists-list');
  if (!listContainer) return;
  
  // Lista hardcoded de playlists disponíveis
  const playlists = [
    { file: 'basic-passing.json', name: 'Treino Básico de Passes', description: 'Aprenda os fundamentos de passes e controle de bola' },
    { file: 'training-with-bots.json', name: 'Treino com Bots', description: 'Aprenda a jogar com e contra bots inteligentes' },
    { file: 'precision-speed.json', name: 'Precisão e Velocidade', description: 'Teste seus reflexos e precisão em cenários desafiadores' },
    { file: 'kick-control.json', name: 'Controle de Chutes', description: 'Aprenda a controlar quando e como chutar' },
    { file: 'movement-mastery.json', name: 'Domínio de Movimento', description: 'Cenários com spawns e velocidades variadas para domínio total' }
  ];
  
  listContainer.innerHTML = '';
  
  for (const playlistInfo of playlists) {
    const btn = document.createElement('button');
    btn.textContent = `${playlistInfo.name}`;
    btn.style.cssText = 'width: 100%; margin: 10px 0; padding: 15px; text-align: left;';
    btn.onclick = () => loadAndStartPlaylist(playlistInfo.file);
    
    const desc = document.createElement('div');
    desc.textContent = playlistInfo.description;
    desc.style.cssText = 'font-size: 12px; color: #666; margin-top: 5px;';
    
    const container = document.createElement('div');
    container.style.cssText = 'margin: 10px 0;';
    
    btn.appendChild(desc);
    container.appendChild(btn);
    listContainer.appendChild(container);
  }
}

async function loadAndStartPlaylist(filename: string): Promise<void> {
  try {
    const response = await fetch(`/playlists/${filename}`);
    if (!response.ok) throw new Error('Failed to load playlist');
    
    const playlist: Playlist = await response.json();
    startPlaylistMode(playlist);
  } catch (error) {
    console.error('Error loading playlist:', error);
    alert('Erro ao carregar playlist!');
  }
}

function startPlaylistMode(playlist: Playlist): void {
  hideAllScreens();
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) gameContainer.classList.remove('hidden');
  
  // Prevenir scroll durante o jogo
  document.body.classList.add('game-active');
  
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }
  
  isPlaylistMode = true;
  
  // Mostrar HUD de playlist
  document.getElementById('playlist-hud')?.classList.remove('hidden');
  document.getElementById('game-info')?.classList.add('hidden');
  
  // Criar PlaylistMode
  currentPlaylist = new PlaylistMode(canvas, playlist, currentConfig, {
    onScenarioComplete: (index) => {
      showFeedback('✓ Cenário Completo!', '#00ff00');
    },
    onPlaylistComplete: () => {
      showFeedback('🎉 Playlist Completa!', '#ffff00', true);
      setTimeout(() => {
        showPlaylistsMenu();
      }, 3000);
    },
    onScenarioFail: (reason) => {
      showFeedback(`✗ ${reason}`, '#ff0000');
    },
    onScenarioStart: (index) => {
      updatePlaylistHUD();
    }
  });
  
  // Atualizar HUD
  updatePlaylistHUD();
  
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
  const btnBackFromPlaylists = document.getElementById('btn-back-from-playlists');
  const btnApplySettings = document.getElementById('btn-apply-settings');
  const btnResumeGame = document.getElementById('btn-resume-game');
  
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
  
  if (btnBackFromPlaylists) {
    btnBackFromPlaylists.addEventListener('click', showGameModesMenu);
  }
  
  if (btnApplySettings) {
    btnApplySettings.addEventListener('click', restartGame);
  }
  
  if (btnResumeGame) {
    btnResumeGame.addEventListener('click', resumeGame);
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
  
  // Listener global para ESC abrir configurações durante o jogo
  window.addEventListener('keydown', (e) => {
    // Ignorar se estiver configurando keybind
    if (currentlyConfiguringAction) {
      return;
    }
    
    if (e.key === 'Escape') {
      e.preventDefault();
      
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
        }
      }
    }
  });

  // Atualizar traduções na inicialização
  updateTranslations();
  
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
