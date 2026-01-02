import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  Language,
  translations,
  getNestedValue,
  interpolate,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
} from '@/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Check localStorage for saved language preference
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'de' || saved === 'ru') {
      return saved;
    }
    // Default to German (DE) as PRIMARY language
    return DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    // Save language preference to localStorage
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    // Update document lang attribute
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const translation = getNestedValue(
        translations[language] as unknown as Record<string, unknown>,
        key
      );
      
      if (params) {
        return interpolate(translation, params);
      }
      
      return translation;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Shorthand hook for translation function only
export function useTranslation() {
  const { t, language } = useLanguage();
  return { t, language };
}
