import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { settingsService } from '../../services/settingsService';
import { Language } from '../../types';
import { translations, TranslationKey } from '../i18n/translations';

type TranslateValue = string | number | boolean | null | undefined;

type TranslateValues = Record<string, TranslateValue>;

interface TranslateOptions {
  values?: TranslateValues;
  [key: string]: TranslateValue | TranslateValues | undefined;
}

interface LanguageContextValue {
  language: Language;
  isReady: boolean;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: TranslationKey | string, options?: TranslateOptions) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const isSupportedLanguage = (value: unknown): value is Language =>
  value === 'en' || value === 'vi';

const normalizeLanguage = (value: unknown, fallback: Language = 'en'): Language =>
  isSupportedLanguage(value) ? value : fallback;

const getFallbackTranslation = (key: string): string => {
  const table = translations.en as Record<string, string>;
  return table[key] ?? key;
};

const resolveInterpolationValues = (options?: TranslateOptions): TranslateValues | undefined => {
  if (!options) {
    return undefined;
  }

  if (options.values) {
    return options.values;
  }

  const entries = Object.entries(options).filter(([entryKey]) => entryKey !== 'values');
  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries) as TranslateValues;
};

const formatTemplate = (template: string, values: TranslateValues): string =>
  Object.entries(values).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, String(value)),
    template,
  );

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      try {
        const settings = await settingsService.getSettings();
        if (!active) {
          return;
        }

        setLanguageState(normalizeLanguage(settings?.language, 'en'));
      } catch {
        if (active) {
          setLanguageState('en');
        }
      } finally {
        if (active) {
          setIsReady(true);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.lang = normalizeLanguage(language, 'en');
  }, [language]);

  const setLanguage = useCallback(
    async (nextLanguage: Language): Promise<void> => {
      const safeLanguage = normalizeLanguage(nextLanguage, language);
      if (safeLanguage === language) {
        return;
      }

      const previousLanguage = language;
      setLanguageState(safeLanguage);

      try {
        await settingsService.setLanguageSetting(safeLanguage);
      } catch (error) {
        setLanguageState(previousLanguage);
        throw error;
      }
    },
    [language],
  );

  const t = useCallback(
    (key: TranslationKey | string, options?: TranslateOptions): string => {
      const table = translations[normalizeLanguage(language, 'en')] as Record<string, string>;
      const template = table[key] ?? getFallbackTranslation(key);
      const interpolationValues = resolveInterpolationValues(options);
      if (interpolationValues) {
        return formatTemplate(template, interpolationValues);
      }
      return template;
    },
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      isReady,
      setLanguage,
      t,
    }),
    [language, isReady, setLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
};
