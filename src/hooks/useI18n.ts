import { useState, useEffect } from 'react';
import { i18n, Language } from '../i18n.js';

/**
 * Hook para integração do sistema de i18n com React
 */
export function useI18n() {
  const [language, setLanguage] = useState<Language>(i18n.getLanguage());

  useEffect(() => {
    // Listener para atualizar quando o idioma mudar
    const handleLanguageChange = () => {
      setLanguage(i18n.getLanguage());
    };

    i18n.onChange(handleLanguageChange);
  }, []);

  const t = (key: string): string => {
    return i18n.t(key);
  };

  const changeLanguage = (lang: Language) => {
    i18n.setLanguage(lang);
    setLanguage(lang);
  };

  return {
    language,
    t,
    changeLanguage
  };
}
