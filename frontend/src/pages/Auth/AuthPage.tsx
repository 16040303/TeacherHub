import React, { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Loader2, LogIn, UserPlus } from 'lucide-react';
import type { AuthProvider as ExternalAuthProvider } from '../../types';
import { useAuth } from '../../app/providers/AuthProvider';
import { useLanguage } from '../../app/providers/LanguageProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { getDefaultAuthenticatedPath, resolvePostAuthRedirect } from '../../services/authService';
import { isAppError } from '../../utils/api-error';

type AuthMode = 'login' | 'register' | 'forgot';

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [providerLoading, setProviderLoading] = useState<ExternalAuthProvider | null>(null);

  const { login, loginWithProvider, register, forgotPassword } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const resetForm = (): void => {
    setName('');
    setEmail('');
    setPassword('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      if (mode === 'login') {
        const session = await login({ email, password });
        showToast({ type: 'success', message: t('auth.welcomeBack') });

        const destination = resolvePostAuthRedirect({
          search: location.search,
          role: session.user.role,
        });
        navigate(destination, { replace: true });
        return;
      }

      if (mode === 'register') {
        const session = await register({ name, email, password });
        showToast({ type: 'success', message: t('auth.accountCreated') });
        navigate(getDefaultAuthenticatedPath(session.user.role), { replace: true });
        return;
      }

      const found = await forgotPassword(email);
      showToast({
        type: 'info',
        message: found
          ? t('auth.resetInstructions')
          : t('auth.resetInstructionsGeneric'),
      });
      setMode('login');
      setPassword('');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isAppError(error)
            ? error.message
            : t('auth.unableToComplete');
      showToast({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleProviderSignIn = async (provider: ExternalAuthProvider): Promise<void> => {
    if (submitting || providerLoading) {
      return;
    }

    setProviderLoading(provider);

    try {
      const session = await loginWithProvider(provider);
      showToast({
        type: 'success',
        message:
          provider === 'google'
            ? t('auth.signInProviderSuccess', { provider: 'Google' })
            : t('auth.signInProviderSuccess', { provider: 'Apple' }),
      });

      const destination = resolvePostAuthRedirect({
        search: location.search,
        role: session.user.role,
      });
      navigate(destination, { replace: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isAppError(error)
            ? error.message
            : t('auth.unableToSignInProvider');
      showToast({ type: 'error', message });
    } finally {
      setProviderLoading(null);
    }
  };


  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-12 pt-4">
      <Link
        to="/"
        className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-primary"
      >
        <ArrowLeft size={16} /> {t('auth.backToHome')}
      </Link>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight">
            {mode === 'login' && t('auth.loginTitle')}
            {mode === 'register' && t('auth.registerTitle')}
            {mode === 'forgot' && t('auth.forgotTitle')}
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {mode === 'login' && t('auth.loginSubtitle')}
            {mode === 'register' && t('auth.registerSubtitle')}
            {mode === 'forgot' && t('auth.forgotSubtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {mode === 'login' ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  void handleProviderSignIn('google');
                }}
                disabled={submitting || Boolean(providerLoading)}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {providerLoading === 'google' ? <Loader2 size={16} className="animate-spin" /> : null}
                {t('auth.continueWithGoogle')}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleProviderSignIn('apple');
                }}
                disabled={submitting || Boolean(providerLoading)}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {providerLoading === 'apple' ? <Loader2 size={16} className="animate-spin" /> : null}
                {t('auth.continueWithApple')}
              </button>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  {t('auth.orContinueWithEmail')}
                </span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          ) : null}

          {mode === 'register' ? (
            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('auth.fullName')}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800"
                placeholder={t('auth.yourFullNamePlaceholder')}
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('auth.email')}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800"
              placeholder={t('auth.emailPlaceholder')}
            />
          </label>

          {mode !== 'forgot' ? (
            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('auth.password')}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800"
                placeholder={t('auth.passwordPlaceholder')}
              />
            </label>
          ) : null}

          <button
            type="submit"
            disabled={submitting || Boolean(providerLoading)}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover disabled:opacity-60"
          >
            {mode === 'login' ? <LogIn size={16} /> : null}
            {mode === 'register' ? <UserPlus size={16} /> : null}
            {mode === 'forgot' ? <KeyRound size={16} /> : null}
            {submitting ? t('common.pleaseWait') : mode === 'login' ? t('auth.submitLogin') : mode === 'register' ? t('auth.submitRegister') : t('auth.submitForgot')}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
          {mode !== 'login' ? (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                resetForm();
              }}
              className="rounded-lg bg-slate-100 px-3 py-1.5 transition hover:text-primary dark:bg-slate-800"
            >
              {t('auth.switchToLogin')}
            </button>
          ) : null}
          {mode !== 'register' ? (
            <button
              type="button"
              onClick={() => {
                setMode('register');
                resetForm();
              }}
              className="rounded-lg bg-slate-100 px-3 py-1.5 transition hover:text-primary dark:bg-slate-800"
            >
              {t('auth.switchToRegister')}
            </button>
          ) : null}
          {mode !== 'forgot' ? (
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setPassword('');
              }}
              className="rounded-lg bg-slate-100 px-3 py-1.5 transition hover:text-primary dark:bg-slate-800"
            >
              {t('auth.forgotPassword')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
