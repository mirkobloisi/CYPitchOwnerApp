import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { LanguageCode, translations } from './translations';

// Stores which language the owner picked and translates the app's text.
// AsyncStorage-only, device-local — deliberately NOT synced to Supabase,
// unlike the User App's per-account preference. Each device remembers its
// own choice.
export type AppLanguage = LanguageCode;

export const LANGUAGE_OPTIONS: { code: AppLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'el', label: 'Ελληνικά' },
  { code: 'ru', label: 'Русский' },
];

const STORAGE_KEY = 'cypitch_owner_language';
const DEFAULT_LANGUAGE: AppLanguage = 'en';

type LanguageContextValue = {
  language: AppLanguage;
  isReady: boolean;
  setLanguage: (lang: AppLanguage) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  /** For list-shaped entries (e.g. weekday/month names) rather than strings. */
  tList: (path: string) => string[];
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function isValidLanguage(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'el' || value === 'ru';
}

function getByPath(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      source
    );
}

function interpolate(text: string, params?: Record<string, string | number>) {
  if (!params) {
    return text;
  }

  return Object.keys(params).reduce(
    (result, key) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(params[key])),
    text
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(DEFAULT_LANGUAGE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (isMounted && isValidLanguage(stored)) {
        setLanguageState(stored);
      }
      if (isMounted) {
        setIsReady(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const setLanguage = useCallback((lang: AppLanguage) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  }, []);

  const t = useCallback(
    (path: string, params?: Record<string, string | number>) => {
      const value =
        getByPath(translations[language], path) ?? getByPath(translations.en, path);

      if (typeof value !== 'string') {
        return path;
      }

      return interpolate(value, params);
    },
    [language]
  );

  const tList = useCallback(
    (path: string) => {
      const value = getByPath(translations[language], path) ?? getByPath(translations.en, path);
      return Array.isArray(value) ? (value as string[]) : [];
    },
    [language]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ language, isReady, setLanguage, t, tList }),
    [language, isReady, setLanguage, t, tList]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}

/** Backward-compatible alias — some screens still import useLanguage(). */
export function useLanguage() {
  return useTranslation();
}
