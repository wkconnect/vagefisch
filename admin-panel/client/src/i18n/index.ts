import de from './de.json';
import ru from './ru.json';

export type Language = 'de' | 'ru';

export const languages: Record<Language, { name: string; flag: string }> = {
  de: { name: 'Deutsch', flag: '🇩🇪' },
  ru: { name: 'Русский', flag: '🇷🇺' },
};

export const translations = {
  de,
  ru,
} as const;

export type TranslationKeys = typeof de;

// Helper function to get nested translation value
export function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path; // Return the key if not found
    }
  }
  
  return typeof current === 'string' ? current : path;
}

// Helper function to interpolate variables in translation strings
export function interpolate(str: string, params: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key]?.toString() ?? `{${key}}`;
  });
}

export const DEFAULT_LANGUAGE: Language = 'de';
export const LANGUAGE_STORAGE_KEY = 'vagefisch-language';
