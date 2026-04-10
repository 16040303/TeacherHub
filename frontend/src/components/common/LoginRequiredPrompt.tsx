import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, X } from 'lucide-react';

interface LoginRequiredPromptProps {
  message: string;
  redirectPath: string;
  className?: string;
  onDismiss?: () => void;
}

export const LoginRequiredPrompt: React.FC<LoginRequiredPromptProps> = ({
  message,
  redirectPath,
  className,
  onDismiss,
}) => {
  return (
    <div
      className={`relative rounded-2xl border border-amber-300/60 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 ${className ?? ''}`.trim()}
      role="status"
    >
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-md p-1 text-amber-700 transition-colors hover:bg-amber-100 hover:text-amber-900 dark:text-amber-200 dark:hover:bg-amber-500/20"
          aria-label="Dismiss login prompt"
        >
          <X size={14} />
        </button>
      ) : null}

      <div className="flex items-start gap-3 pr-8">
        <div className="mt-0.5 rounded-lg bg-amber-200/70 p-1 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
          <Lock size={14} />
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-semibold leading-5">{message}</p>
          <Link
            to={`/login?redirect=${encodeURIComponent(redirectPath)}`}
            className="inline-flex w-fit items-center rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-amber-600"
          >
            Log in to continue
          </Link>
        </div>
      </div>
    </div>
  );
};
