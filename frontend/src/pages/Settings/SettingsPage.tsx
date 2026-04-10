import React, { useMemo, useState } from 'react';
import {
  Globe2,
  LogOut,
  MonitorCog,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { useLanguage } from '../../app/providers/LanguageProvider';
import { useTheme } from '../../app/providers/ThemeProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { LoadingState } from '../../components/common/LoadingState';
import { Language, ThemeMode } from '../../types';

const THEME_OPTIONS: Array<{ value: ThemeMode; icon: React.ReactNode }> = [
  { value: 'light', icon: <Sun size={16} /> },
  { value: 'dark', icon: <Moon size={16} /> },
  { value: 'system', icon: <MonitorCog size={16} /> },
];

const LANGUAGE_OPTIONS: Language[] = ['en', 'vi'];

const THEME_LABEL_KEY: Record<ThemeMode, string> = {
  light: 'common.light',
  dark: 'common.dark',
  system: 'common.system',
};

const LANGUAGE_LABEL_KEY: Record<Language, string> = {
  en: 'common.english',
  vi: 'common.vietnamese',
};

const isSupportedTheme = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system';

const isSupportedLanguage = (value: unknown): value is Language =>
  value === 'en' || value === 'vi';

const formatTemplate = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, value),
    template,
  );

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme, isReady: themeReady } = useTheme();
  const { language, setLanguage, isReady: languageReady, t } = useLanguage();
  const { showToast } = useToast();

  const [savingLanguage, setSavingLanguage] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const accountSummary = useMemo(
    () => [
      {
        label: t('settings.label.name'),
        value: user?.name?.trim() || t('settings.value.unknownUser'),
      },
      {
        label: t('settings.label.email'),
        value: user?.email?.trim() || t('settings.value.notAvailable'),
      },
      {
        label: t('settings.label.role'),
        value: user?.role ?? t('settings.value.guest'),
      },
      {
        label: t('settings.label.status'),
        value: user?.status ?? t('settings.value.active'),
      },
    ],
    [t, user],
  );

  const handleThemeChange = (nextTheme: ThemeMode): void => {
    if (!isSupportedTheme(nextTheme) || theme === nextTheme) {
      return;
    }

    setTheme(nextTheme);
    const themeLabel = t(THEME_LABEL_KEY[nextTheme]);
    showToast({
      type: 'success',
      message: formatTemplate(t('settings.toast.themeUpdated'), { theme: themeLabel }),
    });
  };

  const handleLanguageChange = async (nextLanguage: Language): Promise<void> => {
    if (!isSupportedLanguage(nextLanguage) || language === nextLanguage || savingLanguage) {
      return;
    }

    setSavingLanguage(true);
    try {
      await setLanguage(nextLanguage);
      showToast({ type: 'success', message: t('settings.toast.languageUpdated') });
    } catch {
      showToast({ type: 'error', message: t('settings.toast.languageError') });
    } finally {
      setSavingLanguage(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    try {
      await logout();
      showToast({ type: 'success', message: t('settings.toast.logoutSuccess') });
      navigate('/');
    } catch {
      showToast({ type: 'error', message: t('settings.toast.logoutError') });
    } finally {
      setLoggingOut(false);
    }
  };

  if (!themeReady || !languageReady) {
    return (
      <LoadingState
        title={t('common.loading')}
        description="Syncing your account preferences and personalization options..."
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-16">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{t('settings.title')}</h1>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          {t('settings.subtitle')}
        </p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-5 text-lg font-black tracking-tight">{t('settings.appearance')}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {THEME_OPTIONS.map((option) => {
            const selected = option.value === theme;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleThemeChange(option.value)}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                  selected
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-slate-200 hover:border-primary dark:border-slate-700'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {option.icon}
                  {t(THEME_LABEL_KEY[option.value])}
                </span>
                {selected ? <ShieldCheck size={16} /> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-5 text-lg font-black tracking-tight">{t('settings.language')}</h2>
        <div className="flex flex-wrap gap-3">
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              disabled={savingLanguage}
              onClick={() => {
                void handleLanguageChange(option);
              }}
              className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition ${
                language === option
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-slate-200 hover:border-primary dark:border-slate-700'
              } disabled:opacity-70`}
            >
              <Globe2 size={16} />
              {t(LANGUAGE_LABEL_KEY[option])}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-lg font-black tracking-tight">{t('settings.account')}</h2>
          <ul className="space-y-3">
            {accountSummary.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60"
              >
                <span className="font-semibold text-slate-500 dark:text-slate-400">{row.label}</span>
                <span className="font-bold capitalize">{row.value}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-lg font-black tracking-tight">{t('settings.quickActions')}</h2>
          <div className="grid gap-3">
            <Link
              to="/profile"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold transition hover:border-primary dark:border-slate-700"
            >
              <UserRound size={16} /> {t('settings.action.editProfile')}
            </Link>
            <Link
              to="/orders"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold transition hover:border-primary dark:border-slate-700"
            >
              <Globe2 size={16} /> {t('settings.action.viewOrders')}
            </Link>
            {user?.role === 'admin' ? (
              <Link
                to="/admin"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold transition hover:border-primary dark:border-slate-700"
              >
                <ShieldCheck size={16} /> {t('settings.action.openAdmin')}
              </Link>
            ) : null}
            <button
              type="button"
              disabled={loggingOut}
              onClick={() => {
                void handleLogout();
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-bold text-white transition hover:bg-rose-600 disabled:opacity-70"
            >
              <LogOut size={16} />
              {loggingOut ? t('settings.action.loggingOut') : t('settings.action.logOut')}
            </button>
          </div>
        </article>
      </section>
    </div>
  );
};
