/**
 * Bridge entre código legado (game engine) e React UI.
 * Expõe funções de controle de jogo, playlist e editor via window.
 */

import { Game } from './game.js';
import { DEFAULT_MAP, CLASSIC_MAP } from './maps.js';
import { GameConfig, Playlist, ReplayData } from './types.js';
import { PlaylistMode } from './playlist.js';
import { PlaylistEditor } from './editor.js';
import { getNickname } from './player.js';
import { submitScore, getPlayerHighscore, calculateScore, isOfficialPlaylist, RankingEntry } from './firebase.js';
import { saveReplay, getReplayById } from './replay.js';
import { KeyboardInputController, ReplayInputController } from './input/index.js';
import {
  trackFreePlayStart,
  trackFreePlayEnd,
  trackPlaylistStart,
  trackPlaylistComplete,
  trackScenarioComplete,
  trackScenarioFail,
  trackPlaylistRestart,
  trackScoreSubmit,
  trackEditorOpen,
} from './analytics.js';

let currentGame: Game | null = null;
let currentPlaylist: PlaylistMode | null = null;
let currentEditor: PlaylistEditor | null = null;
let currentConfig: GameConfig = loadConfigFromStorage();
let currentReplayController: ReplayInputController | null = null;
let isReplayMode: boolean = false;
let currentMapType: string = localStorage.getItem('mapType') || 'default';
let isPlaylistMode: boolean = false;
let communityPlaylistId: string | undefined = undefined; // ID da playlist da comunidade (se aplicável)
let isEditorMode: boolean = false;

function getDefaultConfig(): GameConfig {
  return {
    timeLimit: 300,
    scoreLimit: 3,
    playersPerTeam: 2,
    kickMode: 'classic',
    kickStrength: 500,
    playerRadius: 15,
    playerSpeed: 150,
    playerAcceleration: 7.5,
    playerDamping: 0.96,
    playerMass: 10,
    playerBounce: 0.5,
    kickSpeedMultiplier: 1.0,
    ballConfig: {
      radius: 8,
      mass: 5,
      damping: 0.99,
      bounce: 0.5,
      playerRestitution: 0.35,
      color: '#ffff00',
      borderColor: '#000000',
      borderWidth: 2
    }
  };
}

function loadConfigFromStorage(): GameConfig {
  const savedConfig = localStorage.getItem('gameConfig');
  const interpolationSaved = localStorage.getItem('interpolation');
  const interpolationEnabled = interpolationSaved ? interpolationSaved === 'true' : true; // Padrão: ativado
  
  if (savedConfig) {
    try {
      const config = JSON.parse(savedConfig) as GameConfig;
      config.interpolation = interpolationEnabled; // Adiciona configuração de interpolação
      return config;
    } catch (e) {
      console.error('Error loading config from storage:', e);
    }
  }
  const defaultConfig = getDefaultConfig();
  defaultConfig.interpolation = interpolationEnabled; // Adiciona configuração de interpolação
  return defaultConfig;
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
  document.getElementById('playlist-hud-bottom')?.classList.add('hidden');
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
    
    const game = currentPlaylist.getGame();
    if (!game) return;
    
    const elapsed = game.getState().time - progress.scenarioStartTime;
    const remaining = Math.max(0, scenario.timeLimit - elapsed);
    
    const timerEl = document.getElementById('scenario-timer');
    if (timerEl) {
      // Formatar como MM:SS.S
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
      timerEl.textContent = formattedTime;
      
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
  isEditorMode = false;
  
  document.getElementById('playlist-hud')?.classList.add('hidden');
  document.getElementById('playlist-hud-bottom')?.classList.add('hidden');
  document.getElementById('game-info')?.classList.remove('hidden');
  
  currentGame = new Game(canvas, map, currentConfig);
  currentGame.initPlayers();
  currentGame.reset();
  currentGame.start();
  
  trackFreePlayStart(currentMapType);
  
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
  document.getElementById('playlist-hud-bottom')?.classList.add('hidden');

  isPlaylistMode = false;
  isEditorMode = true;

  currentEditor = new PlaylistEditor(canvas, currentMapType);
  currentEditor.start();

  trackEditorOpen();
  
  document.body.classList.add('game-active');
};

(window as any).initPlaylistCanvas = (playlist: Playlist, playlistId?: string) => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }
  
  // Salvar ID da playlist da comunidade (se fornecido)
  communityPlaylistId = playlistId;
  
  if (currentGame) {
    currentGame.stop();
    currentGame = null;
  }
  
  if (currentPlaylist) {
    currentPlaylist.stop();
    currentPlaylist = null;
  }
  
  isPlaylistMode = true;
  isEditorMode = false;
  
  document.getElementById('playlist-hud')?.classList.remove('hidden');
  document.getElementById('playlist-hud-bottom')?.classList.remove('hidden');
  document.getElementById('game-info')?.classList.add('hidden');
  
  // Se randomizeOrder estiver ativado, embaralhar os cenários
  if (playlist.randomizeOrder) {
    // Fisher-Yates shuffle
    const scenarios = [...playlist.scenarios];
    for (let i = scenarios.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [scenarios[i], scenarios[j]] = [scenarios[j], scenarios[i]];
    }
    playlist = { ...playlist, scenarios };
  }
  
  // Playlists sempre usam configurações padrão (exceto keybinds)
  // IMPORTANTE: Usar config padrão fixo para garantir determinismo entre editor e modo de jogo
  const baseConfig = getDefaultConfig();
  
  // Se a playlist contém configurações de física customizadas, aplicá-las
  // Isso garante que a física no editor e ao jogar a playlist seja idêntica
  let playlistConfig: GameConfig;
  if (playlist.gameConfig) {
    const { ballConfig: playlistBallConfig, ...restGameConfig } = playlist.gameConfig;
    playlistConfig = {
      ...baseConfig,
      ...restGameConfig,
      ballConfig: playlistBallConfig
        ? { ...baseConfig.ballConfig, ...playlistBallConfig }
        : baseConfig.ballConfig
    };
  } else {
    playlistConfig = baseConfig;
  }
  
  currentPlaylist = new PlaylistMode(canvas, playlist, playlistConfig, {
    onScenarioComplete: (_index) => {
      showFeedback('<i class="fas fa-check"></i> Cenário Completo!', '#00ff00');
      trackScenarioComplete(playlist.name, _index);
    },
    onPlaylistComplete: async () => {
      showFeedback('<i class="fas fa-trophy"></i> Playlist Completa!', '#ffff00', true);
      
      const nickname = getNickname();
      const time = currentPlaylist!.getPlaylistTime();
      const score = calculateScore(time);
      
      // Parar gravação do replay e salvar
      let savedReplayId: string | undefined;
      try {
        const replayRecorder = currentPlaylist!.stopReplayRecording();
        if (replayRecorder) {
          const replayData = replayRecorder.getReplayData(time);
          if (replayData && replayData.events.length > 0) {
            savedReplayId = await saveReplay(replayData);
            console.log('Replay saved with ID:', savedReplayId);
          }
        }
      } catch (error) {
        console.error('Failed to save replay:', error);
      }
      
      let previousHighscore: RankingEntry | null = null;
      try {
        // Se for playlist da comunidade, buscar do ranking da comunidade
        if (communityPlaylistId) {
          const { getPlayerCommunityPlaylistHighscore } = await import('./firebase.js');
          previousHighscore = await getPlayerCommunityPlaylistHighscore(nickname, communityPlaylistId);
        } else {
          previousHighscore = await getPlayerHighscore(nickname, playlist.name);
        }
      } catch (error) {
        console.error('Failed to get previous highscore:', error);
      }
      
      // Playlists oficiais e playlists da comunidade salvam scores
      // Se tem communityPlaylistId, é playlist da comunidade (não oficial)
      const isOfficial = !communityPlaylistId && isOfficialPlaylist(playlist.name);
      trackPlaylistComplete(playlist.name, time, score, isOfficial);
      
      try {
        // Se for playlist da comunidade, passar o ID e o replayId
        await submitScore(nickname, playlist.name, time, communityPlaylistId, savedReplayId);
        console.log('Score submitted with replayId:', savedReplayId);
        const isNewHighscore = !previousHighscore || score > previousHighscore.score;
        trackScoreSubmit(playlist.name, score, isNewHighscore);
      } catch (error) {
        console.error('Failed to submit score:', error);
      }
      
      // Incrementar contador de plays se for playlist da comunidade (apenas ao completar)
      if (communityPlaylistId) {
        try {
          const { incrementPlaylistPlays } = await import('./community-playlists.js');
          await incrementPlaylistPlays(communityPlaylistId, nickname);
        } catch (error) {
          console.error('Error incrementing playlist plays:', error);
        }
      }
      
      setTimeout(() => {
        hideFeedback();
        // Dispatch event for React GamePage to show the result modal
        window.dispatchEvent(new CustomEvent('playlist-complete', {
          detail: {
            playlistName: playlist.name,
            time,
            score,
            previousHighscore,
            isOfficial,
            playlistData: playlist,
            communityPlaylistId,
          }
        }));
      }, 2000);
    },
    onScenarioFail: (reason) => {
      showFeedback(`<i class="fas fa-times"></i> ${reason}`, '#ff0000');
      trackScenarioFail(playlist.name, currentPlaylist?.getProgress().currentScenarioIndex ?? 0, reason);
    },
    onScenarioStart: (_index) => {
      updatePlaylistHUD();
    }
  });
  
  updatePlaylistHUD();
  currentPlaylist.resetPlaylistStats();
  
  // Iniciar gravação de replay
  const nickname = getNickname();
  currentPlaylist.startReplayRecording(nickname, communityPlaylistId);
  
  // Conectar o replay recorder ao input controller do player
  const game = currentPlaylist.getGame();
  if (game) {
    const players = game.getPlayers();
    if (players.length > 0) {
      const playerInputController = game.getInputController(players[0].id);
      if (playerInputController instanceof KeyboardInputController) {
        const recorder = currentPlaylist.getReplayRecorder();
        playerInputController.setReplayRecorder(recorder);
      }
    }
  }
  
  currentPlaylist.startScenario(0);
  startPlaylistHUDLoop();
  
  trackPlaylistStart(playlist.name, playlist.scenarios.length);
  
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
    trackPlaylistRestart(currentPlaylist.getPlaylist().name);
    currentPlaylist.restartPlaylist();
    updatePlaylistHUD();
  }
};
(window as any).getIsPlaylistMode = () => isPlaylistMode;
(window as any).getIsEditorMode = () => isEditorMode;
(window as any).returnToEditor = () => {
  if (currentPlaylist) {
    currentPlaylist.stop();
    currentPlaylist = null;
  }
  if (currentEditor) {
    // Reativar editor
    currentEditor.start();
    isPlaylistMode = false;
    isEditorMode = true;
    document.getElementById('playlist-hud')?.classList.add('hidden');
    document.getElementById('playlist-hud-bottom')?.classList.add('hidden');
    document.getElementById('game-info')?.classList.add('hidden');
  }
};
(window as any).editorExit = () => {
  if (currentEditor) {
    currentEditor.requestExit();
  }
};
(window as any).getIsEditorTestMode = () => {
  return currentEditor ? currentEditor.getIsTestMode() : false;
};

// ==================== REPLAY SYSTEM ====================

/**
 * Inicia reprodução de um replay
 */
(window as any).startReplay = async (
  replayId: string, 
  playlist: Playlist, 
  isCommunity: boolean = false,
  playlistId?: string
) => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas not found');
    return { success: false, error: 'Canvas not found' };
  }

  try {
    // Buscar dados do replay
    const replayData = await getReplayById(replayId, isCommunity);
    if (!replayData) {
      return { success: false, error: 'Replay not found' };
    }

    // Limpar estado anterior
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
    
    isPlaylistMode = true;
    isReplayMode = true;
    isEditorMode = false;

    document.getElementById('playlist-hud')?.classList.remove('hidden');
    document.getElementById('playlist-hud-bottom')?.classList.remove('hidden');
    document.getElementById('game-info')?.classList.add('hidden');

    // Configuração base
    const baseConfig = getDefaultConfig();
    let playlistConfig: GameConfig;
    if (playlist.gameConfig) {
      const { ballConfig: playlistBallConfig, ...restGameConfig } = playlist.gameConfig;
      playlistConfig = {
        ...baseConfig,
        ...restGameConfig,
        ballConfig: playlistBallConfig
          ? { ...baseConfig.ballConfig, ...playlistBallConfig }
          : baseConfig.ballConfig
      };
    } else {
      playlistConfig = baseConfig;
    }

    // Criar replay controller
    currentReplayController = new ReplayInputController(replayData);

    // Criar playlist em modo replay (sem gravação)
    currentPlaylist = new PlaylistMode(canvas, playlist, playlistConfig, {
      onScenarioComplete: (_index) => {
        showFeedback('<i class="fas fa-check"></i> Cenário Completo!', '#00ff00');
      },
      onPlaylistComplete: async () => {
        showFeedback('<i class="fas fa-flag-checkered"></i> Replay Finalizado!', '#ffff00', true);
        isReplayMode = false;
        
        setTimeout(() => {
          hideFeedback();
          window.dispatchEvent(new CustomEvent('replay-complete', {
            detail: {
              replayData,
              playlistName: playlist.name
            }
          }));
        }, 2000);
      },
      onScenarioFail: (reason) => {
        showFeedback(`<i class="fas fa-times"></i> ${reason}`, '#ff0000');
      },
      onScenarioStart: (_index) => {
        updatePlaylistHUD();
        
        // Conectar o replay controller ao jogo quando cenário inicia
        const game = currentPlaylist?.getGame();
        if (game && currentReplayController) {
          const players = game.getPlayers();
          if (players.length > 0) {
            game.setInputController(players[0].id, currentReplayController);
          }
        }
      }
    });

    updatePlaylistHUD();
    currentPlaylist.resetPlaylistStats();
    
    // Iniciar replay controller
    currentReplayController.start();
    
    currentPlaylist.startScenario(0);
    startPlaylistHUDLoop();
    
    document.body.classList.add('game-active');
    
    return { success: true, replayData };
  } catch (error) {
    console.error('Error starting replay:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Para a reprodução do replay atual
 */
(window as any).stopReplay = () => {
  if (currentReplayController) {
    currentReplayController.stop();
    currentReplayController = null;
  }
  isReplayMode = false;
  (window as any).cleanupGame();
};

/**
 * Verifica se está em modo replay
 */
(window as any).getIsReplayMode = () => isReplayMode;

/**
 * Obtém dados do replay atual
 */
(window as any).getCurrentReplayData = () => {
  return currentReplayController?.getReplayData() || null;
};
