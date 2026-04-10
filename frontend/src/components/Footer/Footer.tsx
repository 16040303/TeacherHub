import React, { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../app/providers/LanguageProvider';

const NEWSLETTER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const Footer: React.FC = () => {
  const { t } = useLanguage();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterFeedback, setNewsletterFeedback] = useState<string | null>(null);
  const [newsletterError, setNewsletterError] = useState<string | null>(null);

  const handleNewsletterSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const normalizedEmail = newsletterEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      setNewsletterError(t('footer.enterEmail'));
      setNewsletterFeedback(null);
      return;
    }

    if (!NEWSLETTER_EMAIL_REGEX.test(normalizedEmail)) {
      setNewsletterError(t('footer.invalidEmail'));
      setNewsletterFeedback(null);
      return;
    }

    setNewsletterError(null);
    setNewsletterFeedback(t('footer.openingEmailApp'));

    const subject = encodeURIComponent(t('footer.newsletterSubject'));
    const body = encodeURIComponent(
      `Hi TeacherHub team,\n\n${t('footer.emailBody')}\n${normalizedEmail}\n\n${t('footer.thanks')}!`,
    );

    if (typeof window !== 'undefined') {
      window.location.href = `mailto:support@teacherhub.app?subject=${subject}&body=${body}`;
    }

    setNewsletterEmail('');
  };

  return (
    <footer className="border-t border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 md:grid-cols-4 md:px-10">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 text-primary">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
              <span className="font-black">T</span>
            </div>
            <h2 className="text-xl font-black tracking-tight">{t('app.name')}</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-500">
            {t('footer.footerDescription')}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">{t('footer.resources')}</h4>
          <nav className="flex flex-col gap-3 text-sm font-bold text-slate-600 dark:text-slate-400">
            <Link to="/library" className="text-left transition-colors hover:text-primary">
              {t('footer.lessonLibrary')}
            </Link>
            <Link to="/library?sort=rating" className="text-left transition-colors hover:text-primary">
              {t('footer.topRatedLessons')}
            </Link>
            <Link to="/upload" className="text-left transition-colors hover:text-primary">
              {t('footer.shareResource')}
            </Link>
          </nav>
        </div>

        <div className="flex flex-col gap-6">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">{t('footer.community')}</h4>
          <nav className="flex flex-col gap-3 text-sm font-bold text-slate-600 dark:text-slate-400">
            <Link to="/community" className="text-left transition-colors hover:text-primary">
              {t('footer.discussionForum')}
            </Link>
            <Link to="/community?category=Technology%20Integration" className="text-left transition-colors hover:text-primary">
              {t('footer.technologyIntegration')}
            </Link>
            <Link to="/community?category=Classroom%20Activities" className="text-left transition-colors hover:text-primary">
              {t('footer.classroomActivities')}
            </Link>
            <Link to="/community?category=Management%20Tips" className="text-left transition-colors hover:text-primary">
              {t('footer.managementTips')}
            </Link>
          </nav>
        </div>

        <div className="flex flex-col gap-6">
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">{t('footer.newsletter')}</h4>
          <p className="text-sm text-slate-500">{t('footer.newsletterDescription')}</p>
          <form onSubmit={handleNewsletterSubmit} className="space-y-2">
            <div className="flex gap-2">
              <input
                id="footer-newsletter-email"
                type="email"
                value={newsletterEmail}
                onChange={(event) => {
                  setNewsletterEmail(event.target.value);
                  if (newsletterError) {
                    setNewsletterError(null);
                  }
                  if (newsletterFeedback) {
                    setNewsletterFeedback(null);
                  }
                }}
                placeholder={t('footer.newsletterPlaceholder')}
                className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <button type="submit" className="rounded-lg bg-primary px-4 text-sm font-bold text-white">
                {t('footer.newsletterJoin')}
              </button>
            </div>
            {newsletterError ? (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-300">{newsletterError}</p>
            ) : newsletterFeedback ? (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">{newsletterFeedback}</p>
            ) : null}
          </form>
        </div>
      </div>

      <div className="mx-auto mt-20 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-slate-100 px-6 pt-8 md:flex-row md:px-10 dark:border-slate-800">
        <p className="text-xs text-slate-400">{t('footer.copyright')}</p>
        <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-slate-400">
          <Link to="/privacy" className="transition-colors hover:text-primary">
            {t('footer.privacy')}
          </Link>
          <Link to="/terms" className="transition-colors hover:text-primary">
            {t('footer.terms')}
          </Link>
          <Link to="/privacy#cookies" className="transition-colors hover:text-primary">
            {t('footer.cookies')}
          </Link>
        </div>
      </div>
    </footer>
  );
};
