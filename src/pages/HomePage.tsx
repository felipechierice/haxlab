import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import { useAuth } from '../contexts/AuthContext';
import { audioManager } from '../audio';
import { signOut } from '../auth';
import RankingModal from '../components/RankingModal';
import ReplayViewer from '../components/ReplayViewer';
import AuthModal from '../components/AuthModal';
import { trackPageView } from '../analytics';
import { GAME_VERSION } from '../version';
import { RankingEntry } from '../firebase';


function HomePage() {
  useEffect(() => { trackPageView('HomePage'); }, []);
  const navigate = useNavigate();
  const { t } = useI18n();
  const { userProfile, isAuthenticated, setUserProfile } = useAuth();
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showReplayViewer, setShowReplayViewer] = useState(false);
  const [selectedReplayEntry, setSelectedReplayEntry] = useState<RankingEntry | null>(null);
  
  const { containerRef } = useKeyboardNav({
    autoFocus: true,
    initialFocusSelector: '.btn-play'
  });

  const handlePlay = () => {
    // Validar se o jogador tem nickname
    if (!userProfile || !userProfile.nickname || userProfile.nickname.trim().length === 0) {
      audioManager.play('menuBack');
      setShowAuthModal(true);
      return;
    }
    
    audioManager.play('menuSelect');
    navigate('/modes');
  };

  const handleRanking = () => {
    audioManager.play('menuSelect');
    setShowRankingModal(true);
  };

  const handleWatchReplay = (entry: RankingEntry) => {
    audioManager.play('menuSelect');
    setSelectedReplayEntry(entry);
    setShowReplayViewer(true);
    setShowRankingModal(false);
  };

  const handleSettings = () => {
    audioManager.play('menuSelect');
    navigate('/app-settings');
  };

  const handleCredits = () => {
    audioManager.play('menuSelect');
    navigate('/credits');
  };

  const handleChangelogs = () => {
    audioManager.play('menuSelect');
    navigate('/changelogs');
  };

  const handleAuth = () => {
    audioManager.play('menuSelect');
    setShowAuthModal(true);
  };

  const handleLogout = async () => {
    audioManager.play('menuSelect');
    try {
      await signOut();
      // Setar perfil como null para mostrar botão de login
      setUserProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="home-page">
      <div className="menu-container" ref={containerRef}>
        <img src="/images/haxlab-logo-text-transparent.webp" alt="HaxLab" className="logo" />
        
        {/* User Info or Auth Button */}
        {userProfile ? (
          <div className="user-profile-section">
            <div className="user-profile-info" onClick={handleAuth} style={{ cursor: 'pointer' }} title={t('auth.clickToManage')}>
              <i className={`fas ${userProfile.isGuest ? 'fa-user' : 'fa-user-circle'}`}></i>
              <div>
                <div className="user-nickname">
                  {userProfile.nickname}
                  <i className="fas fa-pencil-alt edit-icon" title={t('auth.clickToEdit')}></i>
                </div>
                {userProfile.isGuest && (
                  <div className="user-status">{t('auth.guest')}</div>
                )}
              </div>
            </div>
            <button className="btn-logout" onClick={handleLogout} title={t('auth.logout')}>
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        ) : (
          <button className="btn-auth" onClick={handleAuth}>
            <i className="fas fa-sign-in-alt"></i> {t('auth.login')} / {t('auth.register')}
          </button>
        )}
        
        {/* Action Buttons */}
        <div className="button-group">
          <button className="btn-play" onClick={handlePlay}>
            <i className="fas fa-play"></i> {t('menu.play')}
          </button>
          <button className="btn-ranking" onClick={handleRanking}>
            <i className="fas fa-trophy"></i> {t('menu.ranking')}
          </button>
          <button className="btn-settings" onClick={handleSettings}>
            <i className="fas fa-cog"></i> {t('menu.settings')}
          </button>
        </div>

        {/* Footer Links */}
        <div className="menu-footer">
          <button className="btn-link" onClick={handleCredits}>
            <i className="fas fa-heart"></i> {t('menu.credits')}
          </button>
          <span className="footer-separator">•</span>
          <button className="btn-link" onClick={handleChangelogs}>
            <i className="fas fa-history"></i> {t('menu.changelogs')}
          </button>
        </div>

        {/* Version Display */}
        <div className="version-display">
          v{GAME_VERSION}
        </div>
      </div>

      {showRankingModal && (
        <RankingModal 
          isOpen={showRankingModal} 
          onClose={() => setShowRankingModal(false)}
          onWatchReplay={handleWatchReplay}
        />
      )}
      {showReplayViewer && (
        <ReplayViewer
          isOpen={showReplayViewer}
          onClose={() => {
            setShowReplayViewer(false);
            setSelectedReplayEntry(null);
          }}
          rankingEntry={selectedReplayEntry}
          isCommunityPlaylist={false}
        />
      )}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} allowGuest={true} />}
    </div>
  );
}

export default HomePage;
