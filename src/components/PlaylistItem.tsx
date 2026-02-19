import { PlaylistInfo } from '../types/playlist-ui';

interface PlaylistItemProps {
  playlist: PlaylistInfo;
  isSelected: boolean;
  rankPosition?: number;
  onSelect: () => void;
}

function PlaylistItem({ playlist, isSelected, rankPosition, onSelect }: PlaylistItemProps) {
  return (
    <button 
      className={`playlist-item ${isSelected ? 'selected' : ''} ${rankPosition ? 'completed' : ''}`}
      onClick={onSelect}
    >
      <div className="playlist-item-content">
        <div className="playlist-emoji">
          <i className={`fas ${playlist.icon}`}></i>
        </div>
        <div className="playlist-info">
          <div className="playlist-item-name">
            {playlist.name}
            {rankPosition && (
              <span className={`rank-badge ${rankPosition <= 3 ? 'top-3' : ''} ${rankPosition === 1 ? 'gold' : rankPosition === 2 ? 'silver' : rankPosition === 3 ? 'bronze' : ''}`}>
                #{rankPosition}
              </span>
            )}
          </div>
          <div className="playlist-item-desc">{playlist.description}</div>
        </div>
      </div>
    </button>
  );
}

export default PlaylistItem;
