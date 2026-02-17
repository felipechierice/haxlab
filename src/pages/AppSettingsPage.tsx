import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import { keyBindings, KeyBindings } from '../keybindings';
import { audioManager } from '../audio';
import { trackPageView } from '../analytics';
import { extrapolation } from '../extrapolation';
import '../styles/AppSettingsPage.css';

function AppSettingsPage() {
  useEffect(() => { trackPageView('AppSettingsPage'); }, []);
  const navigate = useNavigate();
  const { language, t, changeLanguage } = useI18n();
  const [soundVolume, setSoundVolume] = useState<number>(() => {
    const saved = localStorage.getItem('soundVolume');
    return saved ? parseFloat(saved) : 0.7;
  });
  
  const [extrapolationMs, setExtrapolationMs] = useState<number>(() => {
    const saved = localStorage.getItem('extrapolation');
    return saved ? parseInt(saved) : 0;
  });
  
  const [interpolationEnabled, setInterpolationEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('interpolation');
    return saved ? saved === 'true' : true; // Padrão: ativado
  });

  const [keybinds, setKeybinds] = useState<KeyBindings>(keyBindings.getBindings());
  const [configuringKey, setConfiguringKey] = useState<keyof KeyBindings | null>(null);

  const handleBack = () => {
    audioManager.play('menuBack');
    navigate('/');
  };

  const { containerRef } = useKeyboardNav({
    onEscape: () => {
      if (!configuringKey) {
        handleBack();
      }
    },
    autoFocus: true
  });

  useEffect(() => {
    if (!configuringKey) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setConfiguringKey(null);
        return;
      }

      keyBindings.setBinding(configuringKey, [e.key]);
      setKeybinds(keyBindings.getBindings());
      setConfiguringKey(null);
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [configuringKey]);

  const formatKeyDisplay = (keys: string[]): string => {
    return keys.map(key => {
      if (key === ' ' || key === 'Space') return 'SPACE';
      if (key.startsWith('Arrow')) return key.replace('Arrow', '').toUpperCase();
      return key.toUpperCase();
    }).join(' / ');
  };

  useEffect(() => {
    // Aplicar volume salvo ao carregar
    audioManager.setVolume(soundVolume);
    // Aplicar extrapolation salvo ao carregar
    extrapolation.setExtrapolation(extrapolationMs);
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    setSoundVolume(volume);
    audioManager.setVolume(volume);
    localStorage.setItem('soundVolume', volume.toString());
    
    // Tocar som de teste
    audioManager.play('kick');
  };
  
  const handleExtrapolationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ms = parseInt(e.target.value);
    setExtrapolationMs(ms);
    extrapolation.setExtrapolation(ms);
    localStorage.setItem('extrapolation', ms.toString());
  };
  
  const handleInterpolationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    setInterpolationEnabled(enabled);
    localStorage.setItem('interpolation', enabled.toString());
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
          
          {/* Extrapolation */}
          <div className="setting-section">
            <label className="setting-label">
              <i className="fas fa-forward"></i> {t('appSettings.extrapolation')}
            </label>
            <div className="volume-control">
              <input
                type="range"
                className="volume-slider"
                min="0"
                max="500"
                step="10"
                value={extrapolationMs}
                onChange={handleExtrapolationChange}
              />
              <span className="volume-value">{extrapolationMs}ms</span>
            </div>
            <p className="setting-hint">{t('appSettings.extrapolationHint')}</p>
          </div>
          
          {/* Interpolation */}
          <div className="setting-section">
            <label className="setting-label">
              <i className="fas fa-stream"></i> {t('appSettings.interpolation')}
            </label>
            <div className="checkbox-control">
              <input
                type="checkbox"
                id="interpolation-checkbox"
                checked={interpolationEnabled}
                onChange={handleInterpolationChange}
              />
              <label htmlFor="interpolation-checkbox" className="checkbox-label">
                {interpolationEnabled ? t('appSettings.enabled') : t('appSettings.disabled')}
              </label>
            </div>
            <p className="setting-hint">{t('appSettings.interpolationHint')}</p>
          </div>

          {/* Controls / Keybindings */}
          <div className="setting-section">
            <label className="setting-label">
              <i className="fas fa-keyboard"></i> {t('settings.controls')}
            </label>
            <div className="keybinds-grid">
              <div className="keybind-row">
                <span className="keybind-label">{t('settings.moveUp')}</span>
                <div className="keybind-control">
                  <input
                    type="text"
                    value={configuringKey === 'up' ? t('settings.pressKey') : formatKeyDisplay(keybinds.up)}
                    readOnly
                    className={`keybind-input${configuringKey === 'up' ? ' configuring' : ''}`}
                  />
                  <button className="keybind-btn" onClick={() => setConfiguringKey('up')}>
                    {t('settings.change')}
                  </button>
                </div>
              </div>
              <div className="keybind-row">
                <span className="keybind-label">{t('settings.moveDown')}</span>
                <div className="keybind-control">
                  <input
                    type="text"
                    value={configuringKey === 'down' ? t('settings.pressKey') : formatKeyDisplay(keybinds.down)}
                    readOnly
                    className={`keybind-input${configuringKey === 'down' ? ' configuring' : ''}`}
                  />
                  <button className="keybind-btn" onClick={() => setConfiguringKey('down')}>
                    {t('settings.change')}
                  </button>
                </div>
              </div>
              <div className="keybind-row">
                <span className="keybind-label">{t('settings.moveLeft')}</span>
                <div className="keybind-control">
                  <input
                    type="text"
                    value={configuringKey === 'left' ? t('settings.pressKey') : formatKeyDisplay(keybinds.left)}
                    readOnly
                    className={`keybind-input${configuringKey === 'left' ? ' configuring' : ''}`}
                  />
                  <button className="keybind-btn" onClick={() => setConfiguringKey('left')}>
                    {t('settings.change')}
                  </button>
                </div>
              </div>
              <div className="keybind-row">
                <span className="keybind-label">{t('settings.moveRight')}</span>
                <div className="keybind-control">
                  <input
                    type="text"
                    value={configuringKey === 'right' ? t('settings.pressKey') : formatKeyDisplay(keybinds.right)}
                    readOnly
                    className={`keybind-input${configuringKey === 'right' ? ' configuring' : ''}`}
                  />
                  <button className="keybind-btn" onClick={() => setConfiguringKey('right')}>
                    {t('settings.change')}
                  </button>
                </div>
              </div>
              <div className="keybind-row">
                <span className="keybind-label">{t('settings.kick')}</span>
                <div className="keybind-control">
                  <input
                    type="text"
                    value={configuringKey === 'kick' ? t('settings.pressKey') : formatKeyDisplay(keybinds.kick)}
                    readOnly
                    className={`keybind-input${configuringKey === 'kick' ? ' configuring' : ''}`}
                  />
                  <button className="keybind-btn" onClick={() => setConfiguringKey('kick')}>
                    {t('settings.change')}
                  </button>
                </div>
              </div>
              <div className="keybind-row">
                <span className="keybind-label">{t('settings.switchPlayer')}</span>
                <div className="keybind-control">
                  <input
                    type="text"
                    value={configuringKey === 'switchPlayer' ? t('settings.pressKey') : formatKeyDisplay(keybinds.switchPlayer)}
                    readOnly
                    className={`keybind-input${configuringKey === 'switchPlayer' ? ' configuring' : ''}`}
                  />
                  <button className="keybind-btn" onClick={() => setConfiguringKey('switchPlayer')}>
                    {t('settings.change')}
                  </button>
                </div>
              </div>
            </div>
            <button
              className="keybind-reset-btn"
              onClick={() => {
                keyBindings.resetToDefault();
                setKeybinds(keyBindings.getBindings());
              }}
            >
              <i className="fas fa-redo"></i> {t('settings.resetDefaults')}
            </button>
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
