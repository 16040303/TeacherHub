import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../../app/providers/LanguageProvider';

export const AccessDeniedPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex size-20 items-center justify-center rounded-3xl bg-rose-500/15 text-rose-300">
        <ShieldAlert size={40} />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight">{t('accessDenied.title')}</h1>
        <p className="max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">
          {t('accessDenied.description')}
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover"
      >
        <Home size={18} />
        {t('accessDenied.returnHome')}
      </Link>
    </div>
  );
};
