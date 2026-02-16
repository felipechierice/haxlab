import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import { useAuth } from '../contexts/AuthContext';
import { audioManager } from '../audio';
import { trackPageView } from '../analytics';
import AuthModal from '../components/AuthModal';


function GameModesPage() {
  useEffect(() => { trackPageView('GameModesPage'); }, []);
  const navigate = useNavigate();
  const { t } = useI18n();
  const { userProfile } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleBack = () => {
    audioManager.play('menuBack');
    navigate('/');
  };

  const { containerRef } = useKeyboardNav({
    onEscape: handleBack,
    autoFocus: true
  });

  const validateNickname = () => {
    if (!userProfile || !userProfile.nickname || userProfile.nickname.trim().length === 0) {
      audioManager.play('menuBack');
      setShowAuthModal(true);
      return false;
    }
    return true;
  };

  const handleFreeTraining = () => {
    if (!validateNickname()) return;
    audioManager.play('menuSelect');
    navigate('/game');
  };

  const handlePlaylists = () => {
    audioManager.play('menuSelect');
    navigate('/playlists');
  };

  const handleEditor = () => {
    audioManager.play('menuSelect');
    navigate('/game', { state: { mode: 'editor' } });
  };

  return (
    <div className="game-modes-page">
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} allowGuest={true} />
      )}
      
      <div className="modes-container" ref={containerRef}>
        <h2 className="modes-title">{t('modes.title')}</h2>
        
        <div className="modes-button-group">
          <button className="btn-mode btn-playlists" onClick={handlePlaylists}>
            <i className="fas fa-list"></i> {t('modes.playlists')}
          </button>
          
          <button className="btn-mode btn-free-training" onClick={handleFreeTraining}>
            <i className="fas fa-bullseye"></i> {t('modes.freeTraining')}
          </button>
          
          <button className="btn-mode btn-editor" onClick={handleEditor}>
            <i className="fas fa-palette"></i> {t('modes.playlistEditor')}
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
