import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { getNickname, saveNickname, generateRandomNickname, isValidNickname } from '../player.js';
import RankingModal from '../components/RankingModal';


function HomePage() {
  const navigate = useNavigate();
  const { language, t, changeLanguage } = useI18n();
  const [nickname, setNickname] = useState(getNickname());
  const [showRankingModal, setShowRankingModal] = useState(false);

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
    // Navega para a página de modos de jogo (React)
    navigate('/modes');
  };

  const handleRanking = () => {
    setShowRankingModal(true);
  };

  return (
    <div className="home-page">
      <div className="menu-container">
        <h1 className="title">{t('menu.title')}</h1>
        
        {/* Language Selector */}
        <div className="form-section">
          <label className="form-label">
            <i className="fas fa-globe"></i> {t('menu.language')}
          </label>
          <select 
            className="form-select"
            value={language}
            onChange={(e) => changeLanguage(e.target.value as 'en' | 'pt' | 'es')}
          >
            <option value="en">English</option>
            <option value="pt">Português</option>
            <option value="es">Español</option>
          </select>
        </div>

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
        </div>
      </div>

      <RankingModal isOpen={showRankingModal} onClose={() => setShowRankingModal(false)} />
    </div>
  );
}

export default HomePage;
