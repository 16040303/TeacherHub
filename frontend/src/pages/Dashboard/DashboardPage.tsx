import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CreditCard, Loader2, MessageSquare, Trash2, UploadCloud, Wallet } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { useLanguage } from '../../app/providers/LanguageProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { lessonsService } from '../../services/lessonsService';
import { communityService } from '../../services/communityService';
import { ordersService } from '../../services/ordersService';
import { walletService } from '../../services/walletService';
import { formatCoins, toDateTimeLabel } from '../../utils/format';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { Lesson, LessonStatus } from '../../types';

interface DashboardMetrics {
  publishedLessons: number;
  communityPosts: number;
  purchasedLessons: number;
  walletBalance: number;
}

const STATUS_BADGE_CLASS: Record<LessonStatus, string> = {
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  draft: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  hidden: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
};

const STATUS_ACTIONS_CONFIG: Record<
  LessonStatus,
  Array<{ target: LessonStatus; labelKey: string; confirmKey: string; tone?: 'primary' | 'neutral' }>
> = {
  published: [
    {
      target: 'draft',
      labelKey: 'dashboard.moveToDraft',
      confirmKey: 'dashboard.confirmMoveToDraft',
      tone: 'neutral',
    },
    {
      target: 'hidden',
      labelKey: 'dashboard.hideLesson',
      confirmKey: 'dashboard.confirmHideLesson',
      tone: 'neutral',
    },
  ],
  draft: [
    {
      target: 'published',
      labelKey: 'dashboard.publish',
      confirmKey: 'dashboard.confirmPublish',
      tone: 'primary',
    },
    {
      target: 'hidden',
      labelKey: 'dashboard.hide',
      confirmKey: 'dashboard.confirmHideDraft',
      tone: 'neutral',
    },
  ],
  hidden: [
    {
      target: 'published',
      labelKey: 'dashboard.republish',
      confirmKey: 'dashboard.confirmRepublish',
      tone: 'primary',
    },
    {
      target: 'draft',
      labelKey: 'dashboard.moveToDraft',
      confirmKey: 'dashboard.confirmMoveToDraftHidden',
      tone: 'neutral',
    },
  ],
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [latestLessons, setLatestLessons] = useState<Lesson[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    publishedLessons: 0,
    communityPosts: 0,
    purchasedLessons: 0,
    walletBalance: 0,
  });

  const [confirmDeleteLessonId, setConfirmDeleteLessonId] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [confirmStatusKey, setConfirmStatusKey] = useState<string | null>(null);
  const [updatingStatusLessonId, setUpdatingStatusLessonId] = useState<string | null>(null);

  const loadDashboard = useCallback(async (): Promise<void> => {
    if (!user) {
      setLoading(false);
      setLatestLessons([]);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const [ownLessons, posts, purchasedLessonIds, wallet] = await Promise.all([
        lessonsService.listLessonsByAuthor(user.id, true),
        communityService.listCommunityPosts({ page: 1, pageSize: 200 }),
        ordersService.listPurchasedLessonIds(user.id),
        walletService.getWallet(user.id),
      ]);

      setLatestLessons(ownLessons);
      setMetrics({
        publishedLessons: ownLessons.filter((lesson) => lesson.status === 'published').length,
        communityPosts: posts.data.filter((post) => post.authorId === user.id).length,
        purchasedLessons: purchasedLessonIds.length,
        walletBalance: wallet.balance,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('dashboard.dashboardError');
      setLoadError(message);
      setLatestLessons([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const cards = useMemo(
    () => [
      {
        label: t('dashboard.publishedLessons'),
        value: metrics.publishedLessons,
        icon: BookOpen,
        accent: 'text-blue-300 bg-blue-500/15',
      },
      {
        label: t('dashboard.communityPosts'),
        value: metrics.communityPosts,
        icon: MessageSquare,
        accent: 'text-violet-300 bg-violet-500/15',
      },
      {
        label: t('dashboard.purchasedLessons'),
        value: metrics.purchasedLessons,
        icon: CreditCard,
        accent: 'text-emerald-300 bg-emerald-500/15',
      },
      {
        label: t('dashboard.walletBalance'),
        value: `${formatCoins(metrics.walletBalance)} ${t('dashboard.coins') ?? 'coins'}`,
        icon: Wallet,
        accent: 'text-amber-300 bg-amber-500/15',
      },
    ],
    [metrics, t],
  );

  const handleDeleteLesson = async (lessonId: string): Promise<void> => {
    if (!user || deletingLessonId) {
      return;
    }

    setDeletingLessonId(lessonId);
    try {
      await lessonsService.deleteLesson(lessonId, user.id);
      showToast({ type: 'success', message: t('dashboard.deleteLessonSuccess') });
      setConfirmDeleteLessonId(null);
      await loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('dashboard.deleteLessonError');
      showToast({ type: 'error', message });
      setConfirmDeleteLessonId(null);
    } finally {
      setDeletingLessonId(null);
    }
  };

  const handleSetLessonStatus = async (lessonId: string, nextStatus: LessonStatus): Promise<void> => {
    if (!user || updatingStatusLessonId) {
      return;
    }

    setUpdatingStatusLessonId(lessonId);
    try {
      await lessonsService.setLessonStatus(lessonId, user.id, nextStatus);
      showToast({ type: 'success', message: t('dashboard.lessonMovedTo', { status: nextStatus }) });
      setConfirmStatusKey(null);
      await loadDashboard();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('dashboard.updateVisibilityError');
      showToast({ type: 'error', message });
      setConfirmStatusKey(null);
    } finally {
      setUpdatingStatusLessonId(null);
    }
  };

  if (loading) {
    return <LoadingState title={t('dashboard.loadDashboard')} description={t('dashboard.loadDashboardDescription')} />;
  }

  if (loadError) {
    return (
      <EmptyState
        title={t('dashboard.loadError')}
        description={loadError}
        action={
          <button
            type="button"
            onClick={() => {
              void loadDashboard();
            }}
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            {t('dashboard.retry')}
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-14">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-3xl font-black tracking-tight">{t('dashboard.welcomeTeacher', { name: user?.name ?? t('common.defaultUserName') })} 👋</h1>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
          {t('dashboard.activitySnapshot')}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
            >
              <div className={`mb-3 inline-flex size-10 items-center justify-center rounded-xl ${card.accent}`}>
                <card.icon size={18} />
              </div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{card.label}</p>
              <p className="mt-1 text-2xl font-black">{card.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          className="rounded-2xl border border-slate-200 bg-white p-5 font-bold transition hover:border-primary dark:border-slate-800 dark:bg-slate-900"
          to="/upload"
        >
          {t('dashboard.uploadNewLesson')}
        </Link>
        <Link
          className="rounded-2xl border border-slate-200 bg-white p-5 font-bold transition hover:border-primary dark:border-slate-800 dark:bg-slate-900"
          to="/wallet"
        >
          {t('dashboard.openWalletPayouts')}
        </Link>
        <Link
          className="rounded-2xl border border-slate-200 bg-white p-5 font-bold transition hover:border-primary dark:border-slate-800 dark:bg-slate-900"
          to="/community"
        >
          {t('dashboard.joinCommunityDiscussions')}
        </Link>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black tracking-tight">{t('dashboard.yourAuthoredLessons')}</h2>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-primary/20"
          >
            <UploadCloud size={14} /> {t('dashboard.uploadLesson')}
          </Link>
        </div>

        {latestLessons.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title={t('dashboard.noLessonsYet')}
              description={t('dashboard.createFirstLesson')}
              action={
                <Link
                  to="/upload"
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20"
                >
                  {t('dashboard.uploadLesson')}
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {latestLessons.map((lesson) => {
              const isPublished = lesson.status === 'published';
              const statusActions = STATUS_ACTIONS_CONFIG[lesson.status] ?? [];
              const statusClass = STATUS_BADGE_CLASS[lesson.status] ?? STATUS_BADGE_CLASS.draft;
              const isDeleting = deletingLessonId === lesson.id;
              const isUpdatingStatus = updatingStatusLessonId === lesson.id;

              return (
                <li
                  key={lesson.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-4 dark:border-slate-700"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold">{lesson.title}</p>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {lesson.subject} • {lesson.gradeLevel} • Updated {toDateTimeLabel(lesson.updatedAt)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}
                    >
                      {lesson.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                      to={`/upload?edit=${encodeURIComponent(lesson.id)}`}
                      className="font-bold text-primary transition hover:underline"
                    >
                      {t('dashboard.editLesson')}
                    </Link>

                    {isPublished ? (
                      <Link
                        to={`/lesson/${lesson.id}`}
                        className="font-bold text-slate-500 transition hover:text-primary"
                      >
                        {t('dashboard.viewDetails')}
                      </Link>
                    ) : null}

                    {statusActions.map((action) => {
                      const confirmKey = `${lesson.id}:${action.target}`;
                      const isConfirming = confirmStatusKey === confirmKey;

                      if (isConfirming) {
                        return (
                          <span key={confirmKey} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-800">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                              {t(action.confirmKey)}
                            </span>
                            <button
                              type="button"
                              disabled={isUpdatingStatus}
                              onClick={() => {
                                void handleSetLessonStatus(lesson.id, action.target);
                              }}
                              className="text-xs font-bold text-primary hover:underline disabled:opacity-60"
                            >
                              {isUpdatingStatus ? t('dashboard.updating') : t('dashboard.yes')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmStatusKey(null)}
                              className="text-xs font-bold text-slate-500 hover:underline"
                            >
                              {t('dashboard.no')}
                            </button>
                          </span>
                        );
                      }

                      return (
                        <button
                          key={confirmKey}
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() => setConfirmStatusKey(confirmKey)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition disabled:opacity-60 ${
                            action.tone === 'primary'
                              ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                              : 'border-slate-200 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {isUpdatingStatus ? (
                            <span className="inline-flex items-center gap-1">
                              <Loader2 size={12} className="animate-spin" /> {t('dashboard.updatingLesson')}
                            </span>
                          ) : (
                            t(action.labelKey)
                          )}
                        </button>
                      );
                    })}

                    {confirmDeleteLessonId === lesson.id ? (
                      <span className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-500/10 px-2 py-1 dark:border-rose-500/40">
                        <span className="text-xs font-medium text-rose-500">{t('dashboard.deleteLessonConfirm')}</span>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => {
                            void handleDeleteLesson(lesson.id);
                          }}
                          className="text-xs font-bold text-rose-500 hover:underline disabled:opacity-60"
                        >
                          {isDeleting ? t('dashboard.deletingLesson') : t('dashboard.yesDelete')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteLessonId(null)}
                          className="text-xs font-bold text-slate-500 hover:underline"
                        >
                          {t('dashboard.cancel')}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setConfirmDeleteLessonId(lesson.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-300/50 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-500 transition hover:bg-rose-500/20 disabled:opacity-60"
                      >
                        {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} {t('dashboard.deleteLesson')}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
