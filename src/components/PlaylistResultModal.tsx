import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTopScores, RankingEntry } from '../firebase';
import { getNickname } from '../player';
import { Playlist } from '../types';


interface PlaylistResultModalProps {
  isOpen: boolean;
  playlistName: string;
  kicks: number;
  time: number;
  score: number;
  previousHighscore: RankingEntry | null;
  isOfficial: boolean;
  playlistData: Playlist | null;
  onRetry: () => void;
  onClose: () => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, '0')}`;
};

function PlaylistResultModal({
  isOpen,
  playlistName,
  kicks,
  time,
  score,
  previousHighscore,
  isOfficial,
  playlistData,
  onRetry,
  onClose,
}: PlaylistResultModalProps) {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const nickname = getNickname();

  useEffect(() => {
    if (isOpen && isOfficial) {
      loadRankings();
    }
  }, [isOpen, playlistName, isOfficial]);

  const loadRankings = async () => {
    setLoading(true);
    try {
      const data = await getTopScores(playlistName, 10);
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

  const handleClose = () => {
    onClose();
    navigate('/playlists');
  };

  if (!isOpen) return null;

  const highscoreValue = previousHighscore ? previousHighscore.score : 0;
  const isNewRecord = score > highscoreValue;

  return (
    <div className="modal-overlay result-modal-overlay" onClick={handleClose}>
      <div
        className="modal-content result-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title gradient-text">
          <i className="fas fa-trophy"></i> Playlist Completa!
        </h2>

        {/* Seu Score */}
        <div className="result-score-card">
          <h3>
            <i className="fas fa-chart-bar"></i> Seu Resultado
          </h3>
          <div className="result-stats">
            <div className="stat">
              <div className="stat-label">Chutes</div>
              <div className="stat-value">{kicks}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Tempo</div>
              <div className="stat-value">{formatTime(time)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Score</div>
              <div className="stat-value highlight">{score.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Highscore Pessoal */}
        {isOfficial && (
          <div className="result-highscore-card">
            <h3>
              <i className="fas fa-star"></i> Seu Highscore
            </h3>
            <div className="highscore-content">
              <div>
                <span className="highscore-label">Melhor pontuação:</span>
                <span className="highscore-value">
                  {isNewRecord ? score.toLocaleString() : highscoreValue.toLocaleString()}
                </span>
              </div>
              {isNewRecord && (
                <div className="new-record-badge">
                  <i className="fas fa-fire"></i> NOVO RECORDE!
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
                <i className="fas fa-trophy"></i> Top 10 - {playlistName}
              </h3>
              {loading ? (
                <div className="ranking-loading">Carregando ranking...</div>
              ) : (
                <table className="result-ranking-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Jogador</th>
                      <th>Chutes</th>
                      <th>Tempo</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="no-rankings">
                          Nenhum ranking ainda. Seja o primeiro!
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
                            <td className="center">{entry.kicks}</td>
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
                Esta é uma playlist customizada.
              </div>
              <div className="custom-playlist-subtext">
                Rankings são salvos apenas para playlists oficiais.
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={handleRetry}>
            <i className="fas fa-redo"></i> Tentar Novamente
          </button>
          <button className="btn-secondary" onClick={handleClose}>
            <i className="fas fa-list"></i> Voltar às Playlists
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlaylistResultModal;
