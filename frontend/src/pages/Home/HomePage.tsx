import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ArrowRight,
  Star,
  RefreshCw,
  Sparkles,
  Flame,
  Clock3,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { LessonCard } from '../../features/lessons/components/LessonCard';
import { lessonsService } from '../../services/lessonsService';
import { communityService } from '../../services/communityService';
import { Lesson } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../app/providers/AuthProvider';
import { useLanguage } from '../../app/providers/LanguageProvider';

interface MarketplaceSections {
  featured: Lesson[];
  popular: Lesson[];
  recommended: Lesson[];
  latest: Lesson[];
}

const emptySections: MarketplaceSections = {
  featured: [],
  popular: [],
  recommended: [],
  latest: [],
};

const skeletonItems = Array.from({ length: 3 }, (_, index) => index);

const SectionSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
    {skeletonItems.map((item) => (
      <div
        key={item}
        className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="aspect-[4/3] animate-pulse bg-slate-200/80 dark:bg-slate-800" />
        <div className="space-y-3 p-6">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800/80" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800/80" />
        </div>
      </div>
    ))}
  </div>
);

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<MarketplaceSections>(emptySections);
  const [stats, setStats] = useState({
    lessons: 0,
    activeTeachers: 0,
    downloads: 0,
    communityPosts: 0,
  });

  const loadData = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const [overview, posts, teacherPool] = await Promise.all([
        lessonsService.getMarketplaceOverview(user?.id),
        communityService.listCommunityPosts({ page: 1, pageSize: 300 }),
        lessonsService.listLessons({ page: 1, pageSize: 300, onlyPublished: true }),
      ]);

      const featured = Array.isArray(overview.featured) ? overview.featured.slice(0, 6) : [];
      const popular = Array.isArray(overview.popular) ? overview.popular.slice(0, 6) : [];
      const recommended = Array.isArray(overview.recommended)
        ? overview.recommended.slice(0, 6)
        : [];
      const latest = Array.isArray(overview.latest) ? overview.latest.slice(0, 6) : [];

      const publishedLessons = Array.isArray(teacherPool.data) ? teacherPool.data : [];
      const uniqueTeacherCount = new Set(
        publishedLessons.map((lesson) => lesson.authorId).filter(Boolean),
      ).size;
      const totalDownloads = publishedLessons.reduce(
        (sum, lesson) => sum + Math.max(0, Number(lesson.downloads) || 0),
        0,
      );

      setSections({ featured, popular, recommended, latest });
      setStats({
        lessons: Math.max(0, Number(teacherPool.total) || 0),
        activeTeachers: uniqueTeacherCount,
        downloads: totalDownloads,
        communityPosts: Math.max(0, Number(posts.total) || 0),
      });
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : t('home.marketplaceError', { error: '' });
      setError(message);
      setSections(emptySections);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [user?.id]);

  const handleSearch = (): void => {
    const query = search.trim();
    if (!query) {
      navigate('/library');
      return;
    }

    navigate(`/library?search=${encodeURIComponent(query)}`);
  };

  const statItems = useMemo(
    () => [
      { label: t('home.lessonPlans'), value: `${stats.lessons}+` },
      { label: t('home.activeTeachers'), value: `${stats.activeTeachers}+` },
      { label: t('home.downloads'), value: `${stats.downloads.toLocaleString()}+` },
      { label: t('home.communityPosts'), value: `${stats.communityPosts}+` },
    ],
    [stats, t],
  );

  const sectionDefinitions = [
    {
      key: 'featured' as const,
      title: t('home.featuredSectionTitle'),
      subtitle: t('home.featuredSectionSubtitle'),
      recommendationHint: t('home.featuredRecommendationHint'),
      icon: <Star size={18} className="fill-primary text-primary" />,
      wrapperClass:
        'rounded-[2.5rem] border border-primary/20 bg-gradient-to-br from-primary/10 via-white to-violet-100/80 p-8 dark:from-primary/15 dark:via-slate-900 dark:to-slate-900',
      emptyTitle: t('home.noFeaturedLessons'),
      emptyDescription: t('home.noFeaturedLessonsDescription'),
    },
    {
      key: 'popular' as const,
      title: t('home.popularSectionTitle'),
      subtitle: t('home.popularSectionSubtitle'),
      recommendationHint: t('home.popularRecommendationHint'),
      icon: <Flame size={18} className="text-orange-500" />,
      wrapperClass:
        'rounded-[2.5rem] border border-orange-200/70 bg-gradient-to-br from-orange-50 via-white to-amber-100/70 p-8 dark:border-orange-900/40 dark:from-orange-950/20 dark:via-slate-900 dark:to-slate-900',
      emptyTitle: t('home.noPopularLessons'),
      emptyDescription: t('home.noPopularLessonsDescription'),
    },
    {
      key: 'recommended' as const,
      title: t('home.recommendedSectionTitle'),
      subtitle: t('home.recommendedSectionSubtitle'),
      recommendationHint: t('home.recommendedRecommendationHint'),
      icon: <Sparkles size={18} className="text-fuchsia-500" />,
      wrapperClass:
        'rounded-[2.5rem] border border-fuchsia-200/70 bg-gradient-to-br from-fuchsia-50 via-white to-indigo-100/70 p-8 dark:border-fuchsia-900/40 dark:from-fuchsia-950/20 dark:via-slate-900 dark:to-slate-900',
      emptyTitle: t('home.noRecommendations'),
      emptyDescription: t('home.noRecommendationsDescription'),
    },
    {
      key: 'latest' as const,
      title: t('home.latestSectionTitle'),
      subtitle: t('home.latestSectionSubtitle'),
      recommendationHint: t('home.latestRecommendationHint'),
      icon: <Clock3 size={18} className="text-emerald-500" />,
      wrapperClass:
        'rounded-[2.5rem] border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-cyan-100/70 p-8 dark:border-emerald-900/40 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900',
      emptyTitle: t('home.noNewUploads'),
      emptyDescription: t('home.noNewUploadsDescription'),
    },
  ];

  return (
    <div className="flex flex-col gap-16 pb-20">
      <section className="relative flex min-h-[480px] flex-col items-center justify-center gap-8 py-16 text-center">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[560px] w-[980px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        </div>

        <div className="flex max-w-4xl flex-col gap-4">
          <div className="inline-flex items-center gap-2 self-center rounded-full bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-primary">
            <Star size={14} className="fill-primary" /> {t('home.marketplaceCurated')}
          </div>
          <h1 className="text-5xl leading-[1.1] font-black tracking-tight md:text-7xl">
            {t('home.title')}
          </h1>
          <p className="mx-auto max-w-2xl text-lg font-medium text-slate-500 md:text-xl dark:text-slate-400">
            {t('home.subtitle')}
          </p>
        </div>

        <div className="relative w-full max-w-3xl">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={24} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSearch();
              }
            }}
            placeholder={t('home.searchPlaceholder')}
            className="h-18 w-full rounded-[2rem] border-2 border-slate-100 bg-white pl-16 pr-40 text-lg font-medium shadow-2xl shadow-primary/10 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-800 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="absolute right-3 top-1/2 h-13 -translate-y-1/2 rounded-2xl bg-primary px-8 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover"
          >
            {t('home.searchButton')}
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{t('home.marketplaceError', { error })}</span>
            <button
              type="button"
              onClick={() => {
                void loadData();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 dark:border-red-700 dark:bg-transparent dark:text-red-200"
            >
              <RefreshCw size={14} /> {t('home.retry')}
            </button>
          </div>
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-[3rem] bg-slate-900 p-10 text-white md:p-16">
        <div className="absolute right-0 top-0 -mr-40 -mt-40 h-80 w-80 rounded-full bg-primary/25 blur-[100px]" />
        <div className="relative z-10 grid grid-cols-2 gap-10 text-center lg:grid-cols-4">
          {statItems.map((item) => (
            <div key={item.label} className="flex flex-col gap-2">
              <span className="text-4xl font-black text-primary md:text-5xl">{item.value}</span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {sectionDefinitions.map((section) => {
        const lessons = sections[section.key];

        return (
          <section key={section.key} className={section.wrapperClass}>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div className="flex max-w-2xl flex-col gap-2">
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                  {section.icon}
                  {section.recommendationHint}
                </div>
                <h2 className="text-3xl font-black tracking-tight">{section.title}</h2>
                <p className="font-medium text-slate-500 dark:text-slate-300">{section.subtitle}</p>
              </div>

              <Link
                to={`/library?sort=${
                  section.key === 'latest'
                    ? 'newest'
                    : section.key === 'featured'
                      ? 'rating'
                      : 'popular'
                }`}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-bold text-primary shadow-sm transition-all hover:gap-3 dark:bg-slate-800"
              >
                {t('home.exploreSection')} <ArrowRight size={18} />
              </Link>
            </div>

            {loading ? (
              <SectionSkeleton />
            ) : error ? (
              <EmptyState
                title={t('home.unableToLoadSection', { section: section.title.toLowerCase() })}
                description={t('home.tryRefreshingMarketplace')}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      void loadData();
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
                  >
                    <RefreshCw size={16} /> {t('home.reloadSection')}
                  </button>
                }
              />
            ) : lessons.length === 0 ? (
              <EmptyState title={section.emptyTitle} description={section.emptyDescription} />
            ) : (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                {lessons.map((lesson) => (
                  <LessonCard key={`${section.key}-${lesson.id}`} lesson={lesson} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
