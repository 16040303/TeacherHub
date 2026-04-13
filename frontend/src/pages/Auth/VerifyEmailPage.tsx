import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Loader2, LogIn, Mail } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { isAppError } from '../../utils/api-error';

type VerifyState = 'loading' | 'success' | 'error';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { verifyEmail, resendVerification } = useAuth();
  const { showToast } = useToast();

  const [state, setState] = useState<VerifyState>('loading');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('No verification token provided. Please check the link in your email.');
      return;
    }

    let active = true;

    const verify = async (): Promise<void> => {
      try {
        const result = await verifyEmail(token);
        if (!active) return;
        setState('success');
        setMessage(result.message);
      } catch (error) {
        if (!active) return;
        setState('error');
        const errorMessage =
          error instanceof Error
            ? error.message
            : isAppError(error)
              ? error.message
              : 'Unable to verify email. The token may be invalid or expired.';
        setMessage(errorMessage);
      }
    };

    void verify();

    return () => {
      active = false;
    };
  }, [token, verifyEmail]);

  const handleResend = useCallback(async (): Promise<void> => {
    if (resending || !resendEmail.trim()) {
      if (!resendEmail.trim()) {
        showToast({ type: 'info', message: 'Please enter your email address.' });
      }
      return;
    }

    setResending(true);
    try {
      const result = await resendVerification(resendEmail.trim().toLowerCase());
      showToast({ type: 'success', message: result.message });
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : isAppError(error)
            ? error.message
            : 'Unable to resend verification email.';
      showToast({ type: 'error', message: msg });
    } finally {
      setResending(false);
    }
  }, [resendEmail, resending, resendVerification, showToast]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-12 pt-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Loading */}
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-4 text-center py-8">
            <Loader2 size={40} className="animate-spin text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Verifying your email...</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Please wait while we verify your account.
            </p>
          </div>
        )}

        {/* Success */}
        {state === 'success' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Email verified!</h1>
            <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              {message}
            </p>
            <Link
              to="/login"
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover"
            >
              <LogIn size={16} /> Sign in to your account
            </Link>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle size={32} className="text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Verification failed</h1>
            <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              {message}
            </p>

            <div className="mt-4 w-full space-y-3">
              <p className="text-xs font-semibold text-slate-500">
                Enter your email to request a new verification link:
              </p>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => void handleResend()}
                disabled={resending}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <Mail size={16} />
                {resending ? 'Sending...' : 'Resend verification email'}
              </button>
              <Link
                to="/login"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover"
              >
                <LogIn size={16} /> Go to login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
