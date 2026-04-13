import React, { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, KeyRound, Loader2, LogIn, Mail, UserPlus } from 'lucide-react';
import type { AuthProvider as ExternalAuthProvider } from '../../types';
import { useAuth } from '../../app/providers/AuthProvider';
import { useLanguage } from '../../app/providers/LanguageProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { getDefaultAuthenticatedPath, resolvePostAuthRedirect } from '../../services/authService';
import { isAppError } from '../../utils/api-error';

type AuthMode = 'login' | 'register' | 'forgot';

const GOOGLE_SIGN_IN_TIMEOUT_MS = 60_000;
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';

const requestGoogleIdToken = (): Promise<string> =>
  new Promise((resolve, reject) => {
    console.info('[Google Login][UI] Google sign-in flow started', {
      hasClientId: Boolean(googleClientId),
      clientIdSuffix: googleClientId ? googleClientId.slice(-16) : null,
    });

    if (!googleClientId) {
      console.error('[Google Login][UI] VITE_GOOGLE_CLIENT_ID is not set or empty');
      reject(new Error('Google Sign-In is not configured.'));
      return;
    }

    const googleApi = window.google?.accounts?.id;
    console.info('[Google Login][UI] GIS availability check', {
      hasGoogleObject: Boolean(window.google),
      hasAccountsNamespace: Boolean(window.google?.accounts),
      hasGoogleIdApi: Boolean(googleApi),
    });

    if (!googleApi) {
      console.error(
        '[Google Login][UI] window.google?.accounts?.id is undefined — GIS script may not have loaded',
      );
      reject(new Error('Google Sign-In is unavailable. Please refresh and try again.'));
      return;
    }

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      console.error('[Google Login][UI] Flow timed out before credential callback');
      reject(new Error('Google sign-in timed out. Please try again.'));
    }, GOOGLE_SIGN_IN_TIMEOUT_MS);

    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      callback();
    };

    try {
      googleApi.initialize({
        client_id: googleClientId,
        ux_mode: 'popup',
        callback: (response) => {
          const credential =
            typeof response.credential === 'string' ? response.credential.trim() : '';

          console.info('[Google Login][UI] GIS credential callback fired', {
            hasCredential: Boolean(credential),
            credentialLength: credential.length,
          });

          if (!credential) {
            settle(() => {
              console.error('[Google Login][UI] GIS callback returned empty credential');
              reject(new Error('Google did not return an ID token. Please try again.'));
            });
            return;
          }

          settle(() => resolve(credential));
        },
      });
      console.info('[Google Login][UI] google.accounts.id.initialize completed');
    } catch (err) {
      console.error('[Google Login][UI] googleApi.initialize threw:', err);
      reject(new Error('Google Sign-In failed to initialize. Please refresh and try again.'));
      return;
    }

    googleApi.prompt((notification) => {
      if (settled) {
        return;
      }

      const isNotDisplayed = notification?.isNotDisplayed?.() ?? false;
      const notDisplayedReason = notification?.getNotDisplayedReason?.() ?? null;
      const isSkippedMoment = notification?.isSkippedMoment?.() ?? false;
      const skippedReason = notification?.getSkippedReason?.() ?? null;
      const isDismissedMoment = notification?.isDismissedMoment?.() ?? false;
      const dismissedReason = notification?.getDismissedReason?.() ?? null;

      console.info('[Google Login][UI] GIS prompt callback fired', {
        isNotDisplayed,
        notDisplayedReason,
        isSkippedMoment,
        skippedReason,
        isDismissedMoment,
        dismissedReason,
      });

      if (isNotDisplayed) {
        const reason = notDisplayedReason ?? 'unknown';
        console.error(`[Google Login][UI] Popup not displayed. Reason: ${reason}`);
        settle(() =>
          reject(new Error('Google Sign-In is currently unavailable. Please try again.')),
        );
        return;
      }

      if (isSkippedMoment) {
        settle(() => reject(new Error('Google sign-in was cancelled.')));
        return;
      }

      if (isDismissedMoment && dismissedReason !== 'credential_returned') {
        settle(() => reject(new Error('Google sign-in was dismissed.')));
      }
    });
  });

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [providerLoading, setProviderLoading] = useState<ExternalAuthProvider | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendingVerification, setResendingVerification] = useState(false);

  const { login, loginWithProvider, register, forgotPassword, resendVerification } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const resetForm = (): void => {
    setName('');
    setEmail('');
    setPassword('');
    setRegistrationSuccess(false);
    setRegisteredEmail('');
  };

  const handleResendVerification = async (targetEmail: string): Promise<void> => {
    if (resendingVerification) return;
    setResendingVerification(true);

    try {
      const result = await resendVerification(targetEmail);
      showToast({ type: 'success', message: result.message });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isAppError(error)
            ? error.message
            : 'Unable to resend verification email.';
      showToast({ type: 'error', message });
    } finally {
      setResendingVerification(false);
    }
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
        await register({ name, email, password });
        // Do NOT auto-login — show verification message
        setRegisteredEmail(email);
        setRegistrationSuccess(true);
        return;
      }

      const forgotResult = await forgotPassword(email);
      showToast({
        type: 'info',
        message: forgotResult.message || t('auth.resetInstructionsGeneric'),
      });
      setMode('login');
      setPassword('');
    } catch (error) {
      const statusCode =
        isAppError(error)
          ? error.statusCode
          : undefined;
      const message =
        error instanceof Error
          ? error.message
          : isAppError(error)
            ? error.message
            : t('auth.unableToComplete');

      // Handle unverified email error on login
      if (mode === 'login' && statusCode === 403) {
        showToast({ type: 'info', message });
        return;
      }

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
      const providerPayload =
        provider === 'google'
          ? { provider, idToken: await requestGoogleIdToken() }
          : { provider };

      const session = await loginWithProvider(providerPayload);
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
      console.error('[Google Login] Login failed:', {
        error: error instanceof Error ? error.message : String(error),
        statusCode: isAppError(error) ? error.statusCode : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      });
      showToast({ type: 'error', message });
    } finally {
      setProviderLoading(null);
    }
  };

  // Registration success state
  if (registrationSuccess) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-12 pt-4">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-primary"
        >
          <ArrowLeft size={16} /> {t('auth.backToHome')}
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              Check your email
            </h1>
            <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              We've sent a verification link to{' '}
              <strong className="text-slate-700 dark:text-slate-200">{registeredEmail}</strong>.
              <br />
              Please check your inbox and click the link to verify your account.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              The link expires in 24 hours. Check your spam folder if you don't see it.
            </p>

            <div className="mt-4 flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={() => void handleResendVerification(registeredEmail)}
                disabled={resendingVerification}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <Mail size={16} />
                {resendingVerification ? 'Sending...' : 'Resend verification email'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  resetForm();
                }}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover"
              >
                <LogIn size={16} /> Go to login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                minLength={8}
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
