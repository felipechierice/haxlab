import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTopScores, RankingEntry } from '../firebase';
import { getNickname } from '../player';
import { Playlist } from '../types';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';


interface PlaylistResultModalProps {
  isOpen: boolean;
  playlistName: string;
  time: number;
  score: number;
  previousHighscore: RankingEntry | null;
  isOfficial: boolean;
  playlistData: Playlist | null;
  communityPlaylistId?: string;
  onRetry: () => void;
  onClose: () => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
};

function PlaylistResultModal({
  isOpen,
  playlistName,
  time,
  score,
  previousHighscore,
  isOfficial,
  playlistData,
  communityPlaylistId,
  onRetry,
  onClose,
}: PlaylistResultModalProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const nickname = getNickname();

  const handleClose = () => {
    onClose();
    navigate('/playlists');
  };

  const { containerRef } = useKeyboardNav({
    onEscape: handleClose,
    autoFocus: isOpen,
    enabled: isOpen
  });

  useEffect(() => {
    if (isOpen && isOfficial) {
      loadRankings();
    }
  }, [isOpen, playlistName, isOfficial, communityPlaylistId]);

  const loadRankings = async () => {
    setLoading(true);
    try {
      let data: RankingEntry[];
      
      // Se for playlist da comunidade, buscar ranking da comunidade
      if (communityPlaylistId) {
        const { getCommunityPlaylistRanking } = await import('../firebase.js');
        data = await getCommunityPlaylistRanking(communityPlaylistId, 10);
      } else {
        data = await getTopScores(playlistName, 10);
      }
      
      setRankings(data);
    } catch (error) {
      console.error('Error loading rankings:', error);
      setRankings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    onRetry();
  };

  if (!isOpen) return null;

  const highscoreValue = previousHighscore ? previousHighscore.score : 0;
  const isNewRecord = score > highscoreValue;

  return (
    <div className="modal-overlay result-modal-overlay" onClick={handleClose}>
      <div
        className="modal-content result-modal-content"
        onClick={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        <h2 className="modal-title gradient-text">
          <i className="fas fa-trophy"></i> {t('result.title')}
        </h2>

        {/* Seu Score */}
        <div className="result-score-card">
          <h3>
            <i className="fas fa-chart-bar"></i> {t('result.yourResult')}
          </h3>
          <div className="result-stats">
            <div className="stat">
              <div className="stat-label">{t('result.time')}</div>
              <div className="stat-value">{formatTime(time)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">{t('result.score')}</div>
              <div className="stat-value highlight">{score.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Highscore Pessoal */}
        {isOfficial && (
          <div className="result-highscore-card">
            <h3>
              <i className="fas fa-star"></i> {t('result.yourHighscore')}
            </h3>
            <div className="highscore-content">
              <div>
                <span className="highscore-label">{t('result.bestScore')}</span>
                <span className="highscore-value">
                  {isNewRecord ? score.toLocaleString() : highscoreValue.toLocaleString()}
                </span>
              </div>
              {isNewRecord && (
                <div className="new-record-badge">
                  <i className="fas fa-fire"></i> {t('result.newRecord')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top 10 ou Custom Playlist Message */}
        <div className="result-ranking-card">
          {isOfficial ? (
            <>
              <h3>
                <i className="fas fa-trophy"></i> {t('result.top10')} - {playlistName}
              </h3>
              {loading ? (
                <div className="ranking-loading">{t('result.loadingRanking')}</div>
              ) : (
                <table className="result-ranking-table">
                  <thead>
                    <tr>
                      <th>{t('result.rank')}</th>
                      <th>{t('result.player')}</th>
                      <th>{t('result.time')}</th>
                      <th>{t('result.score')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="no-rankings">
                          {t('result.noRankings')}
                        </td>
                      </tr>
                    ) : (
                      rankings.map((entry, index) => {
                        const isCurrentPlayer = entry.nickname === nickname;
                        let rankDisplay: React.ReactNode = (index + 1).toString();

                        if (index === 0) {
                          rankDisplay = <i className="fas fa-medal gold-medal"></i>;
                        } else if (index === 1) {
                          rankDisplay = <i className="fas fa-medal silver-medal"></i>;
                        } else if (index === 2) {
                          rankDisplay = <i className="fas fa-medal bronze-medal"></i>;
                        }

                        return (
                          <tr
                            key={`${entry.nickname}-${index}`}
                            className={isCurrentPlayer ? 'current-player' : ''}
                          >
                            <td className="rank">{rankDisplay}</td>
                            <td className="nickname">{entry.nickname}</td>
                            <td className="center">{formatTime(entry.time)}</td>
                            <td className="score">{entry.score.toLocaleString()}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <div className="custom-playlist-message">
              <div className="custom-playlist-icon">
                <i className="fas fa-clipboard-list"></i>
              </div>
              <div className="custom-playlist-text">
                {t('result.customPlaylist')}
              </div>
              <div className="custom-playlist-subtext">
                {t('result.customPlaylistNote')}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={handleRetry}>
            <i className="fas fa-redo"></i> {t('result.tryAgain')}
          </button>
          <button className="btn-secondary" onClick={handleClose}>
            <i className="fas fa-list"></i> {t('result.backToPlaylists')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlaylistResultModal;
