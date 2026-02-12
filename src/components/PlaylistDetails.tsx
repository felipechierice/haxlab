import { useState, useEffect, useRef } from 'react';
import { PlaylistInfo, PlaylistStats, PlayerHighscore, RankingEntry } from '../types/playlist-ui';
import { Playlist } from '../types';

interface PlaylistDetailsProps {
  playlist: PlaylistInfo | null;
  playlistData: Playlist | null;
  onStartPlaylist: () => void;
}

function PlaylistDetails({ playlist, playlistData, onStartPlaylist }: PlaylistDetailsProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'ranking'>('info');
  const [stats, setStats] = useState<PlaylistStats | null>(null);
  const [playerHighscore, setPlayerHighscore] = useState<PlayerHighscore | null>(null);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);
  const rankingListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playlist || !playlistData) {
      setStats(null);
      setPlayerHighscore(null);
      setRankings([]);
      return;
    }

    loadStats();
    loadPlayerHighscore();
    loadRankings();
  }, [playlist, playlistData]);

  const loadStats = async () => {
    if (!playlist || !playlistData) return;

    try {
      const { getTopScores } = await import('../firebase.js');
      const scores = await getTopScores(playlist.name, 100);
      
      if (scores.length > 0) {
        const avgTime = scores.reduce((sum, s) => sum + s.time, 0) / scores.length;
        const avgKicks = scores.reduce((sum, s) => sum + s.kicks, 0) / scores.length;
        
        setStats({
          scenariosCount: playlistData.scenarios.length,
          avgTime: `${avgTime.toFixed(1)}s`,
          avgKicks: `${avgKicks.toFixed(1)} chutes`
        });
      } else {
        const totalTime = playlistData.scenarios.reduce((sum, s) => sum + (s.timeLimit || 0), 0);
        setStats({
          scenariosCount: playlistData.scenarios.length,
          avgTime: `~${Math.ceil(totalTime)}s (estimado)`,
          avgKicks: 'N/A'
        });
      }
    } catch (error) {
      console.error('Error loading playlist stats:', error);
      const totalTime = playlistData.scenarios.reduce((sum, s) => sum + (s.timeLimit || 0), 0);
      setStats({
        scenariosCount: playlistData.scenarios.length,
        avgTime: `~${Math.ceil(totalTime)}s (estimado)`,
        avgKicks: 'N/A'
      });
    }
  };

  const loadPlayerHighscore = async () => {
    if (!playlist) return;

    try {
      const { getNickname } = await import('../player.js');
      const { getPlayerHighscore, getTopScores } = await import('../firebase.js');
      
      const nickname = getNickname();
      const highscore = await getPlayerHighscore(nickname, playlist.name);
      
      if (highscore) {
        const allScores = await getTopScores(playlist.name, 1000);
        const playerRank = allScores.findIndex(s => s.nickname === nickname) + 1;
        
        setPlayerHighscore({
          score: highscore.score,
          rank: playerRank > 0 ? `#${playerRank}` : 'N/A',
          kicks: highscore.kicks,
          time: highscore.time
        });
      } else {
        setPlayerHighscore(null);
      }
    } catch (error) {
      console.error('Error loading player highscore:', error);
      setPlayerHighscore(null);
    }
  };

  const loadRankings = async () => {
    if (!playlist || isLoadingRanking) return;

    setIsLoadingRanking(true);
    
    try {
      const { getTopScores } = await import('../firebase.js');
      const scores = await getTopScores(playlist.name, 20);
      setRankings(scores);
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

  if (!playlist || !playlistData) {
    return (
      <div className="playlist-details">
        <div className="playlist-empty">
          <div className="empty-icon">
            <i className="fas fa-clipboard-list" style={{ fontSize: '48px' }}></i>
          </div>
          <p>Selecione uma playlist para ver detalhes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="playlist-details">
      {/* Header */}
      <div className="playlist-header">
        <h3>
          <i className={`fas ${playlist.icon}`}></i> {playlist.name}
        </h3>
        <button className="btn-primary" onClick={onStartPlaylist}>
          <i className="fas fa-play"></i> Iniciar Playlist
        </button>
      </div>

      {/* Tabs */}
      <div className="playlist-tabs">
        <button 
          className={`tab-button ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          <i className="fas fa-info-circle"></i> Informações
        </button>
        <button 
          className={`tab-button ${activeTab === 'ranking' ? 'active' : ''}`}
          onClick={() => setActiveTab('ranking')}
        >
          <i className="fas fa-trophy"></i> Ranking
        </button>
      </div>

      {/* Tab: Informações */}
      {activeTab === 'info' && (
        <div className="tab-content active">
          <div className="info-section">
            <div className="info-item">
              <span className="info-label">
                <i className="fas fa-align-left"></i> Descrição:
              </span>
              <p>{playlistData.description || 'Sem descrição disponível'}</p>
            </div>
            {stats && (
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">
                    <i className="fas fa-map-marked-alt"></i> Cenários:
                  </span>
                  <span className="info-value">{stats.scenariosCount} cenários</span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <i className="fas fa-stopwatch"></i> Tempo médio:
                  </span>
                  <span className="info-value">{stats.avgTime}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">
                    <i className="fas fa-shoe-prints"></i> Média de chutes:
                  </span>
                  <span className="info-value">{stats.avgKicks}</span>
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
                <i className="fas fa-medal"></i> Seu Melhor Score
              </div>
              <div className="highscore-content">
                <div className="highscore-item">
                  <span>Pontuação:</span>
                  <span className="highscore-value">{playerHighscore.score.toLocaleString()}</span>
                </div>
                <div className="highscore-item">
                  <span>Posição:</span>
                  <span className="highscore-value">{playerHighscore.rank}</span>
                </div>
                <div className="highscore-item">
                  <span>Chutes:</span>
                  <span className="highscore-value">{playerHighscore.kicks}</span>
                </div>
                <div className="highscore-item">
                  <span>Tempo:</span>
                  <span className="highscore-value">{formatTime(playerHighscore.time)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="ranking-header">
            <h4><i className="fas fa-trophy"></i> Top Players</h4>
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
                    <strong>{entry.score.toLocaleString()}</strong> pts
                  </div>
                  <div className="ranking-stat">{entry.kicks} chutes</div>
                  <div className="ranking-stat">{formatTime(entry.time)}</div>
                </div>
              );
            })}
          </div>

          {isLoadingRanking && (
            <div className="ranking-loading">
              Carregando...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlaylistDetails;
