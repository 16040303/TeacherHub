import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  MapPin,
  Briefcase,
  Star,
  Download,
  UserPlus,
  UserCheck,
  BadgeCheck,
  Sparkles,
  Share2,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { useLanguage } from '../../app/providers/LanguageProvider';
import { profileService } from '../../services/profileService';
import { followsService } from '../../services/followsService';
import { Lesson, TeacherPublicProfile } from '../../types';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { LessonCard } from '../../features/lessons/components/LessonCard';
import { formatRelativeDate } from '../../utils/format';

type TeacherReviewRow = Awaited<ReturnType<typeof profileService.listTeacherReviews>>[number];

type LessonSort = 'recent' | 'popular';

const starSet = [1, 2, 3, 4, 5];

const toFallbackAvatar = (seed: string): string =>
  `https://picsum.photos/seed/${encodeURIComponent(seed || 'teacherhub-profile')}/220/220`;

export const TeacherProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TeacherPublicProfile | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [reviews, setReviews] = useState<TeacherReviewRow[]>([]);
  const [sort, setSort] = useState<LessonSort>('recent');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async (): Promise<void> => {
    if (!id) {
      setLoading(false);
      setProfile(null);
      setLessons([]);
      setReviews([]);
      setIsFollowing(false);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [teacherProfile, teacherLessons, teacherReviews] = await Promise.all([
        profileService.getTeacherPublicProfile(id),
        profileService.listTeacherLessons(id, false),
        profileService.listTeacherReviews(id),
      ]);

      if (!teacherProfile) {
        setProfile(null);
        setLessons([]);
        setReviews([]);
        setIsFollowing(false);
        setLoadError(null);
        return;
      }

      setProfile(teacherProfile);
      setLessons(teacherLessons.filter((lesson) => lesson.status === 'published'));
      setReviews(teacherReviews.slice(0, 8));

      if (isAuthenticated && user && user.id !== id) {
        const following = await followsService.isFollowingUser(user.id, id);
        setIsFollowing(following);
      } else {
        setIsFollowing(false);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('teacherProfile.unableToLoad');
      showToast({ type: 'error', message });
      setProfile(null);
      setLessons([]);
      setReviews([]);
      setIsFollowing(false);
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id, isAuthenticated, user?.id]);

  const sortedLessons = useMemo(() => {
    const working = [...lessons];

    if (sort === 'popular') {
      return working.sort((left, right) => {
        const popularityLeft = left.downloads + left.reviewCount * 5 + left.rating * 10;
        const popularityRight = right.downloads + right.reviewCount * 5 + right.rating * 10;
        return popularityRight - popularityLeft;
      });
    }

    return working.sort((left, right) => {
      const leftTime = new Date(left.updatedAt).getTime();
      const rightTime = new Date(right.updatedAt).getTime();
      return rightTime - leftTime;
    });
  }, [lessons, sort]);

  const handleToggleFollow = async (): Promise<void> => {
    if (!profile || !id || isTogglingFollow) {
      return;
    }

    if (!isAuthenticated || !user) {
      showToast({ type: 'info', message: t('toast.loginToFollow') });
      navigate(`/login?redirect=${encodeURIComponent(`/teacher/${id}`)}`);
      return;
    }

    if (user.id === id) {
      return;
    }

    const previous = isFollowing;
    const next = !previous;

    setIsFollowing(next);
    setProfile((current) =>
      current
        ? {
            ...current,
            stats: {
              ...current.stats,
              followers: Math.max(0, current.stats.followers + (next ? 1 : -1)),
            },
          }
        : current,
    );
    setIsTogglingFollow(true);

    try {
      if (next) {
        await followsService.followUser(user.id, id);
        showToast({ type: 'success', message: t('toast.followingUser', { name: profile.name }) });
      } else {
        await followsService.unfollowUser(user.id, id);
        showToast({ type: 'info', message: t('toast.unfollowedUser', { name: profile.name }) });
      }
    } catch (error) {
      setIsFollowing(previous);
      setProfile((current) =>
        current
          ? {
              ...current,
              stats: {
                ...current.stats,
                followers: Math.max(0, current.stats.followers + (previous ? 1 : -1)),
              },
            }
          : current,
      );
      const message =
        error instanceof Error ? error.message : t('teacherProfile.unableToUpdateFollowStatus');
      showToast({ type: 'error', message });
    } finally {
      setIsTogglingFollow(false);
    }
  };

  const handleShareProfile = async (): Promise<void> => {
    if (!id) {
      return;
    }

    const shareUrl = `${window.location.origin}/teacher/${id}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast({ type: 'success', message: t('teacherProfile.profileLinkCopied') });
      } else {
        showToast({ type: 'info', message: t('teacherProfile.copyProfileUrl', { url: shareUrl }) });
      }
    } catch {
      showToast({ type: 'error', message: t('teacherProfile.unableToCopyProfileLink') });
    }
  };

  if (loading) {
    return (
      <LoadingState
        title={t('teacherProfile.loadingTitle')}
        description={t('teacherProfile.loadingDescription')}
      />
    );
  }

  if (!profile || !id) {
    const description = loadError
      ? t('teacherProfile.unavailableLoadDescription')
      : t('teacherProfile.unavailableMissingDescription');

    return (
      <EmptyState
        title={t('teacherProfile.unavailableTitle')}
        description={description}
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            {id ? (
              <button
                type="button"
                onClick={() => {
                  void loadData();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <RefreshCw size={15} /> {t('common.retry')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => navigate('/library')}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              {t('teacherProfile.backToLibrary')}
            </button>
          </div>
        }
      />
    );
  }

  const isOwnProfile = Boolean(user?.id && user.id === id);
  const avatar = profile.avatar?.trim() || toFallbackAvatar(profile.id);

  return (
    <div className="flex flex-col gap-10 pb-20">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex w-fit items-center gap-2 font-bold text-slate-500 transition-all hover:text-primary"
      >
        <ChevronLeft size={20} /> {t('common.back')}
      </button>

      <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-r from-primary/25 via-primary/10 to-transparent" />

        <div className="relative z-10 mt-6 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-5 md:flex-row md:items-end">
            <div className="size-28 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-xl dark:border-slate-900">
              <img src={avatar} alt={profile.name} className="h-full w-full object-cover" />
            </div>
            <div className="space-y-2">
              <div>
                <h1 className="text-3xl font-black tracking-tight">{profile.name}</h1>
                <p className="text-sm font-bold uppercase tracking-wider text-primary/80">
                  {profile.subject || t('teacherProfile.educatorFallback')}
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase size={14} /> {profile.experience || t('teacherProfile.experienceFallback')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} /> {profile.location || t('teacherProfile.locationFallback')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                void handleShareProfile();
              }}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 px-5 text-xs font-black uppercase tracking-wider text-slate-600 transition-colors hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
            >
              <Share2 size={16} /> {t('teacherProfile.shareProfile')}
            </button>

            {!isOwnProfile ? (
              <button
                type="button"
                onClick={() => {
                  void handleToggleFollow();
                }}
                disabled={isTogglingFollow}
                className={`inline-flex h-12 items-center gap-2 rounded-2xl border px-5 text-xs font-black uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                  isFollowing
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-slate-200 text-slate-600 hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
                {isTogglingFollow
                  ? t('common.updating')
                  : isFollowing
                    ? t('teacherProfile.following')
                    : t('teacherProfile.follow')}
              </button>
            ) : (
              <Link
                to="/settings"
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-primary-hover"
              >
                <Settings size={16} /> {t('teacherProfile.editProfile')}
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-3">
        <aside className="flex flex-col gap-6 lg:col-span-1">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">
              {t('teacherProfile.trustSignals')}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('teacherProfile.followers')}</p>
                <p className="mt-1 text-2xl font-black text-primary">{profile.stats.followers}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('teacherProfile.sharedLessons')}</p>
                <p className="mt-1 text-2xl font-black text-primary">{profile.stats.sharedLessons}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('teacherProfile.downloads')}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-2xl font-black text-primary">
                  <Download size={16} /> {profile.stats.totalDownloads}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{t('teacherProfile.avgRating')}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-2xl font-black text-primary">
                  {profile.stats.averageRating.toFixed(1)} <Star size={16} className="fill-yellow-500 text-yellow-500" />
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <p className="inline-flex items-center gap-1.5 font-black uppercase tracking-wider">
                <BadgeCheck size={14} /> {t('teacherProfile.verifiedCreator')}
              </p>
              <p className="mt-2 text-xs font-medium">
                {t('teacherProfile.verifiedDescription')}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">
              {t('teacherProfile.teachingBio')}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {profile.bio || t('teacherProfile.bioFallback')}
            </p>
          </div>
        </aside>

        <section className="flex flex-col gap-8 lg:col-span-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-primary">
                  <Sparkles size={14} /> {t('teacherProfile.publicLessonCatalog')}
                </div>
                <h2 className="mt-2 text-xl font-black">{t('teacherProfile.publishedLessons')}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSort('recent')}
                  className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider ${
                    sort === 'recent'
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {t('teacherProfile.recent')}
                </button>
                <button
                  type="button"
                  onClick={() => setSort('popular')}
                  className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider ${
                    sort === 'popular'
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {t('teacherProfile.popular')}
                </button>
              </div>
            </div>

            {sortedLessons.length === 0 ? (
              <EmptyState
                title={t('teacherProfile.noPublishedLessons')}
                description={t('teacherProfile.noPublishedLessonsDescription')}
                action={
                  <Link to="/library" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
                    {t('teacherProfile.browseLibrary')}
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
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-black">{t('teacherProfile.recentFeedback')}</h3>
            {reviews.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {t('teacherProfile.noReviewsYet')}
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {reviews.map((row) => (
                  <li
                    key={row.review.id}
                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-100">
                          {row.reviewer?.name || t('teacherProfile.reviewerFallback')}
                        </p>
                        <Link
                          to={`/lesson/${row.review.lessonId}`}
                          className="text-xs font-bold uppercase tracking-wider text-primary hover:underline"
                        >
                          {row.lessonTitle}
                        </Link>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-primary">{row.review.rating.toFixed(1)} / 5</p>
                        <p className="text-[11px] font-medium text-slate-400">
                          {formatRelativeDate(row.review.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mb-2 flex items-center gap-0.5">
                      {starSet.map((item) => (
                        <Star
                          key={`${row.review.id}-star-${item}`}
                          size={14}
                          className={
                            item <= Math.floor(row.review.rating)
                              ? 'fill-yellow-500 text-yellow-500'
                              : 'text-slate-300'
                          }
                        />
                      ))}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{row.review.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
