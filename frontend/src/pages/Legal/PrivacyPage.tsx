import React from 'react';
import { ShieldCheck, Mail } from 'lucide-react';
import { useLanguage } from '../../app/providers/LanguageProvider';

const LAST_UPDATED = 'March 16, 2026';

export const PrivacyPage: React.FC = () => {
  const { t } = useLanguage();

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-16">
      <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
          <ShieldCheck size={14} /> {t('legal.legal')}
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight">{t('legal.privacy')}</h1>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          {t('legal.privacyCommitment')}
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {t('legal.lastUpdatedDate', { date: LAST_UPDATED })}
        </p>
      </header>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black tracking-tight">{t('legal.informationWeCollect')}</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <li>{t('legal.accountDetails')}</li>
          <li>{t('legal.marketplaceActivity')}</li>
          <li>{t('legal.communityInteractions')}</li>
          <li>{t('legal.technicalPreferences')}</li>
        </ul>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black tracking-tight">{t('legal.howWeUseData')}</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {t('legal.dataUseDescription')}
        </p>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black tracking-tight">{t('legal.dataSharing')}</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {t('legal.dataSharingDescription')}
        </p>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black tracking-tight">{t('legal.retentionSecurity')}</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {t('legal.retentionSecurityDescription')}
        </p>
      </section>

      <section
        id="cookies"
        className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-xl font-black tracking-tight">{t('legal.cookiesLocalStorage')}</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {t('legal.cookiesDescription')}
        </p>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black tracking-tight">{t('legal.yourRights')}</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {t('legal.yourRightsDescription')}
        </p>
      </section>

      <section className="rounded-3xl border border-primary/20 bg-primary/5 p-8">
        <h2 className="text-xl font-black tracking-tight">{t('legal.contact')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {t('legal.contactDescription')}
        </p>
        <a
          href="mailto:privacy@teacherhub.example"
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover"
        >
          <Mail size={16} /> privacy@teacherhub.example
        </a>
      </section>
    </article>
  );
};
