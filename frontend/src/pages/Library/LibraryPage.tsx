import React, { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, RefreshCw, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { LessonCard } from '../../features/lessons/components/LessonCard';
import { lessonsService } from '../../services/lessonsService';
import { GRADE_LEVELS, SUBJECTS } from '../../app/config/constants';
import { Lesson, LessonFilterMetadata, LessonFilters, LessonPriceFilter } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';
import { useLanguage } from '../../app/providers/LanguageProvider';

const sortOptions: Array<{ labelKey: string; value: NonNullable<LessonFilters['sortBy']> }> = [
  { labelKey: 'library.mostPopular', value: 'popular' },
  { labelKey: 'library.newestFirst', value: 'newest' },
  { labelKey: 'library.highestRated', value: 'rating' },
  { labelKey: 'library.priceLowToHigh', value: 'price_asc' },
  { labelKey: 'library.priceHighToLow', value: 'price_desc' },
];

const priceOptions: Array<{ labelKey: string; value: LessonPriceFilter }> = [
  { labelKey: 'library.allPrices', value: 'all' },
  { labelKey: 'library.freeOnly', value: 'free' },
  { labelKey: 'library.paidOnly', value: 'paid' },
  { labelKey: 'library.underCoins', value: 'under_100' },
  { labelKey: 'library.betweenCoins', value: 'between_100_200' },
  { labelKey: 'library.aboveCoins', value: 'above_200' },
];

const defaultMetadata: LessonFilterMetadata = {
  subjects: SUBJECTS,
  gradeLevels: GRADE_LEVELS,
  tags: [],
  ratingOptions: [4.5, 4, 3.5, 3],
};

const loadingCards = Array.from({ length: 6 }, (_, index) => index);

const parsePage = (value: string | null): number => {
  const parsed = Number(value ?? '1');
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.floor(parsed);
};

const parseSort = (value: string | null): NonNullable<LessonFilters['sortBy']> => {
  const fallback: NonNullable<LessonFilters['sortBy']> = 'popular';
  if (!value) {
    return fallback;
  }

  return (
    sortOptions.find((option) => option.value === value)?.value ?? fallback
  );
};

const parsePrice = (value: string | null): LessonPriceFilter => {
  const fallback: LessonPriceFilter = 'all';
  if (!value) {
    return fallback;
  }

  return priceOptions.find((option) => option.value === value)?.value ?? fallback;
};

const parseRating = (value: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 5) {
    return undefined;
  }

  return Number(parsed.toFixed(1));
};

const parseTags = (value: string | null): string[] => {
  if (!value?.trim()) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
};

const sanitizeFilterMetadata = (value: LessonFilterMetadata): LessonFilterMetadata => {
  const safeSubjects =
    Array.isArray(value.subjects) && value.subjects.length > 0
      ? Array.from(new Set(value.subjects.filter(Boolean))).sort((left, right) =>
          left.localeCompare(right),
        )
      : defaultMetadata.subjects;

  const safeGradeLevels =
    Array.isArray(value.gradeLevels) && value.gradeLevels.length > 0
      ? Array.from(new Set(value.gradeLevels.filter(Boolean))).sort((left, right) =>
          left.localeCompare(right),
        )
      : defaultMetadata.gradeLevels;

  const safeTags =
    Array.isArray(value.tags) && value.tags.length > 0
      ? Array.from(
          new Set(
            value.tags
              .map((tag) => tag.trim())
              .filter(Boolean),
          ),
        ).sort((left, right) => left.localeCompare(right))
      : [];

  const safeRatings =
    Array.isArray(value.ratingOptions) && value.ratingOptions.length > 0
      ? value.ratingOptions
          .map((rating) => Number(rating))
          .filter((rating) => Number.isFinite(rating) && rating > 0 && rating <= 5)
          .map((rating) => Number(rating.toFixed(1)))
      : defaultMetadata.ratingOptions;

  return {
    subjects: safeSubjects,
    gradeLevels: safeGradeLevels,
    tags: safeTags,
    ratingOptions: Array.from(new Set(safeRatings)).sort((left, right) => right - left),
  };
};

export const LibraryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [items, setItems] = useState<Lesson[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<LessonFilterMetadata>(defaultMetadata);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [reloadToken, setReloadToken] = useState(0);

  const searchParamsKey = searchParams.toString();

  const {
    page,
    search,
    subject,
    gradeLevel,
    priceType,
    sortBy,
    minimumRating,
    selectedTags,
  } = useMemo(
    () => ({
      page: parsePage(searchParams.get('page')),
      search: searchParams.get('search') ?? '',
      subject: searchParams.get('subject') ?? 'All',
      gradeLevel: searchParams.get('grade') ?? 'All',
      priceType: parsePrice(searchParams.get('price')),
      sortBy: parseSort(searchParams.get('sort')),
      minimumRating: parseRating(searchParams.get('rating')),
      selectedTags: parseTags(searchParams.get('tags')),
    }),
    [searchParamsKey],
  );

  const filters = useMemo<LessonFilters>(
    () => ({
      page,
      pageSize: 8,
      search: search || undefined,
      subject: subject === 'All' ? 'All' : (subject as LessonFilters['subject']),
      gradeLevel: gradeLevel === 'All' ? 'All' : (gradeLevel as LessonFilters['gradeLevel']),
      priceType,
      minimumRating,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      sortBy,
      onlyPublished: true,
    }),
    [gradeLevel, minimumRating, page, priceType, search, selectedTags, sortBy, subject],
  );

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    let active = true;

    const loadMetadata = async (): Promise<void> => {
      try {
        const response = await lessonsService.getLessonFilterMetadata();
        if (!active) {
          return;
        }

        setMetadata(sanitizeFilterMetadata(response));
      } catch {
        if (!active) {
          return;
        }

        setMetadata(defaultMetadata);
      }
    };

    void loadMetadata();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      if (loading) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError(null);
      try {
        const result = await lessonsService.listLessons(filters);
        if (!active) {
          return;
        }

        setItems(Array.isArray(result.data) ? result.data : []);
        setTotal(Math.max(0, Number(result.total) || 0));
        setTotalPages(Math.max(1, Number(result.totalPages) || 1));
      } catch (loadError) {
        if (!active) {
          return;
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : t('library.unableToLoad');
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [filters, reloadToken]);

  const updateSearchParams = (updater: (next: URLSearchParams) => void): void => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      updater(next);
      return current.toString() === next.toString() ? current : next;
    });
  };

  const updateParam = (key: string, value: string | undefined): void => {
    updateSearchParams((next) => {
      const normalizedValue = value?.trim();

      if (!normalizedValue || normalizedValue === 'All' || normalizedValue === 'all') {
        next.delete(key);
      } else {
        next.set(key, normalizedValue);
      }

      if (key !== 'page') {
        next.set('page', '1');
      }
    });
  };

  const toggleTag = (tag: string): void => {
    const normalizedTag = tag.trim();
    if (!normalizedTag) {
      return;
    }

    updateSearchParams((next) => {
      const hasTag = selectedTags.includes(normalizedTag);
      const nextTags = hasTag
        ? selectedTags.filter((item) => item !== normalizedTag)
        : [...selectedTags, normalizedTag];

      if (nextTags.length === 0) {
        next.delete('tags');
      } else {
        next.set('tags', nextTags.join(','));
      }

      next.set('page', '1');
    });
  };

  const applySearch = (): void => {
    updateParam('search', searchInput.trim() || undefined);
  };

  const clearFilters = (): void => {
    updateSearchParams((next) => {
      next.delete('search');
      next.delete('subject');
      next.delete('grade');
      next.delete('price');
      next.delete('sort');
      next.delete('tags');
      next.delete('rating');
      next.set('page', '1');
    });
  };

  const retryLoad = (): void => {
    setReloadToken((value) => value + 1);
  };

  const visiblePages = useMemo(() => {
    const maxButtons = 6;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const half = Math.floor(maxButtons / 2);
    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, start + maxButtons - 1);

    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, totalPages]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    subject !== 'All' ||
    gradeLevel !== 'All' ||
    priceType !== 'all' ||
    selectedTags.length > 0 ||
    Boolean(minimumRating) ||
    sortBy !== 'popular';

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-black tracking-tight">{t('library.title')}</h1>
        <p className="max-w-3xl font-medium text-slate-500">
          {t('library.subtitle')}
        </p>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  applySearch();
                }
              }}
              placeholder={t('library.searchPlaceholder')}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={applySearch}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-5 text-sm font-black text-white transition hover:bg-primary-hover"
            >
              {t('library.searchButton')}
            </button>
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateParam('search', undefined);
                }}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
              >
                {t('library.clear')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <div className="sticky top-28 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400">
                <SlidersHorizontal size={16} /> {t('library.filters')}
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-bold text-primary hover:underline"
              >
                {t('library.resetAll')}
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <label className="flex flex-col gap-2 text-sm font-semibold">
                {t('library.subject')}
                <select
                  value={subject}
                  onChange={(event) => updateParam('subject', event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="All">{t('library.allSubjects')}</option>
                  {metadata.subjects.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold">
                {t('library.grade')}
                <select
                  value={gradeLevel}
                  onChange={(event) => updateParam('grade', event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="All">{t('library.allGrades')}</option>
                  {metadata.gradeLevels.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold">
                {t('library.price')}
                <select
                  value={priceType}
                  onChange={(event) => updateParam('price', event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                >
                  {priceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold">
                {t('library.minimumRating')}
                <select
                  value={minimumRating?.toString() ?? ''}
                  onChange={(event) => updateParam('rating', event.target.value || undefined)}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">{t('library.allRatings')}</option>
                  {metadata.ratingOptions.map((rating) => (
                    <option key={rating} value={rating}>
                      {t('library.starsAndUp', { rating })}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <span className="text-sm font-semibold">{t('library.tags')}</span>
                {metadata.tags.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800">
                    {t('library.tagsWillAppear')}
                  </p>
                ) : (
                  <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
                    {metadata.tags.map((tag) => {
                      const active = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                            active
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-slate-200 text-slate-600 hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {hasActiveFilters ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
                  {t('library.activeFilters')}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-slate-500">
                {t('library.showingResults', { count: total.toLocaleString() })}
              </span>
              {isRefreshing ? (
                <span className="text-xs font-medium text-primary">{t('library.updatingResults')}</span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{t('library.sortBy')}</span>
              <select
                value={sortBy}
                onChange={(event) => updateParam('sort', event.target.value)}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-primary focus:outline-none dark:border-slate-700 dark:bg-slate-900"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && items.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              {t('library.staleResults', { error })}
            </div>
          ) : null}

          {loading ? (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {loadingCards.map((card) => (
                <div
                  key={card}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="aspect-[4/3] animate-pulse bg-slate-200/70 dark:bg-slate-800" />
                  <div className="space-y-3 p-6">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800/80" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800/80" />
                  </div>
                </div>
              ))}
            </div>
          ) : error && items.length === 0 ? (
            <EmptyState
              title={t('library.unableToLoad')}
              description={error}
              action={
                <button
                  type="button"
                  onClick={retryLoad}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
                >
                  <RefreshCw size={16} /> {t('common.retry')}
                </button>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              title={t('library.noLessonsMatched')}
              description={t('library.noLessonsMatchedDescription')}
              action={
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
                >
                  <X size={16} /> {t('library.resetFilters')}
                </button>
              }
            />
          ) : (
            <>
              <div
                className={`grid grid-cols-1 gap-8 md:grid-cols-2 transition-opacity ${
                  isRefreshing ? 'opacity-75' : 'opacity-100'
                }`}
              >
                {items.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} />
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => updateParam('page', String(page - 1))}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
                  >
                    {t('library.previous')}
                  </button>

                  {visiblePages.map((candidate) => (
                    <button
                      key={candidate}
                      type="button"
                      onClick={() => updateParam('page', String(candidate))}
                      className={`size-10 rounded-xl text-sm font-bold ${
                        candidate === page
                          ? 'bg-primary text-white'
                          : 'border border-slate-200 text-slate-500 dark:border-slate-700'
                      }`}
                    >
                      {candidate}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => updateParam('page', String(page + 1))}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
                  >
                    {t('library.next')}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
