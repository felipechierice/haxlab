import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTopScores, RankingEntry } from '../firebase';
import { getNickname } from '../player';
import { Playlist } from '../types';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import { CommunityPlaylist } from '../community-playlists';

interface PlaylistResultModalProps {
  isOpen: boolean;
  playlistName: string;
  time: number;
  score: number;
  previousHighscore: RankingEntry | null;
  isOfficial: boolean;
  playlistData: Playlist | null;
  communityPlaylistId?: string;
  communityPlaylist?: CommunityPlaylist | null;
  userLike?: 'like' | 'dislike';
  hadPreviousLike?: boolean; // Se o usuário já tinha like/dislike no Firebase antes de abrir o modal
  likeLoaded?: boolean; // Se o like já foi carregado do Firebase
  onLike?: () => void;
  onDislike?: () => void;
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
  communityPlaylist,
  userLike,
  hadPreviousLike,
  likeLoaded,
  onLike,
  onDislike,
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
    autoFocus: false, // Não auto-foca em nada no modal de resultado
    enabled: isOpen
  });

  useEffect(() => {
    if (isOpen && (isOfficial || communityPlaylistId)) {
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

  // Calcular posição do jogador no ranking
  // Se for novo recorde, calcular a posição estimada com base no novo score
  let playerRankPosition = 0;
  if (isNewRecord) {
    // Encontrar onde o novo score se encaixaria no ranking
    const newPosition = rankings.findIndex(entry => score > entry.score);
    if (newPosition === -1) {
      // Score é menor que todos no top 10, ou ranking está vazio
      playerRankPosition = rankings.length > 0 ? rankings.length + 1 : 1;
    } else {
      playerRankPosition = newPosition + 1;
    }
  } else {
    // Usar a posição existente do jogador no ranking
    playerRankPosition = rankings.findIndex(entry => entry.nickname === nickname) + 1;
  }
  const hasRankPosition = playerRankPosition > 0;

  return (
    <div className="modal-overlay result-modal-overlay" onClick={handleClose}>
      <div
        className="modal-content result-modal-content"
        onClick={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        {/* Header */}
        <div className="result-trophy-header">
          <h2 className="result-title">{t('result.title')}</h2>
        </div>

        {/* Playlist Info Card */}
        <div className="result-playlist-card">
          <div className="result-playlist-info-row">
            <div className="result-playlist-name">
              <i className="fas fa-list-ul"></i>
              <span>{playlistName}</span>
            </div>
            {isOfficial ? (
              <span className="playlist-badge official">
                <i className="fas fa-shield-alt"></i> {t('result.official')}
              </span>
            ) : (
              <span className="playlist-badge community">
                <i className="fas fa-users"></i> {t('result.community')}
              </span>
            )}
            {!isOfficial && communityPlaylist && (
              <span className="result-playlist-author">
                <i className="fas fa-user"></i> {communityPlaylist.authorNickname}
              </span>
            )}
          </div>
        </div>

        {/* Score Display Principal */}
        <div className="result-score-display">
          <div className="result-main-stats">
            <div className="result-stat-box time">
              <span className="result-stat-label">{t('result.time')}</span>
              <span className="result-stat-value">{formatTime(time)}</span>
            </div>
            <div className="result-stat-divider"></div>
            <div className="result-stat-box score">
              <span className="result-stat-label">{t('result.score')}</span>
              <span className="result-stat-value golden">{score.toLocaleString()}</span>
            </div>
          </div>

          {/* Highscore Section */}
          {(isOfficial || communityPlaylistId) && (
            <div className={`result-highscore-box ${isNewRecord ? 'new-record' : ''}`}>
              <div className="highscore-content">
                <div className="highscore-icon-wrapper">
                  <i className="fas fa-star"></i>
                </div>
                <div className="highscore-data">
                  <span className="highscore-label">{t('result.bestScore')}</span>
                  <div className="highscore-values">
                    <span className="highscore-score">
                      {isNewRecord ? score.toLocaleString() : highscoreValue.toLocaleString()}
                    </span>
                    <span className="highscore-time">
                      <i className="fas fa-clock"></i>
                      {isNewRecord ? formatTime(time) : (previousHighscore ? formatTime(previousHighscore.time) : '—')}
                    </span>
                    {hasRankPosition && (
                      <span className="highscore-rank">
                        <i className="fas fa-ranking-star"></i>
                        #{playerRankPosition}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {isNewRecord && (
                <div className="new-record-badge">
                  <i className="fas fa-fire"></i>
                  <span>{t('result.newRecord')}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Like/Dislike ANTES do ranking - se não tinha avaliação prévia no Firebase */}
        {communityPlaylistId && communityPlaylist && onLike && onDislike && !hadPreviousLike && (
          <div className="result-rating-section">
            <div className="result-rating-header">
              <i className="fas fa-heart"></i>
              <span>{t('result.ratePlaylist')}</span>
            </div>
            <div className="result-rating-buttons">
              <button 
                className={`result-rate-btn like ${userLike === 'like' ? 'active' : ''}`}
                onClick={onLike}
              >
                <i className="fas fa-heart"></i>
                <span>{t('result.like')}</span>
                <span className="rate-count">({communityPlaylist.likes})</span>
              </button>
              <button 
                className={`result-rate-btn dislike ${userLike === 'dislike' ? 'active' : ''}`}
                onClick={onDislike}
              >
                <i className="fas fa-heart-broken"></i>
                <span>{t('result.dislike')}</span>
                <span className="rate-count">({communityPlaylist.dislikes})</span>
              </button>
            </div>
          </div>
        )}

        {/* Ranking Section */}
        <div className="result-ranking-section">
          {isOfficial || communityPlaylistId ? (
            <>
              <div className="result-ranking-header">
                <i className="fas fa-trophy"></i>
                <span>{t('result.top10')}</span>
              </div>
              <div className="result-ranking-content">
                {loading ? (
                  <div className="result-ranking-loading">
                    <div className="loading-spinner"></div>
                    <span>{t('result.loadingRanking')}</span>
                  </div>
                ) : rankings.length === 0 ? (
                  <div className="result-ranking-empty">
                    <i className="fas fa-medal"></i>
                    <span>{t('result.noRankings')}</span>
                  </div>
                ) : (
                  <div className="result-ranking-list">
                    {rankings.map((entry, index) => {
                      const isCurrentPlayer = entry.nickname === nickname;
                      return (
                        <div
                          key={`${entry.nickname}-${index}`}
                          className={`result-ranking-item ${isCurrentPlayer ? 'current' : ''} ${index < 3 ? `top-${index + 1}` : ''}`}
                        >
                          <div className="ranking-position">
                            {index === 0 && <i className="fas fa-crown gold"></i>}
                            {index === 1 && <i className="fas fa-medal silver"></i>}
                            {index === 2 && <i className="fas fa-medal bronze"></i>}
                            {index > 2 && <span className="ranking-number">{index + 1}</span>}
                          </div>
                          <div className="ranking-player">{entry.nickname}</div>
                          <div className="ranking-stats">
                            <span className="ranking-time">{formatTime(entry.time)}</span>
                            <span className="ranking-score">{entry.score.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="result-custom-message">
              <div className="custom-message-icon">
                <i className="fas fa-clipboard-list"></i>
              </div>
              <div className="custom-message-text">{t('result.customPlaylist')}</div>
              <div className="custom-message-subtext">{t('result.customPlaylistNote')}</div>
            </div>
          )}
        </div>

        {/* Like/Dislike DEPOIS do ranking - se já tinha avaliação prévia no Firebase */}
        {communityPlaylistId && communityPlaylist && onLike && onDislike && hadPreviousLike && (
          <div className="result-rating-section">
            <div className="result-rating-header">
              <i className="fas fa-heart"></i>
              <span>{t('result.ratePlaylist')}</span>
            </div>
            <div className="result-rating-buttons">
              <button 
                className={`result-rate-btn like ${userLike === 'like' ? 'active' : ''}`}
                onClick={onLike}
              >
                <i className="fas fa-heart"></i>
                <span>{t('result.like')}</span>
                <span className="rate-count">({communityPlaylist.likes})</span>
              </button>
              <button 
                className={`result-rate-btn dislike ${userLike === 'dislike' ? 'active' : ''}`}
                onClick={onDislike}
              >
                <i className="fas fa-heart-broken"></i>
                <span>{t('result.dislike')}</span>
                <span className="rate-count">({communityPlaylist.dislikes})</span>
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="result-actions">
          <button className="result-btn primary" onClick={handleRetry}>
            <i className="fas fa-redo"></i>
            <span>{t('result.tryAgain')}</span>
          </button>
          <button className="result-btn secondary" onClick={handleClose}>
            <i className="fas fa-list"></i>
            <span>{t('result.backToPlaylists')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlaylistResultModal;
