import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { translations } from '../translations';

type Language = 'en' | 'id';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, ...args: any[]) => string;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// FIX: Changed component signature to use React.FC and an interface for props for better type consistency and to resolve potential tooling issues.
interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const savedLang = localStorage.getItem('language') as Language;
      return savedLang && (savedLang === 'en' || savedLang === 'id') ? savedLang : 'en';
    } catch (error) {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('language', language);
    } catch (error) {
      console.error("Could not save language to localStorage", error);
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = useCallback((key: string, ...args: any[]) => {
    const translationSet = translations[language] || translations.en;
    const translation = (translationSet as any)[key];
    if (typeof translation === 'function') {
      return translation(...args);
    }
    return translation || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
