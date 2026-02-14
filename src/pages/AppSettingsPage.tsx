import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import { audioManager } from '../audio';
import { trackPageView } from '../analytics';
import '../styles/AppSettingsPage.css';

function AppSettingsPage() {
  useEffect(() => { trackPageView('AppSettingsPage'); }, []);
  const navigate = useNavigate();
  const { language, t, changeLanguage } = useI18n();
  const [soundVolume, setSoundVolume] = useState<number>(() => {
    const saved = localStorage.getItem('soundVolume');
    return saved ? parseFloat(saved) : 0.7;
  });

  const handleBack = () => {
    audioManager.play('menuBack');
    navigate('/');
  };

  const { containerRef } = useKeyboardNav({
    onEscape: handleBack,
    autoFocus: true
  });

  useEffect(() => {
    // Aplicar volume salvo ao carregar
    audioManager.setVolume(soundVolume);
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    setSoundVolume(volume);
    audioManager.setVolume(volume);
    localStorage.setItem('soundVolume', volume.toString());
    
    // Tocar som de teste
    audioManager.play('kick');
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    changeLanguage(e.target.value as 'en' | 'pt' | 'es');
  };

  return (
    <div className="app-settings-page">
      <div className="settings-container" ref={containerRef}>
        <h1 className="settings-title">
          <i className="fas fa-cog"></i> {t('appSettings.title')}
        </h1>

        <div className="settings-content">
          {/* Language */}
          <div className="setting-section">
            <label className="setting-label">
              <i className="fas fa-globe"></i> {t('appSettings.language')}
            </label>
            <select 
              className="setting-select"
              value={language}
              onChange={handleLanguageChange}
            >
              <option value="en">English</option>
              <option value="pt">Português</option>
              <option value="es">Español</option>
            </select>
          </div>

          {/* Sound Volume */}
          <div className="setting-section">
            <label className="setting-label">
              <i className="fas fa-volume-up"></i> {t('appSettings.soundVolume')}
            </label>
            <div className="volume-control">
              <input
                type="range"
                className="volume-slider"
                min="0"
                max="1"
                step="0.01"
                value={soundVolume}
                onChange={handleVolumeChange}
              />
              <span className="volume-value">{Math.round(soundVolume * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="settings-actions">
          <button className="btn-back" onClick={handleBack}>
            <i className="fas fa-arrow-left"></i> {t('appSettings.back')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AppSettingsPage;
