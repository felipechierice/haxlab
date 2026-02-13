import { useState, useEffect } from 'react';
import { getTopScores, getGlobalRanking, RankingEntry } from '../firebase';


interface RankingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, '0')}`;
};

function RankingModal({ isOpen, onClose }: RankingModalProps) {
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('');
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const playlists = [
    { name: 'TORNEIO A.D. BRK - Edição 1', value: 'TORNEIO A.D. BRK - Edição 1' },
    { name: 'Cruzamento - Fácil', value: 'Cruzamento - Fácil' },
    { name: 'Drible e Gol', value: 'Drible e Gol' },
    { name: 'Condução - Fácil', value: 'Condução - Fácil' },
    { name: 'Finalizações', value: 'Finalizações' },
  ];

  useEffect(() => {
    if (isOpen) {
      loadRankings();
    }
  }, [isOpen, selectedPlaylist]);

  const loadRankings = async () => {
    setLoading(true);
    try {
      let data: RankingEntry[];
      if (selectedPlaylist) {
        data = await getTopScores(selectedPlaylist, 50);
      } else {
        data = await getGlobalRanking(50);
      }
      setRankings(data);
    } catch (error) {
      console.error('Error loading rankings:', error);
      setRankings([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ranking-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title gradient-text">
          <i className="fas fa-trophy"></i> Ranking
        </h2>

        <div className="ranking-filter">
          <label>Playlist:</label>
          <select
            value={selectedPlaylist}
            onChange={(e) => setSelectedPlaylist(e.target.value)}
          >
            <option value="">Global (All Playlists)</option>
            {playlists.map((playlist) => (
              <option key={playlist.value} value={playlist.value}>
                {playlist.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ranking-list">
          {loading ? (
            <div className="ranking-loading">
              <div>Loading...</div>
            </div>
          ) : (
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nickname</th>
                  <th>Playlist</th>
                  <th>Chutes</th>
                  <th>Tempo</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {rankings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="no-rankings">
                      No rankings yet
                    </td>
                  </tr>
                ) : (
                  rankings.map((entry, index) => (
                    <tr key={`${entry.nickname}-${index}`}>
                      <td className={`rank ${index < 3 ? 'top-rank' : ''}`}>
                        {index + 1}
                      </td>
                      <td className="nickname">{entry.nickname}</td>
                      <td className="playlist-name">{entry.playlistName}</td>
                      <td className="center">{entry.kicks}</td>
                      <td className="center">{formatTime(entry.time)}</td>
                      <td className="score">{entry.score.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default RankingModal;
