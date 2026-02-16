import { useState, useEffect, useRef } from 'react';
import { PlaylistInfo, PlaylistStats, PlayerHighscore, RankingEntry } from '../types/playlist-ui';
import { Playlist } from '../types';
import { CommunityPlaylist } from '../community-playlists';
import { useI18n } from '../hooks/useI18n';
import { useAuth } from '../contexts/AuthContext';

interface PlaylistDetailsProps {
  playlist: PlaylistInfo | null;
  communityPlaylist?: CommunityPlaylist | null;
  playlistData: Playlist | null;
  onStartPlaylist: () => void;
  onLike?: () => void;
  onDislike?: () => void;
  userLike?: 'like' | 'dislike';
  onDelete?: () => void;
}

function PlaylistDetails({ 
  playlist, 
  communityPlaylist,
  playlistData, 
  onStartPlaylist,
  onLike,
  onDislike,
  userLike,
  onDelete
}: PlaylistDetailsProps) {
  const { t } = useI18n();
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'info' | 'ranking'>('info');
  const [stats, setStats] = useState<PlaylistStats | null>(null);
  const [playerHighscore, setPlayerHighscore] = useState<PlayerHighscore | null>(null);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const rankingListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((!playlist && !communityPlaylist) || !playlistData) {
      setStats(null);
      setPlayerHighscore(null);
      setRankings([]);
      return;
    }

    loadStats();
    loadPlayerHighscore();
    loadRankings();
  }, [playlist, communityPlaylist, playlistData]);

  const loadStats = async () => {
    if ((!playlist && !communityPlaylist) || !playlistData) return;

    try {
      const playlistName = playlist?.name || communityPlaylist?.name || '';
      
      if (communityPlaylist) {
        // Para playlists da comunidade, buscar estatísticas do ranking
        const { getCommunityPlaylistRanking } = await import('../firebase.js');
        const scores = await getCommunityPlaylistRanking(communityPlaylist.id, 100);
        
        if (scores.length > 0) {
          const avgTime = scores.reduce((sum, s) => sum + s.time, 0) / scores.length;
          
          setStats({
            scenariosCount: playlistData.scenarios.length,
            avgTime: `${avgTime.toFixed(1)}s`
          });
        } else {
          // Sem dados ainda
          setStats({
            scenariosCount: playlistData.scenarios.length,
            avgTime: 'N/A'
          });
        }
      } else {
        // Para playlists oficiais, carregar estatísticas do Firebase
        const { getTopScores } = await import('../firebase.js');
        const scores = await getTopScores(playlistName, 100);
        
        if (scores.length > 0) {
          const avgTime = scores.reduce((sum, s) => sum + s.time, 0) / scores.length;
          
          setStats({
            scenariosCount: playlistData.scenarios.length,
            avgTime: `${avgTime.toFixed(1)}s`
          });
        } else {
          const totalTime = playlistData.scenarios.reduce((sum, s) => sum + (s.timeLimit || 0), 0);
          setStats({
            scenariosCount: playlistData.scenarios.length,
            avgTime: `~${Math.ceil(totalTime)}s (estimado)`
          });
        }
      }
    } catch (error) {
      console.error('Error loading playlist stats:', error);
      const totalTime = playlistData.scenarios.reduce((sum, s) => sum + (s.timeLimit || 0), 0);
      setStats({
        scenariosCount: playlistData.scenarios.length,
        avgTime: `~${Math.ceil(totalTime)}s (estimado)`
      });
    }
  };

  const loadPlayerHighscore = async () => {
    if (!playlist && !communityPlaylist) return;

    try {
      const { getNickname } = await import('../player.js');
      const nickname = getNickname();
      
      if (communityPlaylist) {
        // Para playlists da comunidade
        const { getPlayerCommunityPlaylistHighscore, getCommunityPlaylistRanking } = await import('../firebase.js');
        const highscore = await getPlayerCommunityPlaylistHighscore(nickname, communityPlaylist.id);
        
        if (highscore) {
          const allScores = await getCommunityPlaylistRanking(communityPlaylist.id, 1000);
          const playerRank = allScores.findIndex(s => s.nickname === nickname) + 1;
          
          setPlayerHighscore({
            score: highscore.score,
            rank: playerRank > 0 ? `#${playerRank}` : 'N/A',
            time: highscore.time
          });
        } else {
          setPlayerHighscore(null);
        }
      } else if (playlist) {
        // Para playlists oficiais
        const { getPlayerHighscore, getTopScores } = await import('../firebase.js');
        const highscore = await getPlayerHighscore(nickname, playlist.name);
        
        if (highscore) {
          const allScores = await getTopScores(playlist.name, 1000);
          const playerRank = allScores.findIndex(s => s.nickname === nickname) + 1;
          
          setPlayerHighscore({
            score: highscore.score,
            rank: playerRank > 0 ? `#${playerRank}` : 'N/A',
            time: highscore.time
          });
        } else {
          setPlayerHighscore(null);
        }
      }
    } catch (error) {
      console.error('Error loading player highscore:', error);
      setPlayerHighscore(null);
    }
  };

  const loadRankings = async () => {
    if ((!playlist && !communityPlaylist) || isLoadingRanking) return;

    setIsLoadingRanking(true);
    
    try {
      if (communityPlaylist) {
        const { getCommunityPlaylistRanking } = await import('../firebase.js');
        const scores = await getCommunityPlaylistRanking(communityPlaylist.id, 20);
        setRankings(scores);
      } else if (playlist) {
        const { getTopScores } = await import('../firebase.js');
        const scores = await getTopScores(playlist.name, 20);
        setRankings(scores);
      }
    } catch (error) {
      console.error('Error loading rankings:', error);
      setRankings([]);
    } finally {
      setIsLoadingRanking(false);
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const cs = Math.floor((time % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  };

  if ((!playlist && !communityPlaylist) || !playlistData) {
    return (
      <div className="playlist-details">
        <div className="playlist-empty">
          <div className="empty-icon">
            <i className="fas fa-clipboard-list" style={{ fontSize: '48px' }}></i>
          </div>
          <p>{t('playlists.selectPrompt')}</p>
        </div>
      </div>
    );
  }

  const displayName = playlist?.name || communityPlaylist?.name || '';
  const displayIcon = playlist?.icon || 'fa-list-ul';
  const displayDescription = playlistData.description || t('playlists.noDescription');

  return (
    <div className="playlist-details">
      {/* Header */}
      <div className="playlist-header">
        <div>
          <h3>
            <i className={`fas ${displayIcon}`}></i> {displayName}
          </h3>
          {communityPlaylist && (
            <div className="playlist-author">
              <i className="fas fa-user"></i> {t('playlists.author')} {communityPlaylist.authorNickname}
            </div>
          )}
        </div>
        <div className="header-actions">
          {communityPlaylist && onLike && onDislike && (
            <div className="playlist-actions">
              <button 
                className={`btn-like ${userLike === 'like' ? 'active' : ''}`}
                onClick={onLike}
              >
                <i className="fas fa-heart"></i> {communityPlaylist.likes}
              </button>
              <button 
                className={`btn-dislike ${userLike === 'dislike' ? 'active' : ''}`}
                onClick={onDislike}
              >
                <i className="fas fa-heart-broken"></i> {communityPlaylist.dislikes}
              </button>
            </div>
          )}
          {communityPlaylist && onDelete && userProfile && communityPlaylist.authorId === userProfile.uid && (
            <button className="btn-delete" onClick={onDelete} title={t('playlists.deletePlaylist')}>
              <i className="fas fa-trash"></i>
            </button>
          )}
          <button className="btn-primary" onClick={onStartPlaylist}>
            <i className="fas fa-play"></i> {t('playlists.startPlaylist')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="playlist-tabs">
        <button 
          className={`tab-button ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          <i className="fas fa-info-circle"></i> {t('playlists.info')}
        </button>
        <button 
          className={`tab-button ${activeTab === 'ranking' ? 'active' : ''}`}
          onClick={() => setActiveTab('ranking')}
        >
          <i className="fas fa-trophy"></i> {t('playlists.ranking')}
        </button>
      </div>

      {/* Tab: Informações */}
      {activeTab === 'info' && (
        <div className="tab-content active">
          <div className="info-section">
            <div className="info-item">
              <span className="info-label">
                <i className="fas fa-align-left"></i> {t('playlists.description')}
              </span>
              <p>{displayDescription}</p>
            </div>
            {stats && (
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">
                    <i className="fas fa-map-marked-alt"></i> {t('playlists.scenarios')}
                  </span>
                  <span className="info-value">{stats.scenariosCount} {t('playlists.scenariosCount')}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <i className="fas fa-stopwatch"></i> {t('playlists.avgTime')}
                  </span>
                  <span className="info-value">{stats.avgTime}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Ranking */}
      {activeTab === 'ranking' && (
        <div className="tab-content active">
          {playerHighscore && (
            <div className="player-highscore">
              <div className="highscore-header">
                <i className="fas fa-medal"></i> {t('playlists.yourBestScore')}
              </div>
              <div className="highscore-content">
                <div className="highscore-item">
                  <span>{t('playlists.score')}</span>
                  <span className="highscore-value">{playerHighscore.score.toLocaleString()}</span>
                </div>
                <div className="highscore-item">
                  <span>{t('playlists.position')}</span>
                  <span className="highscore-value">{playerHighscore.rank}</span>
                </div>
                <div className="highscore-item">
                  <span>{t('playlists.time')}</span>
                  <span className="highscore-value">{formatTime(playerHighscore.time)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="ranking-header">
            <h4><i className="fas fa-trophy"></i> {t('playlists.topPlayers')}</h4>
          </div>

          <div className="ranking-list" ref={rankingListRef}>
            {rankings.map((entry, index) => {
              const rank = index + 1;
              let rankClass = 'ranking-rank';
              if (rank === 1) rankClass += ' top-1';
              else if (rank === 2) rankClass += ' top-2';
              else if (rank === 3) rankClass += ' top-3';

              const medal = 
                rank === 1 ? <i className="fas fa-medal" style={{ color: '#ffd700' }}></i> :
                rank === 2 ? <i className="fas fa-medal" style={{ color: '#c0c0c0' }}></i> :
                rank === 3 ? <i className="fas fa-medal" style={{ color: '#cd7f32' }}></i> : null;

              return (
                <div key={`${entry.nickname}-${index}`} className="ranking-entry">
                  <div className={rankClass}>
                    {medal} #{rank}
                  </div>
                  <div className="ranking-nickname">{entry.nickname}</div>
                  <div className="ranking-stat">
                    <strong>{entry.score.toLocaleString()}</strong> {t('playlists.pts')}
                  </div>
                  <div className="ranking-stat">{formatTime(entry.time)}</div>
                </div>
              );
            })}
          </div>

          {isLoadingRanking && (
            <div className="ranking-loading">
              {t('playlists.loading')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlaylistDetails;
