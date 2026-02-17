import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RankingEntry } from '../firebase';
import { getReplayById } from '../replay';
import { getCommunityPlaylist } from '../community-playlists';
import { ReplayData, Playlist } from '../types';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import '../styles/Modal.css';

// Carrega playlist oficial por nome
async function loadOfficialPlaylist(playlistName: string): Promise<Playlist | null> {
  try {
    // Tentar carregar do diretório de playlists
    const response = await fetch(`/playlists/${playlistName.toLowerCase().replace(/\s+/g, '-')}.json`);
    if (response.ok) {
      return await response.json();
    }
    
    // Tentar buscar da lista de playlists disponíveis
    const listResponse = await fetch('/playlists/index.json');
    if (listResponse.ok) {
      const playlists = await listResponse.json();
      const playlist = playlists.find((p: any) => p.name === playlistName);
      if (playlist) {
        return playlist;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error loading official playlist:', error);
    return null;
  }
}

interface ReplayViewerProps {
  isOpen?: boolean;
  onClose: () => void;
  rankingEntry?: RankingEntry | null;
  replayId?: string;
  isCommunityPlaylist?: boolean;
  playlistId?: string;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, '0')}`;
};

function ReplayViewer({
  isOpen = true,
  onClose,
  rankingEntry,
  replayId: directReplayId,
  isCommunityPlaylist = false,
  playlistId
}: ReplayViewerProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Use directReplayId if provided, otherwise use rankingEntry.replayId
  const replayId = directReplayId || rankingEntry?.replayId;

  const handleClose = useCallback(() => {
    // Parar replay se estiver rodando
    if (isPlaying) {
      (window as any).stopReplay?.();
    }
    setIsPlaying(false);
    setReplayData(null);
    setError(null);
    onClose();
  }, [isPlaying, onClose]);

  const { containerRef } = useKeyboardNav({
    onEscape: handleClose,
    autoFocus: isOpen,
    enabled: isOpen && !isPlaying
  });

  // Escutar evento de replay completo
  useEffect(() => {
    const handleReplayComplete = () => {
      setIsPlaying(false);
    };

    window.addEventListener('replay-complete', handleReplayComplete);
    return () => window.removeEventListener('replay-complete', handleReplayComplete);
  }, []);

  // Carregar dados do replay quando o modal abre
  useEffect(() => {
    if (isOpen && replayId) {
      loadReplayData();
    }
  }, [isOpen, replayId]);

  const loadReplayData = async () => {
    if (!replayId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getReplayById(replayId, isCommunityPlaylist);
      if (data) {
        setReplayData(data);
      } else {
        setError(t('replay.notFound'));
      }
    } catch (err) {
      console.error('Error loading replay:', err);
      setError(t('replay.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleStartReplay = async () => {
    if (!replayId || !replayData) return;

    setLoading(true);
    setError(null);

    try {
      // Carregar playlist
      let playlist: Playlist | null = null;

      if (isCommunityPlaylist && playlistId) {
        const communityPlaylist = await getCommunityPlaylist(playlistId);
        if (communityPlaylist) {
          playlist = {
            name: communityPlaylist.name,
            description: communityPlaylist.description,
            scenarios: communityPlaylist.scenarios,
            randomizeOrder: communityPlaylist.randomizeOrder
          };
        }
      } else {
        // Use playlistName from rankingEntry if available, or from replayData
        const playlistName = rankingEntry?.playlistName || replayData.playlistName;
        playlist = await loadOfficialPlaylist(playlistName);
      }

      if (!playlist) {
        setError(t('replay.playlistNotFound'));
        setLoading(false);
        return;
      }

      // Navegar para página de jogo
      navigate('/game');

      // Aguardar um pouco para a página carregar
      await new Promise(resolve => setTimeout(resolve, 100));

      // Iniciar replay
      const result = await (window as any).startReplay?.(
        replayId,
        playlist,
        isCommunityPlaylist,
        playlistId
      );

      if (result?.success) {
        setIsPlaying(true);
      } else {
        setError(result?.error || t('replay.startError'));
      }
    } catch (err) {
      console.error('Error starting replay:', err);
      setError(t('replay.startError'));
    } finally {
      setLoading(false);
    }
  };

  const handleStopReplay = () => {
    (window as any).stopReplay?.();
    setIsPlaying(false);
    navigate('/playlists');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content replay-modal-content"
        onClick={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        {/* Header */}
        <div className="replay-header">
          <h2 className="modal-title gradient-text">
            <i className="fas fa-play-circle"></i> {t('replay.title')}
          </h2>
          <button className="replay-close-btn" onClick={handleClose} title={t('replay.close')}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="replay-content">
          {loading ? (
            <div className="replay-loading">
              <div className="replay-loading-spinner"></div>
              <p>{t('replay.loading')}</p>
            </div>
          ) : error ? (
            <div className="replay-error">
              <i className="fas fa-exclamation-triangle"></i>
              <p>{error}</p>
              <button className="replay-retry-btn" onClick={loadReplayData}>
                <i className="fas fa-redo"></i> {t('replay.retry')}
              </button>
            </div>
          ) : replayData ? (
            <div className="replay-info">
              {/* Player Info */}
              <div className="replay-player-card">
                <div className="replay-player-avatar">
                  <i className="fas fa-user"></i>
                </div>
                <div className="replay-player-details">
                  <span className="replay-player-name">{replayData.playerNickname}</span>
                  <span className="replay-player-playlist">{replayData.playlistName}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="replay-stats">
                <div className="replay-stat">
                  <i className="fas fa-clock"></i>
                  <span className="replay-stat-label">{t('replay.time')}</span>
                  <span className="replay-stat-value">{formatTime(replayData.totalTime)}</span>
                </div>
                <div className="replay-stat">
                  <i className="fas fa-list-ol"></i>
                  <span className="replay-stat-label">{t('replay.scenarios')}</span>
                  <span className="replay-stat-value">{replayData.scenarios.length}</span>
                </div>
                <div className="replay-stat">
                  <i className="fas fa-keyboard"></i>
                  <span className="replay-stat-label">{t('replay.inputs')}</span>
                  <span className="replay-stat-value">{replayData.events.length}</span>
                </div>
              </div>

              {/* Record Date */}
              <div className="replay-recorded">
                <i className="fas fa-calendar"></i>
                <span>{t('replay.recordedAt')}: {new Date(replayData.recordedAt).toLocaleDateString()}</span>
              </div>

              {/* Actions */}
              <div className="replay-actions">
                {isPlaying ? (
                  <button className="replay-stop-btn" onClick={handleStopReplay}>
                    <i className="fas fa-stop"></i> {t('replay.stop')}
                  </button>
                ) : (
                  <button className="replay-play-btn" onClick={handleStartReplay}>
                    <i className="fas fa-play"></i> {t('replay.watch')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="replay-empty">
              <i className="fas fa-film"></i>
              <p>{t('replay.noData')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReplayViewer;
