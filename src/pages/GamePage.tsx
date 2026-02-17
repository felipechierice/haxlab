import { useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { Playlist } from '../types';
import { RankingEntry } from '../firebase';
import PlaylistResultModal from '../components/PlaylistResultModal';
import ExitConfirmModal from '../components/ExitConfirmModal';
import { trackPageView, trackFreePlayEnd } from '../analytics';
import { useAuth } from '../contexts/AuthContext';
import { CommunityPlaylist, likePlaylist, getUserPlaylistLike, getCommunityPlaylist } from '../community-playlists';
import { audioManager } from '../audio';


declare global {
  interface Window {
    initGameCanvas: () => void;
    initPlaylistCanvas: (playlist: Playlist, communityPlaylistId?: string) => void;
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
  communityPlaylistId?: string;
}

interface PlaylistResult {
  playlistName: string;
  time: number;
  score: number;
  previousHighscore: RankingEntry | null;
  isOfficial: boolean;
  playlistData: Playlist | null;
  communityPlaylistId?: string;
}

interface GameOverInfo {
  winner: 'red' | 'blue' | 'draw';
  score: { red: number; blue: number };
}

function GamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { userProfile } = useAuth();
  const state = location.state as LocationState;

  useEffect(() => {
    const mode = state?.mode || 'free';
    trackPageView(`GamePage_${mode}`);
  }, [state?.mode]);

  const [showResultModal, setShowResultModal] = useState(false);
  const [playlistResult, setPlaylistResult] = useState<PlaylistResult | null>(null);
  const [gameOver, setGameOver] = useState<GameOverInfo | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [communityPlaylist, setCommunityPlaylist] = useState<CommunityPlaylist | null>(null);
  const [userLike, setUserLike] = useState<'like' | 'dislike' | undefined>(undefined);
  const [hadPreviousLike, setHadPreviousLike] = useState(false); // Rastreia se já tinha like/dislike no Firebase
  const [likeLoaded, setLikeLoaded] = useState(false); // Rastreia se o like já foi carregado do Firebase

  // Carregar dados da playlist da comunidade se necessário
  useEffect(() => {
    if (state?.communityPlaylistId) {
      loadCommunityPlaylistData();
    }
  }, [state?.communityPlaylistId, userProfile]); // Adiciona userProfile como dependência

  const loadCommunityPlaylistData = async () => {
    if (!state?.communityPlaylistId) return;

    try {
      const playlist = await getCommunityPlaylist(state.communityPlaylistId);
      setCommunityPlaylist(playlist);

      // Carregar like do usuário se estiver autenticado
      if (userProfile && playlist) {
        const like = await getUserPlaylistLike(playlist.id, userProfile.uid);
        setUserLike(like?.type);
        setHadPreviousLike(!!like?.type); // Marca se já tinha avaliação prévia
        setLikeLoaded(true);
      } else {
        setLikeLoaded(true); // Marca como carregado mesmo sem userProfile
      }
    } catch (error) {
      console.error('Error loading community playlist data:', error);
      setLikeLoaded(true);
    }
  };

  const handleLike = async () => {
    if (!state?.communityPlaylistId || !userProfile) return;

    // Verificar se é usuário guest
    if (userProfile.isGuest) {
      audioManager.play('menuBack');
      alert(t('playlists.guestCantLike'));
      return;
    }

    try {
      await likePlaylist(state.communityPlaylistId, userProfile.uid, 'like');
      
      // Atualizar estado local
      setUserLike(prev => prev === 'like' ? undefined : 'like');
      
      // Recarregar dados da playlist para atualizar contadores
      await loadCommunityPlaylistData();
    } catch (error: any) {
      console.error('Error liking playlist:', error);
      audioManager.play('menuBack');
      alert(error.message || t('playlists.likeError'));
    }
  };

  const handleDislike = async () => {
    if (!state?.communityPlaylistId || !userProfile) return;

    // Verificar se é usuário guest
    if (userProfile.isGuest) {
      audioManager.play('menuBack');
      alert(t('playlists.guestCantLike'));
      return;
    }

    try {
      await likePlaylist(state.communityPlaylistId, userProfile.uid, 'dislike');
      
      // Atualizar estado local
      setUserLike(prev => prev === 'dislike' ? undefined : 'dislike');
      
      // Recarregar dados da playlist para atualizar contadores
      await loadCommunityPlaylistData();
    } catch (error: any) {
      console.error('Error disliking playlist:', error);
      audioManager.play('menuBack');
      alert(error.message || t('playlists.dislikeError'));
    }
  };

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
        setShowExitConfirm(prev => !prev);
      } else {
        // Treino livre, mostra confirmação de saída
        setShowExitConfirm(prev => !prev);
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
        window.initPlaylistCanvas(state.playlist, state.communityPlaylistId);
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
      trackFreePlayEnd(detail.winner, detail.score.red, detail.score.blue);
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
      window.initPlaylistCanvas(state.playlist, state.communityPlaylistId);
    }
  };

  const handleCloseResult = () => {
    setShowResultModal(false);
    setPlaylistResult(null);
  };

  const handleBackToMenu = () => {
    navigate('/modes');
  };

  const handleOpenSettings = () => {
    navigate('/settings');
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    const isPlaylist = state?.mode === 'playlist';
    navigate(isPlaylist ? '/playlists' : '/modes');
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

      {/* HUD para modo Playlist - Info (topo) */}
      <div id="playlist-hud" className="hidden">
        <div className="hud-left">
          <div className="playlist-hud-name" id="playlist-name">Playlist</div>
        </div>
        <div className="hud-center">
          <div className="playlist-hud-timer">
            <span id="scenario-timer">30.0</span>
          </div>
        </div>
        <div className="hud-right">
          <div className="playlist-hud-scenario" id="scenario-name">Cenário</div>
          <div className="hud-divider"></div>
          <div className="playlist-hud-progress">
            <span id="scenario-progress">1/5</span> cenários
          </div>
        </div>
      </div>

      {/* HUD para modo Playlist - Controles (baixo) */}
      <div id="playlist-hud-bottom" className="hidden">
        <div className="playlist-hud-controls">
          <kbd>R</kbd> Resetar
          <span className="hud-ctrl-sep">│</span>
          <kbd>N</kbd> Próximo
          <span className="hud-ctrl-sep">│</span>
          <kbd>P</kbd> Anterior
          <span className="hud-ctrl-sep">│</span>
          <kbd>⌫</kbd> Restart
          <span className="hud-ctrl-sep">│</span>
          <kbd>ESC</kbd> Sair
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
              <span>Pressione <kbd>ESC</kbd> {t('game.toExit')}</span>
            </div>
            <button onClick={handleOpenSettings}>
              <i className="fas fa-cog"></i> {t('game.settings')}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmação de saída */}
      <ExitConfirmModal
        isOpen={showExitConfirm}
        isPlaylist={state?.mode === 'playlist'}
        onConfirm={handleConfirmExit}
        onCancel={() => setShowExitConfirm(false)}
      />

      {/* Modal de resultado de playlist */}
      {playlistResult && (
        <PlaylistResultModal
          isOpen={showResultModal}
          playlistName={playlistResult.playlistName}
          time={playlistResult.time}
          score={playlistResult.score}
          previousHighscore={playlistResult.previousHighscore}
          isOfficial={playlistResult.isOfficial}
          playlistData={playlistResult.playlistData}
          communityPlaylistId={playlistResult.communityPlaylistId}
          communityPlaylist={communityPlaylist}
          userLike={userLike}
          hadPreviousLike={hadPreviousLike}
          likeLoaded={likeLoaded}
          onLike={handleLike}
          onDislike={handleDislike}
          onRetry={handleRetryPlaylist}
          onClose={handleCloseResult}
        />
      )}
    </div>
  );
}

export default GamePage;
