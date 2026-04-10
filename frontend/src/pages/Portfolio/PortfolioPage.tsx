import React, { useEffect, useMemo, useState } from 'react';
import {
  Mail,
  MapPin,
  Briefcase,
  Star,
  Settings,
  Share2,
  MessageSquare,
  RefreshCw,
  Users,
  UserPlus,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { profileService } from '../../services/profileService';
import { lessonsService } from '../../services/lessonsService';

import { useToast } from '../../app/providers/ToastProvider';
import { Lesson, TeacherPublicProfile } from '../../types';
import { LessonCard } from '../../features/lessons/components/LessonCard';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { useLanguage } from '../../app/providers/LanguageProvider';

export const PortfolioPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TeacherPublicProfile | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [sort, setSort] = useState<'all' | 'popular'>('all');
  const [isSharing, setIsSharing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async (silent = false): Promise<void> => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (silent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [teacherProfile, teacherLessons] = await Promise.all([
        profileService.getTeacherPublicProfile(user.id),
        lessonsService.listLessonsByAuthor(user.id, true),
      ]);

      const published = teacherLessons.filter((lesson) => lesson.status === 'published');
      setProfile(teacherProfile);
      setLessons(published);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('portfolio.unableToLoad');
      showToast({ type: 'error', message });
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id]);

  const sortedLessons = useMemo(() => {
    const working = [...lessons];
    if (sort === 'popular') {
      return working.sort((left, right) => right.downloads - left.downloads);
    }

    return working.sort((left, right) => {
      const leftTime = new Date(left.updatedAt).getTime();
      const rightTime = new Date(right.updatedAt).getTime();
      return rightTime - leftTime;
    });
  }, [lessons, sort]);

  const handleContactFromPortfolio = (): void => {
    if (!user) {
      return;
    }

    const subject = encodeURIComponent(t('portfolio.contactSubject', { name: user.name }));
    const body = encodeURIComponent(t('portfolio.contactBody', { name: user.name }));

    window.location.href = `mailto:${encodeURIComponent(user.email)}?subject=${subject}&body=${body}`;
    showToast({ type: 'success', message: t('portfolio.openMail') });
  };

  const handleSharePortfolio = async (): Promise<void> => {
    if (!user || isSharing) {
      return;
    }

    setIsSharing(true);

    try {
      const shareUrl = `${window.location.origin}/portfolio`;
      if (!navigator.clipboard) {
        throw new Error('clipboard-unavailable');
      }
      await navigator.clipboard.writeText(shareUrl);
      showToast({ type: 'success', message: t('portfolio.copiedPortfolioLink') });
    } catch {
      showToast({ type: 'error', message: t('portfolio.unableToCopyLink') });
    } finally {
      setIsSharing(false);
    }
  };

  const handleExploreCommunity = (): void => {
    if (!user) {
      return;
    }

    showToast({ type: 'info', message: t('portfolio.exploreCommunityToast') });
    navigate('/community');
  };

  if (loading) {
    return <LoadingState title={t('portfolio.loadingPortfolio')} description={t('portfolio.loadingDescription')} />;
  }

  if (!user || !profile) {
    return (
      <EmptyState
        title={t('portfolio.portfolioUnavailable')}
        description={t('portfolio.activeAccountRequired')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-10 pb-20">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="absolute left-0 top-0 h-32 w-full bg-gradient-to-r from-primary/20 to-primary/5" />

        <div className="relative z-10 mt-8 flex flex-col items-start gap-8 md:flex-row md:items-end">
          <div className="size-32 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-xl dark:border-slate-900">
            <img
              src={profile.avatar?.trim() || `https://picsum.photos/seed/${profile.id}/200/200`}
              alt={profile.name}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h1 className="text-3xl font-black tracking-tight">{profile.name}</h1>
                <p className="font-medium text-slate-500">{profile.subject || t('portfolio.educatorFallback')}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleContactFromPortfolio}
                  className="flex h-10 items-center gap-2 rounded-xl bg-primary px-6 font-bold text-white shadow-md transition-all hover:bg-primary-hover"
                >
                  <Mail size={18} /> {t('portfolio.contact')}
                </button>
                <Link
                  to="/settings"
                  className="flex h-10 items-center rounded-xl bg-slate-100 px-4 font-bold transition-all hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <Settings size={18} />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    void handleSharePortfolio();
                  }}
                  disabled={isSharing}
                  className="flex h-10 items-center rounded-xl bg-slate-100 px-4 font-bold transition-all hover:bg-slate-200 disabled:opacity-70 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <Share2 size={18} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 text-sm font-medium text-slate-500">
              <div className="flex items-center gap-2">
                <MapPin size={16} /> {profile.location || t('portfolio.locationNotSet')}
              </div>
              <div className="flex items-center gap-2">
                <Briefcase size={16} /> {profile.experience || t('portfolio.experienceNotSet')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-1">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-6 text-lg font-bold">{t('portfolio.impactStats')}</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-black text-primary">{profile.stats.sharedLessons}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('portfolio.sharedLessons')}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-black text-primary">{profile.stats.totalDownloads}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('lesson.downloads')}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-3xl font-black text-primary">{profile.stats.averageRating.toFixed(1)}</span>
                  <Star size={20} className="fill-yellow-500 text-yellow-500" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('portfolio.avgRating')}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-3xl font-black text-primary">{profile.stats.followers}</span>
                  <Users size={18} className="text-primary" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('lesson.followers')}</span>
              </div>
              <div className="col-span-2 flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-black text-primary">{profile.stats.following}</span>
                  <UserPlus size={16} className="text-primary" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('lesson.following')}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h3 className="mb-3 text-lg font-bold">{t('portfolio.aboutMe')}</h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {profile.bio || t('portfolio.bioFallback')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleExploreCommunity}
              className="rounded-2xl border border-slate-200 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-slate-700"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <MessageSquare size={16} /> {t('portfolio.communityReputation')}
              </div>
              <p className="mt-2 text-xs font-medium text-slate-400">
                {t('portfolio.communityReputationHint')}
              </p>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">{t('portfolio.sharedLessonPlans')}</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSort('all')}
                className={`rounded-xl px-4 py-2 text-sm font-bold ${
                  sort === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-500 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
                }`}
              >
                {t('portfolio.recent')}
              </button>
              <button
                type="button"
                onClick={() => setSort('popular')}
                className={`rounded-xl px-4 py-2 text-sm font-bold ${
                  sort === 'popular'
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-500 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
                }`}
              >
                {t('library.mostPopular')}
              </button>
            </div>
          </div>

          {sortedLessons.length === 0 ? (
            <EmptyState
              title={t('portfolio.noPublishedLessons')}
              description={t('portfolio.createFirstLesson')}
              action={
                <Link to="/upload" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
                  {t('portfolio.goToUpload')}
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {sortedLessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              void loadData(true);
            }}
            disabled={isRefreshing}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-4 font-bold text-slate-400 transition-all hover:border-primary hover:text-primary disabled:opacity-70 dark:border-slate-800"
          >
            <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />{' '}
            {isRefreshing ? t('portfolio.refreshing') : t('portfolio.refreshData')}
          </button>
        </div>
      </div>
    </div>
  );
};
