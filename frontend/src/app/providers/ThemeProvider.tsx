import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { settingsService } from '../../services/settingsService';
import { ThemeMode } from '../../types';

type Theme = ThemeMode;

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

interface ThemeProviderState {
  theme: Theme;
  isReady: boolean;
  setTheme: (theme: Theme) => void;
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

const isSupportedTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system';

const normalizeTheme = (value: unknown, fallback: Theme = 'system'): Theme =>
  isSupportedTheme(value) ? value : fallback;

const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'dark' || theme === 'light') {
    return theme;
  }

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
};

const applyThemeToDocument = (theme: Theme): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const body = document.body;
  const resolvedTheme = resolveTheme(theme);

  root.classList.remove('light', 'dark');
  body?.classList.remove('light', 'dark');

  root.classList.add(resolvedTheme);
  body?.classList.add(resolvedTheme);

  root.dataset.theme = theme;
  root.dataset.resolvedTheme = resolvedTheme;
};

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: ThemeProviderProps) {
  const normalizedDefaultTheme = normalizeTheme(defaultTheme);
  const [theme, setThemeState] = useState<Theme>(normalizedDefaultTheme);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      try {
        const settings = await settingsService.getSettings();
        if (!active) {
          return;
        }

        setThemeState(normalizeTheme(settings?.theme, normalizedDefaultTheme));
      } catch {
        if (active) {
          setThemeState(normalizedDefaultTheme);
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
  }, [normalizedDefaultTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    applyThemeToDocument(theme);

    if (theme !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (): void => {
      applyThemeToDocument('system');
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }

    mediaQuery.addListener(handleSystemThemeChange);
    return () => {
      mediaQuery.removeListener(handleSystemThemeChange);
    };
  }, [theme]);

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      const safeTheme = normalizeTheme(nextTheme, normalizedDefaultTheme);
      setThemeState(safeTheme);
      void settingsService.setThemeSetting(safeTheme).catch(() => undefined);
    },
    [normalizedDefaultTheme],
  );

  const value = useMemo(
    () => ({
      theme,
      isReady,
      setTheme,
    }),
    [isReady, setTheme, theme],
  );

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};
