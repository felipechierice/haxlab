import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';
import { audioManager } from '../audio';
import { trackPageView } from '../analytics';
import { GAME_VERSION } from '../version';
import '../styles/ChangelogsPage.css';

interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: 'feature' | 'improvement' | 'bugfix' | 'breaking';
    text: {
      en: string;
      pt: string;
      es: string;
    };
  }[];
}

const changelogs: ChangelogEntry[] = [
  {
    version: '0.1.3-alpha',
    date: '2026-02-19',
    changes: [
      {
        type: 'feature',
        text: {
          en: 'Added duplicate scenario button in playlist editor',
          pt: 'Adicionado botão de duplicar cenário no editor de playlists',
          es: 'Agregado botón de duplicar escenario en el editor de playlists'
        }
      },
      {
        type: 'feature',
        text: {
          en: 'Added mirror scenario feature (vertical, horizontal, diagonal) in playlist editor',
          pt: 'Adicionada função de espelhar cenário (vertical, horizontal, diagonal) no editor de playlists',
          es: 'Agregada función de espejo de escenario (vertical, horizontal, diagonal) en el editor de playlists'
        }
      }
    ]
  },
  {
    version: '0.1.2-alpha',
    date: '2026-02-18',
    changes: [
      {
        type: 'bugfix',
        text: {
          en: 'Fixed kick input delay caused by fixed timestep timing',
          pt: 'Corrigido delay no chute causado pelo timing do fixed timestep',
          es: 'Corregido retraso en el pateo causado por el timing del fixed timestep'
        }
      }
    ]
  },
  {
    version: '0.1.1-alpha',
    date: '2026-02-18',
    changes: [
      {
        type: 'feature',
        text: {
          en: 'Added control indicator opacity setting',
          pt: 'Adicionada configuração de opacidade do círculo de controle',
          es: 'Agregada configuración de opacidad del círculo de control'
        }
      },
      {
        type: 'improvement',
        text: {
          en: 'Adjusted default ball physics (bounce: 0.45, player restitution: 0.30)',
          pt: 'Ajustados valores padrão da bola (quique: 0.45, restituição: 0.30)',
          es: 'Ajustados valores predeterminados del balón (rebote: 0.45, restitución: 0.30)'
        }
      }
    ]
  },
  {
    version: '0.1.0-alpha',
    date: '2026-02-16',
    changes: [
      {
        type: 'feature',
        text: {
          en: 'Community training playlists with publishing from editor',
          pt: 'Playlists de treino da comunidade com publicação pelo editor',
          es: 'Listas de entrenamiento de la comunidad con publicación desde el editor'
        }
      },
      {
        type: 'feature',
        text: {
          en: 'Extrapolation simulation system',
          pt: 'Sistema de simulação de extrapolation',
          es: 'Sistema de simulación de extrapolación'
        }
      },
      {
        type: 'bugfix',
        text: {
          en: 'Fixed bot kick force calculation with kickOnContact',
          pt: 'Corrigido cálculo de força do chute dos bots com kickOnContact',
          es: 'Corregido cálculo de fuerza del pateo de los bots con kickOnContact'
        }
      }
    ]
  },
  {
    version: '0.0.1-alpha',
    date: '2026-02-15',
    changes: [
      {
        type: 'feature',
        text: {
          en: 'Added Credits page',
          pt: 'Adicionada página de Créditos',
          es: 'Agregada página de Créditos'
        }
      },
      {
        type: 'feature',
        text: {
          en: 'Added Changelogs page',
          pt: 'Adicionada página de Changelogs',
          es: 'Agregada página de Cambios'
        }
      },
      {
        type: 'feature',
        text: {
          en: 'Version display on home page',
          pt: 'Versão exibida na página inicial',
          es: 'Versión mostrada en la página de inicio'
        }
      },
      {
        type: 'feature',
        text: {
          en: 'Buy me a coffee button',
          pt: 'Botão "Me pague um café"',
          es: 'Botón "Cómprame un café"'
        }
      }
    ]
  },
  {
    version: '0.0.0-alpha',
    date: '2026-02-14',
    changes: [
      {
        type: 'feature',
        text: {
          en: 'Initial playlist system implementation',
          pt: 'Implementação inicial do sistema de playlists',
          es: 'Implementación inicial del sistema de listas'
        }
      },
      {
        type: 'improvement',
        text: {
          en: 'Enhanced keyboard navigation',
          pt: 'Navegação por teclado aprimorada',
          es: 'Navegación por teclado mejorada'
        }
      }
    ]
  }
];

function ChangelogsPage() {
  const navigate = useNavigate();
  const { t, language } = useI18n();

  useEffect(() => { trackPageView('ChangelogsPage'); }, []);

  const handleBack = () => {
    audioManager.play('menuBack');
    navigate('/');
  };

  const { containerRef } = useKeyboardNav({
    onEscape: handleBack,
    autoFocus: true,
    initialFocusSelector: '.btn-back'
  });

  const getChangeTypeIcon = (type: string) => {
    switch (type) {
      case 'feature': return 'fa-star';
      case 'improvement': return 'fa-arrow-up';
      case 'bugfix': return 'fa-bug';
      case 'breaking': return 'fa-exclamation-triangle';
      default: return 'fa-circle';
    }
  };

  const getChangeTypeLabel = (type: string) => {
    return t(`changelogs.types.${type}`);
  };

  return (
    <div className="changelogs-page">
      <div className="changelogs-container" ref={containerRef}>
        <div className="changelogs-header">
          <h2>
            <i className="fas fa-history"></i> {t('changelogs.title')}
          </h2>
          <button className="btn-back-changelogs" onClick={handleBack}>
            <i className="fas fa-arrow-left"></i> {t('changelogs.back')}
          </button>
        </div>

        <div className="changelogs-current-version">
          <i className="fas fa-code-branch"></i> {t('changelogs.currentVersion')}: <strong>{GAME_VERSION}</strong>
        </div>

        <div className="changelogs-content">
          {changelogs.map((entry, index) => (
            <div 
              key={entry.version} 
              className={`changelog-entry ${index === 0 ? 'latest' : ''}`}
            >
              <div className="changelog-header">
                <h3>
                  <i className="fas fa-tag"></i> {entry.version}
                  {index === 0 && <span className="badge-latest">{t('changelogs.latest')}</span>}
                </h3>
                <span className="changelog-date">
                  <i className="far fa-calendar-alt"></i> {new Date(entry.date).toLocaleDateString(language)}
                </span>
              </div>
              <ul className="changelog-changes">
                {entry.changes.map((change, changeIndex) => (
                  <li key={changeIndex} className={`change-item change-${change.type}`}>
                    <span className="change-icon">
                      <i className={`fas ${getChangeTypeIcon(change.type)}`}></i>
                    </span>
                    <span className="change-type">{getChangeTypeLabel(change.type)}:</span>
                    <span className="change-text">{change.text[language]}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ChangelogsPage;
