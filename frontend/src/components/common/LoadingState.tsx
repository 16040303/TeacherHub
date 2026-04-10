import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  title?: string;
  description?: string;
  compact?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  title = 'Loading',
  description,
  compact = false,
}) => {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white/70 p-8 text-center dark:border-slate-800 dark:bg-slate-900/60 ${
        compact ? 'min-h-[120px]' : 'min-h-[220px]'
      }`}
    >
      <Loader2 size={26} className="animate-spin text-primary" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        {description ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
    </div>
  );
};
