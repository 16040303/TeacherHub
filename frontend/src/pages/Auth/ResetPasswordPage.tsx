import React, { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle, KeyRound, Loader2, LogIn } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { parseApiError } from '../../utils/api-error';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') ?? '').trim();
  const { resetPassword } = useAuth();
  const { showToast } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [invalidOrExpiredToken, setInvalidOrExpiredToken] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (submitting || !token) {
      return;
    }

    setErrorMessage('');
    setInvalidOrExpiredToken(false);

    const trimmedPassword = password.trim();
    if (trimmedPassword.length < 8) {
      showToast({ type: 'error', message: 'Password must be at least 8 characters.' });
      return;
    }

    if (trimmedPassword !== confirmPassword.trim()) {
      showToast({ type: 'error', message: 'Password confirmation does not match.' });
      return;
    }

    setSubmitting(true);

    try {
      const result = await resetPassword(token, trimmedPassword);
      const message = result.message || 'Password reset successful. Please log in again.';
      setSuccessMessage(message);
      showToast({ type: 'success', message });
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      const parsedError = parseApiError(error);
      const message =
        parsedError.message ||
        'Unable to reset password. Please request a new reset link.';

      setErrorMessage(message);
      setInvalidOrExpiredToken(parsedError.statusCode === 400);
      showToast({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-12 pt-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle size={32} className="text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Reset link is invalid</h1>
            <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              No reset token was provided. Please request a new password reset link from login.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover"
            >
              <LogIn size={16} /> Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (successMessage) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-12 pt-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Password updated</h1>
            <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              {successMessage}
            </p>
            <Link
              to="/login"
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover"
            >
              <LogIn size={16} /> Continue to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (invalidOrExpiredToken) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-12 pt-8">
        <div className="rounded-3xl border border-amber-200 bg-white p-8 shadow-sm dark:border-amber-900/40 dark:bg-slate-900">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle size={32} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Reset link expired or invalid</h1>
            <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              {errorMessage || 'This password reset link is no longer valid. Please request a new one.'}
            </p>
            <Link
              to="/login"
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover"
            >
              <LogIn size={16} /> Go to login and request a new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-12 pt-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black tracking-tight">Create a new password</h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            Enter your new password below to complete your reset.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
              {errorMessage}
            </div>
          ) : null}
          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">New password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800"
              placeholder="Enter new password"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none transition focus:border-primary focus:bg-white dark:border-slate-700 dark:bg-slate-800"
              placeholder="Confirm new password"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {submitting ? 'Updating password...' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  );
};
