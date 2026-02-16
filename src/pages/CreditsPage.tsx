import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import { audioManager } from '../audio';
import { trackPageView } from '../analytics';
import '../styles/CreditsPage.css';

function CreditsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => { trackPageView('CreditsPage'); }, []);

  const handleBack = () => {
    audioManager.play('menuBack');
    navigate('/');
  };

  const { containerRef } = useKeyboardNav({
    onEscape: handleBack,
    autoFocus: true,
    initialFocusSelector: '.btn-back'
  });

  return (
    <div className="credits-page">
      <div className="credits-container" ref={containerRef}>
        <div className="credits-header">
          <h2>
            <i className="fas fa-heart"></i> {t('credits.title')}
          </h2>
          <button className="btn-back-credits" onClick={handleBack}>
            <i className="fas fa-arrow-left"></i> {t('credits.back')}
          </button>
        </div>

        <div className="credits-content">
          <section className="credits-section">
            <h3><i className="fas fa-users"></i> {t('credits.team')}</h3>
            <div className="credit-item">
              <strong>Byomess</strong>
              <p>{t('credits.mainDeveloper')}</p>
              <p className="credit-discord">Discord: byomess</p>
            </div>
            <div className="credit-item">
              <strong>Ferraz</strong>
              <p>{t('credits.developerAndPlaylists')}</p>
              <p className="credit-discord">Discord: ferrazzxxx</p>
            </div>
          </section>

          <section className="credits-section">
            <h3><i className="fas fa-heart"></i> {t('credits.acknowledgments')}</h3>
            <div className="credit-item">
              <strong>basro (Mario Carbajal)</strong>
              <p>{t('credits.basroThankYou')}</p>
              <a href="https://www.haxball.com" target="_blank" rel="noopener noreferrer" className="credit-link">
                <i className="fas fa-external-link-alt"></i> haxball.com
              </a>
            </div>
            <div className="credit-item">
              <strong>zezum</strong>
              <p>{t('credits.testerThankYou')}</p>
              <p className="credit-discord">Discord: .zezum</p>
            </div>
            <div className="credit-item">
              <strong>H20</strong>
              <p>{t('credits.testerThankYou')}</p>
              <p className="credit-discord">Discord: co2_comtudo</p>
            </div>
            <div className="credit-item">
              <p>{t('credits.communityTestersThankYou')}</p>
            </div>
            <p className="acknowledgments-general">{t('credits.acknowledgmentsText')}</p>
          </section>

          <section className="credits-section">
            <h3><i className="fas fa-tools"></i> {t('credits.technologies')}</h3>
            <div className="tech-list">
              <span className="tech-badge">React</span>
              <span className="tech-badge">TypeScript</span>
              <span className="tech-badge">Vite</span>
              <span className="tech-badge">Firebase</span>
            </div>
          </section>

          <section className="credits-section coffee-section">
            <h3><i className="fas fa-coffee"></i> {t('credits.supportTitle')}</h3>
            <p>{t('credits.supportDescription')}</p>
            <div className="pix-container">
              <img src="/images/qr-code-haxlab.jpeg" alt="QR Code Pix" className="pix-qr-code" />
              <div className="pix-key-container">
                <label className="pix-key-label">{t('credits.pixKey')}:</label>
                <div className="pix-key-value">
                  <code>e58a5d43-d893-40f6-b453-64560153593a</code>
                  <button 
                    className="btn-copy-pix"
                    onClick={() => {
                      navigator.clipboard.writeText('e58a5d43-d893-40f6-b453-64560153593a');
                      audioManager.play('menuSelect');
                    }}
                    title={t('credits.copyPixKey')}
                  >
                    <i className="fas fa-copy"></i>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="credits-section">
            <div className="credits-footer">
              <p>{t('credits.madeWith')} <i className="fas fa-heart"></i> {t('credits.forCommunity')}</p>
              <p className="credits-copyright">© 2026 HaxLab - {t('credits.allRightsReserved')}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default CreditsPage;
