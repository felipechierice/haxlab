import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getTopScores, getAllRankings, RankingEntry } from '../firebase';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';

interface RankingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AggregatedPlayer {
  nickname: string;
  totalScore: number;
  totalKicks: number;
  totalTime: number;
  entries: number;
}

const PAGE_SIZE = 10;

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, '0')}`;
};

const getMedalEmoji = (index: number): string => {
  if (index === 0) return '👑';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return '';
};

const getMedalClass = (index: number): string => {
  if (index === 0) return 'gold';
  if (index === 1) return 'silver';
  if (index === 2) return 'bronze';
  return '';
};

function RankingModal({ isOpen, onClose }: RankingModalProps) {
  const { t } = useI18n();
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('');
  const [allRankings, setAllRankings] = useState<RankingEntry[]>([]);
  const [aggregatedPlayers, setAggregatedPlayers] = useState<AggregatedPlayer[]>([]);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { containerRef } = useKeyboardNav({
    onEscape: onClose,
    autoFocus: isOpen,
    enabled: isOpen
  });

  const playlists = [
    { name: 'TORNEIO A.D. BRK - Edição 1', value: 'TORNEIO A.D. BRK - Edição 1' },
    { name: 'Cruzamento - Fácil', value: 'Cruzamento - Fácil' },
    { name: 'Drible e Gol', value: 'Drible e Gol' },
    { name: 'Condução - Fácil', value: 'Condução - Fácil' },
    { name: 'Finalizações - Fácil', value: 'Finalizações - Fácil' },
  ];

  // Whether we show aggregated (summed by player) or individual entries
  const isAggregatedView = !selectedPlaylist;

  // Aggregate all players by total score
  const computeAggregatedPlayers = useCallback((data: RankingEntry[]): AggregatedPlayer[] => {
    const playerMap = new Map<string, AggregatedPlayer>();
    for (const entry of data) {
      const existing = playerMap.get(entry.nickname);
      if (existing) {
        existing.totalScore += entry.score;
        existing.totalKicks += entry.kicks;
        existing.totalTime += entry.time;
        existing.entries += 1;
      } else {
        playerMap.set(entry.nickname, {
          nickname: entry.nickname,
          totalScore: entry.score,
          totalKicks: entry.kicks,
          totalTime: entry.time,
          entries: 1,
        });
      }
    }
    return Array.from(playerMap.values())
      .sort((a, b) => b.totalScore - a.totalScore);
  }, []);

  // Top 3 for podium (always from aggregated)
  const topPlayers = useMemo(
    () => aggregatedPlayers.slice(0, 3),
    [aggregatedPlayers]
  );

  // Filtered data based on search — works on both views
  const filteredAggregated = useMemo(() => {
    if (!searchQuery.trim()) return aggregatedPlayers;
    const q = searchQuery.toLowerCase().trim();
    return aggregatedPlayers.filter((p) => p.nickname.toLowerCase().includes(q));
  }, [aggregatedPlayers, searchQuery]);

  const filteredRankings = useMemo(() => {
    if (!searchQuery.trim()) return allRankings;
    const q = searchQuery.toLowerCase().trim();
    return allRankings.filter((entry) =>
      entry.nickname.toLowerCase().includes(q)
    );
  }, [allRankings, searchQuery]);

  // Pick the right filtered list depending on view mode
  const filteredList = isAggregatedView ? filteredAggregated : filteredRankings;

  // Paginated slice
  const visibleCount = Math.min(displayCount, filteredList.length);
  const hasMore = displayCount < filteredList.length;

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setDisplayCount(PAGE_SIZE);
      loadRankings();
    }
  }, [isOpen, selectedPlaylist]);

  // Reset display count when search changes
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [searchQuery]);

  const loadRankings = async () => {
    setLoading(true);
    try {
      if (selectedPlaylist) {
        // Playlist-specific: show individual entries
        const data = await getTopScores(selectedPlaylist, 200);
        setAllRankings(data);
        setAggregatedPlayers(computeAggregatedPlayers(data));
      } else {
        // Global: fetch all and aggregate
        const allData = await getAllRankings();
        setAllRankings(allData);
        setAggregatedPlayers(computeAggregatedPlayers(allData));
      }
    } catch (error) {
      console.error('Error loading rankings:', error);
      setAllRankings([]);
      setAggregatedPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollTop + clientHeight >= scrollHeight - 60) {
      setDisplayCount((prev) => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content ranking-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ranking-header">
          <h2 className="modal-title gradient-text">
            <i className="fas fa-trophy"></i> {t('ranking.title')}
          </h2>
          <button className="ranking-close-btn" onClick={onClose} title={t('ranking.close')}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Top 3 Podium */}
        {!loading && topPlayers.length > 0 && (
          <div className="ranking-podium">
            <h3 className="ranking-podium-title">
              <i className="fas fa-star"></i> {t('ranking.topPlayers')}
            </h3>
            <div className="ranking-podium-cards">
              {/* Render in podium order: 2nd, 1st, 3rd */}
              {[1, 0, 2].map((podiumIndex) => {
                const player = topPlayers[podiumIndex];
                if (!player) return null;
                return (
                  <div
                    key={player.nickname}
                    className={`podium-card podium-${getMedalClass(podiumIndex)} podium-place-${podiumIndex + 1}`}
                  >
                    <div className="podium-medal">{getMedalEmoji(podiumIndex)}</div>
                    <div className="podium-position">#{podiumIndex + 1}</div>
                    <div className="podium-name">{player.nickname}</div>
                    <div className="podium-score">
                      {player.totalScore.toLocaleString()}
                      <span className="podium-score-label"> pts</span>
                    </div>
                    <div className="podium-entries">
                      {player.entries} {player.entries === 1 ? 'playlist' : 'playlists'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Controls row */}
        <div className="ranking-controls">
          <div className="ranking-filter">
            <label>{t('ranking.playlist')}</label>
            <select
              value={selectedPlaylist}
              onChange={(e) => setSelectedPlaylist(e.target.value)}
            >
              <option value="">{t('ranking.global')}</option>
              {playlists.map((playlist) => (
                <option key={playlist.value} value={playlist.value}>
                  {playlist.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ranking-search">
            <label>{t('ranking.search')}</label>
            <div className="ranking-search-input-wrapper">
              <i className="fas fa-search ranking-search-icon"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('ranking.searchPlaceholder')}
                className="ranking-search-input"
              />
              {searchQuery && (
                <button
                  className="ranking-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results count */}
        {!loading && searchQuery && (
          <div className="ranking-results-count">
            {filteredList.length} {t('ranking.resultsFound')}
          </div>
        )}

        {/* Scrollable ranking list */}
        <div className="ranking-list" ref={scrollContainerRef}>
          {loading ? (
            <div className="ranking-loading">
              <div className="ranking-spinner"></div>
              <div>{t('ranking.loading')}</div>
            </div>
          ) : visibleCount === 0 ? (
            <div className="ranking-empty">
              <i className="fas fa-inbox ranking-empty-icon"></i>
              <p>{searchQuery ? t('ranking.noResults') : t('ranking.noRankings')}</p>
            </div>
          ) : isAggregatedView ? (
            /* ===== AGGREGATED VIEW (global — summed scores per player) ===== */
            <>
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>{t('result.rank')}</th>
                    <th>{t('ranking.nickname')}</th>
                    <th>{t('ranking.playlists')}</th>
                    <th>{t('result.kicks')}</th>
                    <th>{t('result.time')}</th>
                    <th>{t('result.score')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAggregated.slice(0, displayCount).map((player, index) => {
                    const globalIndex = aggregatedPlayers.indexOf(player);
                    const rank = searchQuery ? globalIndex + 1 : index + 1;
                    return (
                      <tr
                        key={player.nickname}
                        className={`ranking-row ${rank <= 3 ? `ranking-row-top-${rank}` : ''}`}
                        style={{ animationDelay: `${(index % PAGE_SIZE) * 30}ms` }}
                      >
                        <td className="rank-cell">
                          {rank <= 3 ? (
                            <span className={`rank-badge rank-${getMedalClass(rank - 1)}`}>
                              {getMedalEmoji(rank - 1)} {rank}
                            </span>
                          ) : (
                            <span className="rank-number">{rank}</span>
                          )}
                        </td>
                        <td className="nickname-cell">
                          <span className="nickname-text">{player.nickname}</span>
                        </td>
                        <td className="playlists-count-cell">
                          <span className="playlists-badge">{player.entries}</span>
                        </td>
                        <td className="kicks-cell">{player.totalKicks}</td>
                        <td className="time-cell">{formatTime(player.totalTime)}</td>
                        <td className="score-cell">{player.totalScore.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {hasMore && (
                <div className="ranking-load-more">
                  <div className="ranking-load-more-spinner"></div>
                  <span>{t('ranking.loadingMore')}</span>
                </div>
              )}

              {!hasMore && filteredList.length > PAGE_SIZE && (
                <div className="ranking-end">
                  {t('ranking.endOfList')}
                </div>
              )}
            </>
          ) : (
            /* ===== INDIVIDUAL VIEW (playlist-specific — one entry per score) ===== */
            <>
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>{t('result.rank')}</th>
                    <th>{t('ranking.nickname')}</th>
                    <th>{t('ranking.playlistName')}</th>
                    <th>{t('result.kicks')}</th>
                    <th>{t('result.time')}</th>
                    <th>{t('result.score')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRankings.slice(0, displayCount).map((entry, index) => {
                    const globalIndex = allRankings.indexOf(entry);
                    const rank = searchQuery ? globalIndex + 1 : index + 1;
                    return (
                      <tr
                        key={`${entry.nickname}-${index}`}
                        className={`ranking-row ${rank <= 3 ? `ranking-row-top-${rank}` : ''}`}
                        style={{ animationDelay: `${(index % PAGE_SIZE) * 30}ms` }}
                      >
                        <td className="rank-cell">
                          {rank <= 3 ? (
                            <span className={`rank-badge rank-${getMedalClass(rank - 1)}`}>
                              {getMedalEmoji(rank - 1)} {rank}
                            </span>
                          ) : (
                            <span className="rank-number">{rank}</span>
                          )}
                        </td>
                        <td className="nickname-cell">
                          <span className="nickname-text">{entry.nickname}</span>
                        </td>
                        <td className="playlist-cell">{entry.playlistName}</td>
                        <td className="kicks-cell">{entry.kicks}</td>
                        <td className="time-cell">{formatTime(entry.time)}</td>
                        <td className="score-cell">{entry.score.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {hasMore && (
                <div className="ranking-load-more">
                  <div className="ranking-load-more-spinner"></div>
                  <span>{t('ranking.loadingMore')}</span>
                </div>
              )}

              {!hasMore && filteredList.length > PAGE_SIZE && (
                <div className="ranking-end">
                  {t('ranking.endOfList')}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RankingModal;
