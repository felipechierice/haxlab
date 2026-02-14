import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import { GameConfig } from '../types';
import { keyBindings, KeyBindings } from '../keybindings';
import { audioManager } from '../audio';
import { trackPageView } from '../analytics';


declare global {
  interface Window {
    configureKeybind: (action: keyof KeyBindings) => void;
    resetKeybindings: () => void;
  }
}

interface SettingsFormData {
  mapType: string;
  scoreLimit: number;
  timeLimit: number;
  kickMode: 'classic' | 'chargeable';
  kickStrength: number;
  playerRadius: number;
  playerSpeed: number;
  playerAcceleration: number;
  ballRadius: number;
  ballMass: number;
  ballDamping: number;
  ballColor: string;
  ballBorderColor: string;
  kickSpeedMultiplier: number;
}

function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => { trackPageView('SettingsPage'); }, []);
  
  const defaultSettings: SettingsFormData = {
    mapType: 'default',
    scoreLimit: 3,
    timeLimit: 5,
    kickMode: 'classic',
    kickStrength: 500,
    playerRadius: 15,
    playerSpeed: 260,
    playerAcceleration: 6.5,
    ballRadius: 8,
    ballMass: 2,
    ballDamping: 0.99,
    ballColor: '#ffff00',
    ballBorderColor: '#000000',
    kickSpeedMultiplier: 0.5,
  };
  
  const [settings, setSettings] = useState<SettingsFormData>(defaultSettings);

  const [keybinds, setKeybinds] = useState<KeyBindings>(keyBindings.getBindings());
  const [configuringKey, setConfiguringKey] = useState<keyof KeyBindings | null>(null);

  const handleResume = () => {
    // Retomar jogo se houver um ativo
    audioManager.play('menuBack');
    navigate(-1);
  };

  // Hook de navegação por teclado (desabilitado quando está configurando teclas)
  const { containerRef } = useKeyboardNav({
    onEscape: () => {
      if (!configuringKey) {
        handleResume();
      }
    },
    autoFocus: true
  });

  useEffect(() => {
    // Carregar configurações do localStorage se existir
    const savedConfig = localStorage.getItem('gameConfig');
    const savedMapType = localStorage.getItem('mapType');
    
    if (savedConfig) {
      try {
        const config: GameConfig = JSON.parse(savedConfig);
        setSettings({
          mapType: savedMapType || 'default',
          scoreLimit: config.scoreLimit,
          timeLimit: config.timeLimit / 60,
          kickMode: config.kickMode,
          kickStrength: config.kickStrength,
          playerRadius: config.playerRadius,
          playerSpeed: config.playerSpeed ?? 260,
          playerAcceleration: config.playerAcceleration ?? 6.5,
          ballRadius: config.ballConfig.radius,
          ballMass: config.ballConfig.mass,
          ballDamping: config.ballConfig.damping,
          ballColor: config.ballConfig.color,
          ballBorderColor: config.ballConfig.borderColor,
          kickSpeedMultiplier: config.kickSpeedMultiplier ?? 0.5,
        });
      } catch (e) {
        console.error('Error loading saved config:', e);
      }
    }
  }, []);

  useEffect(() => {
    // Expor função para configurar keybind
    (window as any).configureKeybind = (action: keyof KeyBindings) => {
      setConfiguringKey(action);
    };

    (window as any).resetKeybindings = () => {
      keyBindings.resetToDefault();
      setKeybinds(keyBindings.getBindings());
    };

    return () => {
      delete (window as any).configureKeybind;
      delete (window as any).resetKeybindings;
    };
  }, []);

  useEffect(() => {
    if (!configuringKey) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (e.key === 'Escape') {
        setConfiguringKey(null);
        return;
      }

      // Configurar nova tecla
      keyBindings.setBinding(configuringKey, [e.key]);
      setKeybinds(keyBindings.getBindings());
      setConfiguringKey(null);
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [configuringKey]);

  const handleChange = (field: keyof SettingsFormData, value: string | number) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const resetField = (field: keyof SettingsFormData) => {
    setSettings(prev => ({ ...prev, [field]: defaultSettings[field] }));
  };

  const handleApply = () => {
    // Salvar configurações no localStorage
    const config: GameConfig = {
      timeLimit: settings.timeLimit * 60,
      scoreLimit: settings.scoreLimit,
      playersPerTeam: 2,
      kickMode: settings.kickMode,
      kickStrength: settings.kickStrength,
      playerRadius: settings.playerRadius,
      playerSpeed: settings.playerSpeed,
      playerAcceleration: settings.playerAcceleration,
      kickSpeedMultiplier: settings.kickSpeedMultiplier,
      ballConfig: {
        radius: settings.ballRadius,
        mass: settings.ballMass,
        damping: settings.ballDamping,
        color: settings.ballColor,
        borderColor: settings.ballBorderColor,
        borderWidth: 2,
      },
    };

    localStorage.setItem('gameConfig', JSON.stringify(config));
    localStorage.setItem('mapType', settings.mapType);

    // Voltar para a tela anterior (reinicia o jogo se estava em jogo)
    navigate(-1);
  };

  const formatKeyDisplay = (keys: string[]): string => {
    return keys.map(key => {
      if (key === ' ' || key === 'Space') return 'SPACE';
      if (key.startsWith('Arrow')) return key.replace('Arrow', '').toUpperCase();
      return key.toUpperCase();
    }).join(' / ');
  };

  return (
    <div className="settings-page">
      <div className="settings-container" ref={containerRef}>
        <h2>
          <i className="fas fa-cog"></i> {t('settings.title')}
        </h2>

        {/* Regras da Partida */}
        <div className="settings-category">
          <h3><i className="fas fa-gamepad"></i> {t('settings.matchRules')}</h3>
          <div className="settings-grid">
            <div className="form-group">
              <label htmlFor="settings-map-select">{t('settings.map')}</label>
              <select
                id="settings-map-select"
                value={settings.mapType}
                onChange={(e) => handleChange('mapType', e.target.value)}
              >
                <option value="default">{t('settings.mapDefault')}</option>
                <option value="classic">{t('settings.mapClassic')}</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="settings-kick-mode">{t('settings.kickMode')}</label>
              <select
                id="settings-kick-mode"
                value={settings.kickMode}
                onChange={(e) => handleChange('kickMode', e.target.value as 'classic' | 'chargeable')}
              >
                <option value="classic">{t('settings.kickClassic')}</option>
                <option value="chargeable">{t('settings.kickChargeable')}</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="settings-score-limit">{t('settings.scoreLimit')}</label>
              <input
                type="number"
                id="settings-score-limit"
                min="1"
                max="10"
                value={settings.scoreLimit}
                onChange={(e) => handleChange('scoreLimit', parseInt(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="settings-time-limit">{t('settings.timeLimit')}</label>
              <input
                type="number"
                id="settings-time-limit"
                min="1"
                max="30"
                value={settings.timeLimit}
                onChange={(e) => handleChange('timeLimit', parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Jogador */}
        <div className="settings-category">
          <h3><i className="fas fa-running"></i> {t('settings.player')}</h3>
          <div className="settings-grid">
            <div className="form-group">
              <label htmlFor="settings-player-radius">
                <span>{t('settings.playerSize')}</span>
                <button 
                  type="button"
                  className="reset-field-btn" 
                  onClick={() => resetField('playerRadius')}
                  title={t('settings.resetDefault')}
                >
                  <i className="fas fa-undo"></i>
                </button>
              </label>
              <input
                type="range"
                id="settings-player-radius"
                min="10"
                max="25"
                step="1"
                value={settings.playerRadius}
                onChange={(e) => handleChange('playerRadius', parseFloat(e.target.value))}
              />
              <span>{settings.playerRadius}</span>
            </div>
            <div className="form-group">
              <label htmlFor="settings-player-speed">
                <span>{t('settings.playerSpeed')}</span>
                <button 
                  type="button"
                  className="reset-field-btn" 
                  onClick={() => resetField('playerSpeed')}
                  title={t('settings.resetDefault')}
                >
                  <i className="fas fa-undo"></i>
                </button>
              </label>
              <input
                type="range"
                id="settings-player-speed"
                min="100"
                max="500"
                step="10"
                value={settings.playerSpeed}
                onChange={(e) => handleChange('playerSpeed', parseFloat(e.target.value))}
              />
              <span>{settings.playerSpeed}</span>
            </div>
            <div className="form-group">
              <label htmlFor="settings-player-acceleration">
                <span>{t('settings.playerAcceleration')}</span>
                <button 
                  type="button"
                  className="reset-field-btn" 
                  onClick={() => resetField('playerAcceleration')}
                  title={t('settings.resetDefault')}
                >
                  <i className="fas fa-undo"></i>
                </button>
              </label>
              <input
                type="range"
                id="settings-player-acceleration"
                min="2"
                max="15"
                step="0.5"
                value={settings.playerAcceleration}
                onChange={(e) => handleChange('playerAcceleration', parseFloat(e.target.value))}
              />
              <span>{settings.playerAcceleration}</span>
            </div>
            <div className="form-group">
              <label htmlFor="settings-kick-strength">
                <span>{t('settings.kickStrength')}</span>
                <button 
                  type="button"
                  className="reset-field-btn" 
                  onClick={() => resetField('kickStrength')}
                  title={t('settings.resetDefault')}
                >
                  <i className="fas fa-undo"></i>
                </button>
              </label>
              <input
                type="range"
                id="settings-kick-strength"
                min="200"
                max="1000"
                step="50"
                value={settings.kickStrength}
                onChange={(e) => handleChange('kickStrength', parseFloat(e.target.value))}
              />
              <span>{settings.kickStrength}</span>
            </div>
            <div className="form-group">
              <label htmlFor="settings-kick-speed-multiplier">
                <span>{t('settings.kickSpeedMultiplier')}</span>
                <button 
                  type="button"
                  className="reset-field-btn" 
                  onClick={() => resetField('kickSpeedMultiplier')}
                  title={t('settings.resetDefault')}
                >
                  <i className="fas fa-undo"></i>
                </button>
              </label>
              <input
                type="range"
                id="settings-kick-speed-multiplier"
                min="0.3"
                max="1.0"
                step="0.05"
                value={settings.kickSpeedMultiplier}
                onChange={(e) => handleChange('kickSpeedMultiplier', parseFloat(e.target.value))}
              />
              <span>{settings.kickSpeedMultiplier.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Bola */}
        <div className="settings-category">
          <h3><i className="fas fa-futbol"></i> {t('settings.ball')}</h3>
          <div className="settings-grid">
            <div className="form-group">
              <label htmlFor="settings-ball-radius">
                <span>{t('settings.ballRadius')}</span>
                <button 
                  type="button"
                  className="reset-field-btn" 
                  onClick={() => resetField('ballRadius')}
                  title="Restaurar padrão"
                >
                  <i className="fas fa-undo"></i>
                </button>
              </label>
              <input
                type="range"
                id="settings-ball-radius"
                min="5"
                max="15"
                step="0.5"
                value={settings.ballRadius}
                onChange={(e) => handleChange('ballRadius', parseFloat(e.target.value))}
              />
              <span>{settings.ballRadius}</span>
            </div>
            <div className="form-group">
              <label htmlFor="settings-ball-mass">
                <span>{t('settings.ballMass')}</span>
                <button 
                  type="button"
                  className="reset-field-btn" 
                  onClick={() => resetField('ballMass')}
                  title="Restaurar padrão"
                >
                  <i className="fas fa-undo"></i>
                </button>
              </label>
              <input
                type="range"
                id="settings-ball-mass"
                min="1"
                max="20"
                step="0.5"
                value={settings.ballMass}
                onChange={(e) => handleChange('ballMass', parseFloat(e.target.value))}
              />
              <span>{settings.ballMass}</span>
            </div>
            <div className="form-group">
              <label htmlFor="settings-ball-color">
                <span>{t('settings.ballColor')}</span>
                <button 
                  type="button"
                  className="reset-field-btn" 
                  onClick={() => resetField('ballColor')}
                  title={t('settings.resetDefault')}
                >
                  <i className="fas fa-undo"></i>
                </button>
              </label>
              <input
                type="color"
                id="settings-ball-color"
                value={settings.ballColor}
                onChange={(e) => handleChange('ballColor', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="settings-ball-border-color">
                <span>{t('settings.ballBorderColor')}</span>
                <button 
                  type="button"
                  className="reset-field-btn" 
                  onClick={() => resetField('ballBorderColor')}
                  title={t('settings.resetDefault')}
                >
                  <i className="fas fa-undo"></i>
                </button>
              </label>
              <input
                type="color"
                id="settings-ball-border-color"
                value={settings.ballBorderColor}
                onChange={(e) => handleChange('ballBorderColor', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="settings-ball-damping">
                <span>{t('settings.ballDamping')}</span>
                <button 
                  type="button"
                  className="reset-field-btn" 
                  onClick={() => resetField('ballDamping')}
                  title="Restaurar padrão"
                >
                  <i className="fas fa-undo"></i>
                </button>
              </label>
              <input
                type="range"
                id="settings-ball-damping"
                min="0.95"
                max="0.999"
                step="0.001"
                value={settings.ballDamping}
                onChange={(e) => handleChange('ballDamping', parseFloat(e.target.value))}
              />
              <span>{settings.ballDamping.toFixed(3)}</span>
            </div>
          </div>
        </div>

        {/* Controles */}
        <div className="settings-category">
          <h3><i className="fas fa-keyboard"></i> {t('settings.controls')}</h3>
          <div className="settings-grid-3">
            <div className="form-group">
              <label>{t('settings.moveUp')}</label>
              <div className="keybind-container">
                <input
                  type="text"
                  value={configuringKey === 'up' ? t('settings.pressKey') : formatKeyDisplay(keybinds.up)}
                  readOnly
                  className={configuringKey === 'up' ? 'configuring' : ''}
                />
                <button
                  className="secondary"
                  onClick={() => setConfiguringKey('up')}
                >
                  {t('settings.change')}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>{t('settings.moveDown')}</label>
              <div className="keybind-container">
                <input
                  type="text"
                  value={configuringKey === 'down' ? t('settings.pressKey') : formatKeyDisplay(keybinds.down)}
                  readOnly
                  className={configuringKey === 'down' ? 'configuring' : ''}
                />
                <button
                  className="secondary"
                  onClick={() => setConfiguringKey('down')}
                >
                  {t('settings.change')}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>{t('settings.moveLeft')}</label>
              <div className="keybind-container">
                <input
                  type="text"
                  value={configuringKey === 'left' ? t('settings.pressKey') : formatKeyDisplay(keybinds.left)}
                  readOnly
                  className={configuringKey === 'left' ? 'configuring' : ''}
                />
                <button
                  className="secondary"
                  onClick={() => setConfiguringKey('left')}
                >
                  {t('settings.change')}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>{t('settings.moveRight')}</label>
              <div className="keybind-container">
                <input
                  type="text"
                  value={configuringKey === 'right' ? t('settings.pressKey') : formatKeyDisplay(keybinds.right)}
                  readOnly
                  className={configuringKey === 'right' ? 'configuring' : ''}
                />
                <button
                  className="secondary"
                  onClick={() => setConfiguringKey('right')}
                >
                  {t('settings.change')}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>{t('settings.kick')}</label>
              <div className="keybind-container">
                <input
                  type="text"
                  value={configuringKey === 'kick' ? t('settings.pressKey') : formatKeyDisplay(keybinds.kick)}
                  readOnly
                  className={configuringKey === 'kick' ? 'configuring' : ''}
                />
                <button
                  className="secondary"
                  onClick={() => setConfiguringKey('kick')}
                >
                  {t('settings.change')}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>{t('settings.switchPlayer')}</label>
              <div className="keybind-container">
                <input
                  type="text"
                  value={configuringKey === 'switchPlayer' ? t('settings.pressKey') : formatKeyDisplay(keybinds.switchPlayer)}
                  readOnly
                  className={configuringKey === 'switchPlayer' ? 'configuring' : ''}
                />
                <button
                  className="secondary"
                  onClick={() => setConfiguringKey('switchPlayer')}
                >
                  {t('settings.change')}
                </button>
              </div>
            </div>
            <div className="form-group settings-full-width">
              <button
                className="secondary"
                onClick={() => {
                  keyBindings.resetToDefault();
                  setKeybinds(keyBindings.getBindings());
                }}
                style={{ width: '100%', marginTop: '8px' }}
              >
                <i className="fas fa-redo"></i> {t('settings.resetDefaults')}
              </button>
            </div>
          </div>
        </div>

        <div className="button-group">
          <button
            className="btn-apply"
            onClick={handleApply}
          >
            <i className="fas fa-check"></i> {t('settings.apply')}
          </button>
          <button
            className="secondary"
            onClick={handleResume}
          >
            {t('settings.resume')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
