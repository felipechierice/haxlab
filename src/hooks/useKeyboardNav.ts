import { useEffect, useRef, useCallback } from 'react';
import { audioManager } from '../audio';

export interface KeyboardNavOptions {
  onEscape?: () => void;
  selector?: string;
  autoFocus?: boolean;
  onEnter?: (element: HTMLElement) => void;
  initialFocusSelector?: string;
  enabled?: boolean;
}

/**
 * Hook para navegação por teclado em menus e interfaces
 * Suporta: Arrow Keys, Q/E, Tab, Enter/Space para selecionar
 */
export function useKeyboardNav(options: KeyboardNavOptions = {}) {
  const {
    onEscape,
    selector = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
    autoFocus = true,
    onEnter,
    initialFocusSelector,
    enabled = true
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef<number>(0);

  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    const elements = Array.from(
      containerRef.current.querySelectorAll(selector)
    ) as HTMLElement[];
    return elements.filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, [selector]);

  const focusElement = useCallback((index: number) => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const boundedIndex = ((index % elements.length) + elements.length) % elements.length;
    currentIndexRef.current = boundedIndex;
    
    elements[boundedIndex]?.focus();
    elements[boundedIndex]?.scrollIntoView({ 
      block: 'nearest', 
      behavior: 'smooth' 
    });
  }, [getFocusableElements]);

  const navigate = useCallback((direction: 'up' | 'down' | 'next' | 'prev') => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const currentElement = document.activeElement as HTMLElement;
    const currentIndex = elements.indexOf(currentElement);
    
    if (currentIndex !== -1) {
      currentIndexRef.current = currentIndex;
    }

    let newIndex = currentIndexRef.current;

    switch (direction) {
      case 'down':
      case 'next':
        newIndex = currentIndexRef.current + 1;
        break;
      case 'up':
      case 'prev':
        newIndex = currentIndexRef.current - 1;
        break;
    }

    const boundedNew = ((newIndex % elements.length) + elements.length) % elements.length;
    if (boundedNew !== currentIndexRef.current || currentIndex === -1) {
      audioManager.play('menuNav');
    }
    focusElement(newIndex);
  }, [getFocusableElements, focusElement]);

  const handleActivate = useCallback((element?: HTMLElement) => {
    const targetElement = element || (document.activeElement as HTMLElement);
    
    if (onEnter) {
      onEnter(targetElement);
      return;
    }

    if (targetElement instanceof HTMLButtonElement) {
      targetElement.click();
    } else if (targetElement instanceof HTMLInputElement) {
      // Para inputs, não fazer nada (deixar o comportamento padrão)
      return;
    } else if (targetElement instanceof HTMLSelectElement) {
      // Para selects, abrir o dropdown
      targetElement.focus();
    } else if (targetElement instanceof HTMLAnchorElement) {
      targetElement.click();
    } else if (targetElement.hasAttribute('tabindex')) {
      targetElement.click();
    }
  }, [onEnter]);

  useEffect(() => {
    // Não adicionar listeners se o hook estiver desabilitado
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // ESC sempre volta
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        audioManager.play('menuBack');
        onEscape();
        return;
      }

      // Backspace volta, MAS não se estiver num input
      if (e.key === 'Backspace' && !isInput && onEscape) {
        e.preventDefault();
        audioManager.play('menuBack');
        onEscape();
        return;
      }

      // Se está em um input de texto, não interceptar algumas teclas
      if (isInput && target instanceof HTMLInputElement && target.type === 'text') {
        // Permitir navegação apenas com Tab, Escape e Enter
        if (!['Tab', 'Escape', 'Enter'].includes(e.key)) {
          return;
        }
      }

      // Se está em um slider (input range), permitir setas horizontais e A/D para controlar o valor
      const isRangeInput = target instanceof HTMLInputElement && target.type === 'range';
      if (isRangeInput && ['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) {
        // Não interceptar - deixar o comportamento padrão do slider
        // Para A/D, simular comportamento das setas
        if (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'd') {
          e.preventDefault();
          const step = parseFloat(target.step) || 1;
          const min = parseFloat(target.min) || 0;
          const max = parseFloat(target.max) || 100;
          let value = parseFloat(target.value) || 0;
          
          if (e.key.toLowerCase() === 'a') {
            value = Math.max(min, value - step);
          } else {
            value = Math.min(max, value + step);
          }
          
          target.value = String(value);
          target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return;
      }

      // Navegação com setas verticais e WASD
      if (e.key === 'ArrowDown' || (e.key.toLowerCase() === 's' && !isInput)) {
        e.preventDefault();
        navigate('down');
      } else if (e.key === 'ArrowUp' || (e.key.toLowerCase() === 'w' && !isInput)) {
        e.preventDefault();
        navigate('up');
      }
      // Navegação com setas horizontais e WASD (para sliders e selects)
      else if (e.key === 'ArrowLeft' || (e.key.toLowerCase() === 'a' && !isInput)) {
        e.preventDefault();
        navigate('prev');
      } else if (e.key === 'ArrowRight' || (e.key.toLowerCase() === 'd' && !isInput)) {
        e.preventDefault();
        navigate('next');
      }
      // Navegação com Q e E
      else if (e.key.toLowerCase() === 'q' && !isInput) {
        e.preventDefault();
        navigate('prev');
      } else if (e.key.toLowerCase() === 'e' && !isInput) {
        e.preventDefault();
        navigate('next');
      }
      // Tab (sem shift = próximo, com shift = anterior)
      else if (e.key === 'Tab') {
        e.preventDefault();
        navigate(e.shiftKey ? 'prev' : 'next');
      }
      // Enter ou Space para ativar elemento focado
      else if ((e.key === 'Enter' || e.key === ' ') && !isInput) {
        e.preventDefault();
        audioManager.play('menuSelect');
        handleActivate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, navigate, handleActivate, onEscape]);

  // Auto-focus no primeiro elemento ao montar
  useEffect(() => {
    if (autoFocus) {
      // Pequeno delay para garantir que os elementos estão renderizados
      setTimeout(() => {
        if (initialFocusSelector && containerRef.current) {
          const targetElement = containerRef.current.querySelector(initialFocusSelector) as HTMLElement;
          if (targetElement) {
            targetElement.focus();
            targetElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            const elements = getFocusableElements();
            const index = elements.indexOf(targetElement);
            if (index !== -1) {
              currentIndexRef.current = index;
            }
            return;
          }
        }
        
        const elements = getFocusableElements();
        if (elements.length > 0) {
          focusElement(0);
        }
      }, 100);
    }
  }, [autoFocus, getFocusableElements, focusElement, initialFocusSelector]);

  return {
    containerRef,
    navigate,
    focusElement,
    getFocusableElements
  };
}
