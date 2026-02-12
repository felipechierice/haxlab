import { PlaylistInfo } from '../types/playlist-ui';

interface PlaylistItemProps {
  playlist: PlaylistInfo;
  isSelected: boolean;
  onSelect: () => void;
}

function PlaylistItem({ playlist, isSelected, onSelect }: PlaylistItemProps) {
  return (
    <button 
      className={`playlist-item ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="playlist-item-content">
        <div className="playlist-emoji">
          <i className={`fas ${playlist.icon}`}></i>
        </div>
        <div className="playlist-info">
          <div className="playlist-item-name">{playlist.name}</div>
          <div className="playlist-item-desc">{playlist.description}</div>
        </div>
      </div>
    </button>
  );
}

export default PlaylistItem;
