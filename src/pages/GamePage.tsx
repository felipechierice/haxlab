import { useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { Playlist } from '../types';
import { RankingEntry } from '../firebase';
import PlaylistResultModal from '../components/PlaylistResultModal';


declare global {
  interface Window {
    initGameCanvas: () => void;
    initPlaylistCanvas: (playlist: Playlist) => void;
    initEditorCanvas: () => void;
    cleanupGame: () => void;
    playlistResetScenario: () => void;
    playlistNextScenario: () => void;
    playlistPrevScenario: () => void;
    playlistRestart: () => void;
    getIsPlaylistMode: () => boolean;
    getIsEditorMode: () => boolean;
    returnToEditor: () => void;
    editorExit: () => void;
    getIsEditorTestMode: () => boolean;
  }
}

interface LocationState {
  playlist?: Playlist;
  mode?: 'free' | 'playlist' | 'editor';
}

interface PlaylistResult {
  playlistName: string;
  kicks: number;
  time: number;
  score: number;
  previousHighscore: RankingEntry | null;
  isOfficial: boolean;
  playlistData: Playlist | null;
}

interface GameOverInfo {
  winner: 'red' | 'blue' | 'draw';
  score: { red: number; blue: number };
}

function GamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const state = location.state as LocationState;

  const [showResultModal, setShowResultModal] = useState(false);
  const [playlistResult, setPlaylistResult] = useState<PlaylistResult | null>(null);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isPlaylist = window.getIsPlaylistMode?.();
    const isEditor = window.getIsEditorMode?.();
    const isEditorTestMode = window.getIsEditorTestMode?.();

    if (e.key === 'Escape') {
      // Se está em modo editor testando, deixa o editor tratar ESC (sai do teste)
      if (isEditor && isEditorTestMode) {
        // Não fazer nada, o editor já trata ESC no modo teste
        return;
      }
      
      e.preventDefault();
      
      // Se está em modo editor (puro), trigger confirmação de saída
      if (isEditor) {
        // Trigger confirmação de saída do editor
        window.editorExit?.();
        return;
      } else if (isPlaylist && state?.mode === 'editor') {
        // Se está testando playlist do editor, volta para o editor
        window.returnToEditor?.();
        return;
      } else if (isPlaylist) {
        // Se está em playlist normal, mostrar confirmação antes de sair
        if (confirm('Deseja sair da playlist? O progresso será perdido.')) {
          navigate('/playlists');
        }
      } else {
        // Treino livre, abre settings
        navigate('/settings');
      }
      return;
    }

    if (isPlaylist) {
      switch (e.key.toLowerCase()) {
        case 'r':
          e.preventDefault();
          window.playlistResetScenario?.();
          break;
        case 'n':
          e.preventDefault();
          window.playlistNextScenario?.();
          break;
        case 'p':
          e.preventDefault();
          window.playlistPrevScenario?.();
          break;
        case 'backspace':
          e.preventDefault();
          window.playlistRestart?.();
          break;
      }
    }
  }, [navigate, state]);

  useEffect(() => {
    // Inicializar canvas baseado no modo
    if (state?.mode === 'playlist' && state.playlist) {
      // Modo playlist
      if (window.initPlaylistCanvas) {
        window.initPlaylistCanvas(state.playlist);
      }
    } else if (state?.mode === 'editor') {
      // Modo editor
      if (window.initEditorCanvas) {
        window.initEditorCanvas();
      }
    } else {
      // Modo treino livre
      if (window.initGameCanvas) {
        window.initGameCanvas();
      }
    }

    // Ouvir evento de playlist completa
    const handlePlaylistComplete = (e: Event) => {
      const detail = (e as CustomEvent).detail as PlaylistResult;
      setPlaylistResult(detail);
      setShowResultModal(true);
    };
    window.addEventListener('playlist-complete', handlePlaylistComplete);

    // Ouvir evento de game over
    const handleGameOver = (e: Event) => {
      const detail = (e as CustomEvent).detail as GameOverInfo;
      setGameOver(detail);
    };
    window.addEventListener('game-over', handleGameOver);

    // Ouvir evento de voltar ao menu
    const handleBackToMenuEvent = () => {
      navigate('/modes');
    };
    window.addEventListener('game-back-to-menu', handleBackToMenuEvent);

    // Ouvir evento de sair do editor
    const handleEditorExit = () => {
      navigate('/modes');
    };
    window.addEventListener('editor-exit', handleEditorExit);

    // Registrar atalhos de teclado
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup quando o componente desmontar
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('playlist-complete', handlePlaylistComplete);
      window.removeEventListener('game-over', handleGameOver);
      window.removeEventListener('game-back-to-menu', handleBackToMenuEvent);
      window.removeEventListener('editor-exit', handleEditorExit);
      if (window.cleanupGame) {
        window.cleanupGame();
      }
    };
  }, [state, handleKeyDown]);

  const handleRetryPlaylist = () => {
    setShowResultModal(false);
    setPlaylistResult(null);
    // Re-inicializar a playlist
    if (state?.playlist && window.initPlaylistCanvas) {
      window.initPlaylistCanvas(state.playlist);
    }
  };

  const handleCloseResult = () => {
    setShowResultModal(false);
    setPlaylistResult(null);
  };

  const handleBackToMenu = () => {
    navigate('/modes');
  };

  return (
    <div className="game-page">
      {/* Console de chat */}
      <div id="game-console" style={{ display: 'none' }}>
        <div id="console-messages"></div>
        <div id="console-input-container">
          <input
            type="text"
            id="console-input"
            placeholder={t('game.chatPlaceholder')}
            maxLength={200}
          />
        </div>
      </div>

      {/* HUD para modo Playlist */}
      <div id="playlist-hud" className="hidden">
        <div className="playlist-hud-name" id="playlist-name">Playlist</div>
        <div className="playlist-hud-scenario" id="scenario-name">Cenário</div>
        <div className="playlist-hud-progress">
          <span id="scenario-progress">1/5</span> cenários
        </div>
        <div className="playlist-hud-timer">
          <i className="fas fa-stopwatch"></i> <span id="scenario-timer">30.0s</span>
        </div>
        <div className="playlist-hud-controls">
          <div>R - Resetar cenário</div>
          <div>N - Próximo cenário</div>
          <div>P - Cenário anterior</div>
          <div>Backspace - Resetar playlist</div>
          <div>ESC - Sair</div>
        </div>
      </div>

      {/* Mensagem de feedback para playlists */}
      <div id="playlist-feedback" className="hidden">
        <div id="feedback-text">Texto</div>
      </div>

      {/* Game Over overlay */}
      {gameOver && (
        <div className="game-over-overlay">
          <h1 style={{ color: gameOver.winner === 'red' ? '#ff4757' : gameOver.winner === 'blue' ? '#5352ed' : '#ffa502' }}>
            {gameOver.winner === 'red' ? 'Red Team Wins!' : gameOver.winner === 'blue' ? 'Blue Team Wins!' : 'Draw!'}
          </h1>
          <p className="game-over-score">Red {gameOver.score.red} - {gameOver.score.blue} Blue</p>
          <div className="game-over-buttons">
            <button className="btn-play-again" onClick={() => { setGameOver(null); window.dispatchEvent(new CustomEvent('game-play-again')); }}>Play Again</button>
            <button className="btn-back-menu" onClick={() => { setGameOver(null); navigate('/modes'); }}>Back to Menu</button>
          </div>
        </div>
      )}

      {/* Canvas do jogo */}
      <div id="game-container" className="game-container">
        <canvas id="game-canvas" width="1000" height="600"></canvas>
        
        <div id="game-info" className="game-info">
          <div className="game-scores">
            <div className="score red-team">
              <span>{t('game.red')}</span>: <span id="red-score">0</span>
            </div>
            <div className="score">
              <span>{t('game.time')}</span>: <span id="game-time">0:00</span>
            </div>
            <div className="score blue-team">
              <span>{t('game.blue')}</span>: <span id="blue-score">0</span>
            </div>
          </div>
          
          <div className="game-controls">
            <div className="game-hint">
              <span>Pressione <kbd>ESC</kbd> para configurar</span>
            </div>
            <button onClick={handleBackToMenu}>
              {t('game.backToMenu')}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de resultado de playlist */}
      {playlistResult && (
        <PlaylistResultModal
          isOpen={showResultModal}
          playlistName={playlistResult.playlistName}
          kicks={playlistResult.kicks}
          time={playlistResult.time}
          score={playlistResult.score}
          previousHighscore={playlistResult.previousHighscore}
          isOfficial={playlistResult.isOfficial}
          playlistData={playlistResult.playlistData}
          onRetry={handleRetryPlaylist}
          onClose={handleCloseResult}
        />
      )}
    </div>
  );
}

export default GamePage;
