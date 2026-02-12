import { useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';


declare global {
  interface Window {
    startFreeTrainingGame: () => void;
    showPlaylistsMenu: () => void;
    startPlaylistEditor: () => void;
  }
}

function GameModesPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleFreeTraining = () => {
    // Navega para tela de jogo em React
    navigate('/game');
  };

  const handlePlaylists = () => {
    // Navega para tela de playlists em React
    navigate('/playlists');
  };

  const handleEditor = () => {
    navigate('/game', { state: { mode: 'editor' } });
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="game-modes-page">
      <div className="modes-container">
        <h2 className="modes-title">{t('modes.title')}</h2>
        
        <div className="modes-button-group">
          <button className="btn-mode btn-free-training" onClick={handleFreeTraining}>
            <i className="fas fa-bullseye"></i> {t('modes.freeTraining')}
          </button>
          
          <button className="btn-mode btn-playlists" onClick={handlePlaylists}>
            <i className="fas fa-list"></i> {t('modes.playlists')}
          </button>
          
          <button className="btn-mode btn-editor" onClick={handleEditor}>
            <i className="fas fa-palette"></i> Playlist Editor
          </button>
        </div>
        
        <button className="btn-back" onClick={handleBack}>
          <i className="fas fa-arrow-left"></i> {t('modes.back')}
        </button>
      </div>
    </div>
  );
}

export default GameModesPage;
