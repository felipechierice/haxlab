import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import { getNickname, saveNickname, generateRandomNickname, isValidNickname } from '../player.js';
import { audioManager } from '../audio';
import RankingModal from '../components/RankingModal';
import { trackPageView } from '../analytics';


function HomePage() {
  useEffect(() => { trackPageView('HomePage'); }, []);
  const navigate = useNavigate();
  const { t } = useI18n();
  const [nickname, setNickname] = useState(getNickname());
  const [showRankingModal, setShowRankingModal] = useState(false);
  
  const { containerRef } = useKeyboardNav({
    autoFocus: true,
    initialFocusSelector: '.btn-play'
  });

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNickname(value);
    if (isValidNickname(value)) {
      saveNickname(value);
    }
  };

  const handleRandomNickname = () => {
    const newNickname = generateRandomNickname();
    setNickname(newNickname);
    saveNickname(newNickname);
  };

  const handlePlay = () => {
    audioManager.play('menuSelect');
    navigate('/modes');
  };

  const handleRanking = () => {
    audioManager.play('menuSelect');
    setShowRankingModal(true);
  };

  const handleSettings = () => {
    audioManager.play('menuSelect');
    navigate('/app-settings');
  };

  return (
    <div className="home-page">
      <div className="menu-container" ref={containerRef}>
        <img src="/images/haxlab-logo.webp" alt="HaxLab" className="logo" />
        
        {/* Nickname */}
        <div className="nickname-section">
          <label className="form-label">
            <i className="fas fa-user"></i> {t('menu.nickname')}
          </label>
          <div className="nickname-input-group">
            <input
              type="text"
              className="nickname-input"
              placeholder={t('menu.nickname.placeholder')}
              value={nickname}
              onChange={handleNicknameChange}
              maxLength={16}
              pattern="[a-zA-Z0-9]{3,16}"
            />
            <button 
              className="btn-random"
              onClick={handleRandomNickname}
              title={t('menu.nickname.random')}
            >
              <i className="fas fa-dice"></i>
            </button>
          </div>
        </div>

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
      </div>

      <RankingModal isOpen={showRankingModal} onClose={() => setShowRankingModal(false)} />
    </div>
  );
}

export default HomePage;
