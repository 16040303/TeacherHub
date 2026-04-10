import { STORAGE_KEYS } from '../app/config/storage';
import { AppSettings, Language, ThemeMode } from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'en',
};

const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const parseTheme = (theme: unknown): ThemeMode => {
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    return theme;
  }

  return DEFAULT_SETTINGS.theme;
};

const parseLanguage = (language: unknown): Language => {
  if (language === 'en' || language === 'vi') {
    return language;
  }

  return DEFAULT_SETTINGS.language;
};

const readRawSettings = (): AppSettings => {
  if (!isBrowser()) {
    return DEFAULT_SETTINGS;
  }

  const fromSettingsKey = window.localStorage.getItem(STORAGE_KEYS.settings);
  const fallbackTheme = window.localStorage.getItem(STORAGE_KEYS.theme);
  const fallbackLanguage = window.localStorage.getItem(STORAGE_KEYS.language);

  if (!fromSettingsKey) {
    return {
      theme: parseTheme(fallbackTheme),
      language: parseLanguage(fallbackLanguage),
    };
  }

  try {
    const parsed = JSON.parse(fromSettingsKey) as Partial<AppSettings>;
    return {
      theme: parseTheme(parsed.theme ?? fallbackTheme),
      language: parseLanguage(parsed.language ?? fallbackLanguage),
    };
  } catch {
    return {
      theme: parseTheme(fallbackTheme),
      language: parseLanguage(fallbackLanguage),
    };
  }
};

const persistSettings = (settings: AppSettings): void => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  window.localStorage.setItem(STORAGE_KEYS.theme, settings.theme);
  window.localStorage.setItem(STORAGE_KEYS.language, settings.language);
};

const withLatency = async <T>(value: T, delayMs = 80): Promise<T> =>
  new Promise((resolve) => {
    window.setTimeout(() => resolve(value), delayMs);
  });

export const getSettings = async (): Promise<AppSettings> => withLatency(readRawSettings());

export const updateSettings = async (
  patch: Partial<AppSettings>,
): Promise<AppSettings> => {
  const next: AppSettings = {
    ...readRawSettings(),
    ...patch,
  };

  next.theme = parseTheme(next.theme);
  next.language = parseLanguage(next.language);

  persistSettings(next);
  return withLatency(next);
};

export const setThemeSetting = async (theme: ThemeMode): Promise<AppSettings> =>
  updateSettings({ theme });

export const setLanguageSetting = async (
  language: Language,
): Promise<AppSettings> => updateSettings({ language });
