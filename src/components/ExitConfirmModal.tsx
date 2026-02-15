import { useEffect } from 'react';
import { useI18n } from '../hooks/useI18n';
import { useKeyboardNav } from '../hooks/useKeyboardNav';

interface ExitConfirmModalProps {
  isOpen: boolean;
  isPlaylist: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ExitConfirmModal({ isOpen, isPlaylist, onConfirm, onCancel }: ExitConfirmModalProps) {
  const { t } = useI18n();

  const { containerRef } = useKeyboardNav({
    onEscape: onCancel,
    autoFocus: isOpen,
    initialFocusSelector: '.btn-exit-confirm',
    enabled: isOpen
  });

  // Prevenir scroll do body quando modal está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="exit-confirm-overlay" onClick={onCancel}>
      <div 
        className="exit-confirm-modal" 
        onClick={e => e.stopPropagation()}
        ref={containerRef}
      >
        <h2>{isPlaylist ? t('game.exitPlaylistTitle') : t('game.exitConfirmTitle')}</h2>
        <p>{isPlaylist ? t('game.exitPlaylistMessage') : t('game.exitConfirmMessage')}</p>
        <div className="exit-confirm-buttons">
          <button className="btn-exit-confirm" onClick={onConfirm}>
            <i className="fas fa-sign-out-alt"></i> {t('game.exitYes')}
          </button>
          <button className="btn-exit-cancel" onClick={onCancel}>
            {t('game.exitNo')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExitConfirmModal;
