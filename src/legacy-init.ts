/**
 * Bridge entre código legado (game engine) e React UI.
 * Expõe funções de controle de jogo, playlist e editor via window.
 */

import { Game } from './game.js';
import { DEFAULT_MAP, CLASSIC_MAP } from './maps.js';
import { GameConfig, Playlist } from './types.js';
import { PlaylistMode } from './playlist.js';
import { PlaylistEditor } from './editor.js';
import { getNickname } from './player.js';
import { submitScore, getPlayerHighscore, calculateScore, isOfficialPlaylist, RankingEntry } from './firebase.js';

let currentGame: Game | null = null;
let currentPlaylist: PlaylistMode | null = null;
let currentEditor: PlaylistEditor | null = null;
let currentConfig: GameConfig = loadConfigFromStorage();
let currentMapType: string = localStorage.getItem('mapType') || 'default';
let isPlaylistMode: boolean = false;

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
      mass: 2,
      damping: 0.99,
      color: '#ffff00',
      borderColor: '#000000',
      borderWidth: 2
    }
  };
}

function loadConfigFromStorage(): GameConfig {
  const savedConfig = localStorage.getItem('gameConfig');
  if (savedConfig) {
    try {
      return JSON.parse(savedConfig) as GameConfig;
    } catch (e) {
      console.error('Error loading config from storage:', e);
    }
  }
  return getDefaultConfig();
}

// ── Playlist HUD ──

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
  stopPlaylistHUDLoop();
  
  if (currentPlaylist) {
    currentPlaylist.stop();
    currentPlaylist = null;
  }
  
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

// ── Feedback ──

function showFeedback(text: string, color: string, persistent: boolean = false): void {
  const feedback = document.getElementById('playlist-feedback');
  const feedbackText = document.getElementById('feedback-text');
  
  if (!feedback || !feedbackText) return;
  
  feedbackText.innerHTML = text;
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



// ── Window exports for React ──

// Listener para "Play Again" disparado pelo overlay React de game-over
const handlePlayAgain = () => {
  if (currentGame) {
    currentGame.reset();
    currentGame.start();
  }
};
window.addEventListener('game-play-again', handlePlayAgain);

(window as any).initGameCanvas = () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }
  
  // Recarregar configurações do localStorage
  currentConfig = loadConfigFromStorage();
  currentMapType = localStorage.getItem('mapType') || 'default';
  
  const map = currentMapType === 'classic' ? CLASSIC_MAP : DEFAULT_MAP;
  isPlaylistMode = false;
  
  document.getElementById('playlist-hud')?.classList.add('hidden');
  document.getElementById('game-info')?.classList.remove('hidden');
  
  currentGame = new Game(canvas, map, currentConfig);
  currentGame.initPlayers();
  currentGame.reset();
  currentGame.start();
  
  document.body.classList.add('game-active');
};

(window as any).initEditorCanvas = () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }

  if (currentGame) {
    currentGame.stop();
    currentGame = null;
  }

  stopCurrentPlaylist();

  document.getElementById('game-info')?.classList.add('hidden');
  document.getElementById('playlist-hud')?.classList.add('hidden');

  currentEditor = new PlaylistEditor(canvas, currentMapType);
  currentEditor.start();

  document.body.classList.add('game-active');
};

(window as any).initPlaylistCanvas = (playlist: Playlist) => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }
  
  if (currentGame) {
    currentGame.stop();
    currentGame = null;
  }
  
  if (currentPlaylist) {
    currentPlaylist.stop();
    currentPlaylist = null;
  }
  
  isPlaylistMode = true;
  
  document.getElementById('playlist-hud')?.classList.remove('hidden');
  document.getElementById('game-info')?.classList.add('hidden');
  
  // Playlists sempre usam configurações padrão (exceto keybinds)
  const playlistConfig = getDefaultConfig();
  
  currentPlaylist = new PlaylistMode(canvas, playlist, playlistConfig, {
    onScenarioComplete: (_index) => {
      showFeedback('<i class="fas fa-check"></i> Cenário Completo!', '#00ff00');
    },
    onPlaylistComplete: async () => {
      showFeedback('<i class="fas fa-trophy"></i> Playlist Completa!', '#ffff00', true);
      
      const nickname = getNickname();
      const kicks = currentPlaylist!.getTotalKicks();
      const time = currentPlaylist!.getPlaylistTime();
      const score = calculateScore(kicks, time);
      
      let previousHighscore: RankingEntry | null = null;
      try {
        previousHighscore = await getPlayerHighscore(nickname, playlist.name);
      } catch (error) {
        console.error('Failed to get previous highscore:', error);
      }
      
      try {
        await submitScore(nickname, playlist.name, kicks, time);
        console.log('Score submitted!');
      } catch (error) {
        console.error('Failed to submit score:', error);
      }
      
      setTimeout(() => {
        hideFeedback();
        // Dispatch event for React GamePage to show the result modal
        window.dispatchEvent(new CustomEvent('playlist-complete', {
          detail: {
            playlistName: playlist.name,
            kicks,
            time,
            score,
            previousHighscore,
            isOfficial: isOfficialPlaylist(playlist.name),
            playlistData: playlist,
          }
        }));
      }, 2000);
    },
    onScenarioFail: (reason) => {
      showFeedback(`<i class="fas fa-times"></i> ${reason}`, '#ff0000');
    },
    onScenarioStart: (_index) => {
      updatePlaylistHUD();
    }
  });
  
  updatePlaylistHUD();
  currentPlaylist.resetPlaylistStats();
  currentPlaylist.startScenario(0);
  startPlaylistHUDLoop();
  
  document.body.classList.add('game-active');
};

(window as any).cleanupGame = () => {
  if (currentGame) {
    currentGame.stop();
    currentGame = null;
  }
  if (currentPlaylist) {
    currentPlaylist.stop();
    currentPlaylist = null;
  }
  if (currentEditor) {
    currentEditor.cleanup();
    currentEditor = null;
  }
  stopPlaylistHUDLoop();
  document.body.classList.remove('game-active');
};

// Controles de playlist expostos para React
(window as any).playlistResetScenario = () => {
  if (currentPlaylist) {
    hideFeedback();
    currentPlaylist.resetScenario();
    updatePlaylistHUD();
  }
};
(window as any).playlistNextScenario = () => {
  if (currentPlaylist) {
    hideFeedback();
    currentPlaylist.nextScenario();
    updatePlaylistHUD();
  }
};
(window as any).playlistPrevScenario = () => {
  if (currentPlaylist) {
    hideFeedback();
    currentPlaylist.prevScenario();
    updatePlaylistHUD();
  }
};
(window as any).playlistRestart = () => {
  if (currentPlaylist) {
    hideFeedback();
    currentPlaylist.restartPlaylist();
    updatePlaylistHUD();
  }
};
(window as any).getIsPlaylistMode = () => isPlaylistMode;
