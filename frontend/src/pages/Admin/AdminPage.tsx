import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../app/providers/LanguageProvider';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle,
  ChevronDown,
  Clock,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  MessageSquare,
  RefreshCcw,
  Search,
  Shield,
  ShoppingCart,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import type { AdminLessonModerationRow, AdminUserRow } from '../../repositories/adminRepository';
import {
  AdminDashboardSnapshot,
  AdminLessonModerationFilters,
  AdminRecentActivityItem,
  AdminUserFilters,
  DashboardStats,
  LessonModerationStatus,
  LessonStatus,
  UserRole,
  UserStatus,
  WalletTransaction,
} from '../../types';
import { formatCoins, formatRelativeDate, toDateLabel } from '../../utils/format';
import { AdminCommunityTab } from './AdminCommunityTab';
import { AdminReportsTab } from './AdminReportsTab';
import { AdminOrdersTab } from './AdminOrdersTab';
import { ADMIN_TAB_ITEMS, getAdminTabHref, toAdminTab } from './adminTabs';

/* ------------------------------------------------------------------ */
/*  Types & Defaults                                                   */
/* ------------------------------------------------------------------ */

const EMPTY_STATS: DashboardStats = {
  totalUsers: 0,
  totalCreators: 0,
  totalLessons: 0,
  totalCommunityPosts: 0,
  totalReports: 0,
  totalOrders: 0,
  totalTransactions: 0,
  totalRevenue: 0,
  pendingModerations: 0,
  pendingReports: 0,
};

const MODERATION_STATUS_STYLES: Record<LessonModerationStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const LIFECYCLE_STATUS_STYLES: Record<LessonStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  hidden: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const USER_STATUS_STYLES: Record<UserStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  suspended: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  locked: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

/* ------------------------------------------------------------------ */
/*  Helper Components                                                  */
/* ------------------------------------------------------------------ */

const Badge: React.FC<{ label: string; className: string }> = ({ label, className }) => (
  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${className}`}>
    {label}
  </span>
);

const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: string;
}> = ({ label, value, icon, accent }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <p className={`mt-2 inline-flex items-center gap-2 text-2xl font-black ${accent ?? ''}`}>
      {icon} {value}
    </p>
  </article>
);

const ActivityItem: React.FC<{ item: AdminRecentActivityItem }> = ({ item }) => {
  const iconMap: Record<AdminRecentActivityItem['type'], React.ReactNode> = {
    user_joined: <UserCheck size={14} className="text-primary" />,
    lesson_submitted: <FileText size={14} className="text-sky-500" />,
    lesson_moderated: <Shield size={14} className="text-amber-500" />,
    order_paid: <ShoppingCart size={14} className="text-emerald-500" />,
    report_flagged: <AlertTriangle size={14} className="text-rose-500" />,
  };

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
        {iconMap[item.type] ?? <Clock size={14} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{item.title}</p>
        {item.subtitle ? (
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
        ) : null}
      </div>
      <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeDate(item.createdAt)}</span>
    </li>
  );
};

/* ------------------------------------------------------------------ */
/*  AdminPage                                                          */
/* ------------------------------------------------------------------ */

export const AdminPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();

  /* --- shared state --- */
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const activeTab = toAdminTab(searchParams.get('tab'));

  /* --- dashboard --- */
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [recentActivity, setRecentActivity] = useState<AdminRecentActivityItem[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  /* --- users --- */
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userFilters, setUserFilters] = useState<AdminUserFilters>({ search: '', role: 'all', status: 'all' });
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  /* --- lessons --- */
  const [lessons, setLessons] = useState<AdminLessonModerationRow[]>([]);
  const [lessonFilters, setLessonFilters] = useState<AdminLessonModerationFilters>({ search: '', moderationStatus: 'all', lifecycleStatus: 'all' });
  const [moderatingLessonId, setModeratingLessonId] = useState<string | null>(null);
  const [moderationNotes, setModerationNotes] = useState<Record<string, string>>({});

  /* ---------------------------------------------------------------- */
  /*  Data loading                                                     */
  /* ---------------------------------------------------------------- */

  const loadDashboard = useCallback(async (): Promise<void> => {
    try {
      const [snapshot, recentTx] = await Promise.all([
        adminService.getAdminDashboardSnapshot(10),
        adminService.listRecentTransactions(8),
      ]);
      setStats(snapshot.stats);
      setRecentActivity(snapshot.recentActivity);
      setTransactions(recentTx);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('admin.unableToLoadDashboard');
      showToast({ type: 'error', message });
    }
  }, [showToast]);

  const loadUsers = useCallback(async (): Promise<void> => {
    try {
      const rows = await adminService.listUsersForAdmin(userFilters);
      setUsers(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('admin.unableToLoadUsers');
      showToast({ type: 'error', message });
    }
  }, [showToast, userFilters]);

  const loadLessons = useCallback(async (): Promise<void> => {
    try {
      const rows = await adminService.listLessonsForModeration(lessonFilters);
      setLessons(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('admin.unableToLoadLessons');
      showToast({ type: 'error', message });
    }
  }, [showToast, lessonFilters]);

  const loadAll = useCallback(async (): Promise<void> => {
    setLoading(true);
    await Promise.all([loadDashboard(), loadUsers(), loadLessons()]);
    setLoading(false);
  }, [loadDashboard, loadUsers, loadLessons]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  /* re-fetch subsections when filters change */
  useEffect(() => {
    if (!loading) {
      void loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFilters]);

  useEffect(() => {
    if (!loading) {
      void loadLessons();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonFilters]);

  /* ---------------------------------------------------------------- */
  /*  User actions                                                     */
  /* ---------------------------------------------------------------- */

  const updateRole = async (userId: string, role: UserRole): Promise<void> => {
    if (updatingUserId) return;

    const target = users.find((row) => row.id === userId);
    if (!target || target.role === role) {
      return;
    }

    const confirmed = window.confirm(
      `Change ${target.name}'s role from ${target.role} to ${role}?`,
    );
    if (!confirmed) {
      return;
    }

    setUpdatingUserId(userId);
    try {
      const updated = await adminService.updateUserAsAdmin(userId, { role });
      setUsers((prev) => prev.map((row) => (row.id === userId ? updated : row)));
      if (selectedUser?.id === userId) setSelectedUser(updated);
      showToast({ type: 'success', message: t('admin.roleUpdated') });
    } catch (error) {
      showToast({ type: 'error', message: error instanceof Error ? error.message : t('admin.unableToUpdateRole') });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const updateStatus = async (userId: string, status: UserStatus): Promise<void> => {
    if (updatingUserId) return;

    const target = users.find((row) => row.id === userId);
    if (!target || target.status === status) {
      return;
    }

    const confirmed = window.confirm(
      `Change ${target.name}'s account status from ${target.status} to ${status}?`,
    );
    if (!confirmed) {
      return;
    }

    setUpdatingUserId(userId);
    try {
      const updated = await adminService.updateUserAsAdmin(userId, { status });
      setUsers((prev) => prev.map((row) => (row.id === userId ? updated : row)));
      if (selectedUser?.id === userId) setSelectedUser(updated);
      showToast({ type: 'success', message: t('admin.statusUpdated') });
    } catch (error) {
      showToast({ type: 'error', message: error instanceof Error ? error.message : t('admin.unableToUpdateStatus') });
    } finally {
      setUpdatingUserId(null);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Lesson moderation actions                                        */
  /* ---------------------------------------------------------------- */

  const moderateLesson = async (
    lessonId: string,
    action: 'approve' | 'reject' | 'hide' | 'unhide',
  ): Promise<void> => {
    if (moderatingLessonId) return;

    const lesson = lessons.find((row) => row.id === lessonId);
    if (!lesson) {
      return;
    }

    const labels: Record<'approve' | 'reject' | 'hide' | 'unhide', string> = {
      approve: t('admin.approveAndPublish'),
      reject: t('admin.rejectAction'),
      hide: t('admin.hideFromMarketplace'),
      unhide: t('admin.restoreToPublished'),
    };

    const confirmed = window.confirm(`Are you sure you want to ${labels[action]} "${lesson.title}"?`);
    if (!confirmed) {
      return;
    }

    const noteForLesson = moderationNotes[lessonId]?.trim();

    setModeratingLessonId(lessonId);
    try {
      const updated = await adminService.moderateLessonAsAdmin(lessonId, {
        action,
        note: noteForLesson || undefined,
        adminId: currentUser?.id,
      });
      setLessons((prev) => prev.map((row) => (row.id === lessonId ? updated : row)));
      setModerationNotes((prev) => {
        if (!prev[lessonId]) {
          return prev;
        }

        const next = { ...prev };
        delete next[lessonId];
        return next;
      });
      const successLabels: Record<string, string> = {
        approve: t('admin.lessonApproved'),
        reject: t('admin.lessonRejected'),
        hide: t('admin.lessonHidden'),
        unhide: t('admin.lessonUnhidden'),
      };
      showToast({ type: 'success', message: successLabels[action] });
    } catch (error) {
      showToast({ type: 'error', message: error instanceof Error ? error.message : t('admin.moderationFailed') });
    } finally {
      setModeratingLessonId(null);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Filtered views                                                   */
  /* ---------------------------------------------------------------- */

  const filteredUsers = useMemo(() => users, [users]);

  const filteredLessons = useMemo(() => lessons, [lessons]);

  /* ---------------------------------------------------------------- */
  /*  Loading screen                                                   */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <LoadingState
        title={t('admin.loadingDashboard')}
        description={t('admin.loadingDashboardDescription')}
      />
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-8 pb-16">
      <section className="rounded-[1.85rem] border border-slate-200/80 bg-slate-50/95 p-2 shadow-sm dark:border-slate-700/90 dark:bg-slate-800/75">
        <nav className="flex flex-wrap items-center gap-2.5" aria-label="Admin sections">
          {ADMIN_TAB_ITEMS.map((item) => {
            const active = activeTab === item.key;
            const count = item.countFrom ? item.countFrom(stats) : undefined;

            return (
              <Link
                key={item.key}
                to={getAdminTabHref(item.key)}
                aria-current={active ? 'page' : undefined}
                className={`group inline-flex h-10 shrink-0 items-center gap-2.5 rounded-2xl px-4 text-sm font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'border border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                <span className={`inline-flex items-center justify-center ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'}`}>
                  <item.icon size={15} />
                </span>
                <span className="whitespace-nowrap">{t(item.labelKey)}</span>
                {typeof count === 'number' ? (
                  <span
                    className={`ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none ${
                      active ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </section>

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t('admin.title')}</h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {t('admin.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void loadAll(); }}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover"
        >
          <RefreshCcw size={16} /> {t('admin.refreshData')}
        </button>
      </div>


      {/* ============================================================ */}
      {/*  DASHBOARD TAB                                                */}
      {/* ============================================================ */}
      {activeTab === 'dashboard' && (
        <>
          {/* Stat cards */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label={t('admin.totalUsers')} value={stats.totalUsers} icon={<Users size={20} className="text-primary" />} />
            <StatCard label={t('admin.creators')} value={stats.totalCreators} icon={<UserCheck size={20} className="text-sky-500" />} />
            <StatCard label={t('admin.lessons')} value={stats.totalLessons} icon={<BookOpen size={20} className="text-violet-500" />} />
            <StatCard label={t('admin.communityPosts')} value={stats.totalCommunityPosts} icon={<MessageSquare size={20} className="text-emerald-500" />} />
            <StatCard label={t('admin.pendingModeration')} value={stats.pendingModerations} icon={<AlertTriangle size={20} className="text-amber-400" />} accent={stats.pendingModerations > 0 ? 'text-amber-500' : ''} />
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t('admin.totalOrders')} value={stats.totalOrders} icon={<ShoppingCart size={20} className="text-indigo-500" />} />
            <StatCard label={t('admin.transactions')} value={stats.totalTransactions} icon={<Wallet size={20} className="text-primary" />} />
            <StatCard label={t('admin.revenue')} value={`${formatCoins(stats.totalRevenue)} coins`} icon={<TrendingUp size={20} className="text-emerald-500" />} />
            <StatCard label={t('admin.pendingReports')} value={stats.pendingReports} icon={<AlertTriangle size={20} className="text-rose-400" />} />
          </section>

          {/* Recent Activity + Transactions */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Activity */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 p-5 dark:border-slate-800">
                <h2 className="text-lg font-black tracking-tight">{t('admin.recentActivity')}</h2>
              </div>
              {recentActivity.length === 0 ? (
                <div className="p-5">
                  <EmptyState title={t('admin.noRecentActivity')} />
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 p-5 dark:divide-slate-800">
                  {recentActivity.slice(0, 8).map((item) => (
                    <ActivityItem key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </section>

            {/* Recent Transactions */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 p-5 dark:border-slate-800">
                <h2 className="text-lg font-black tracking-tight">{t('admin.recentTransactions')}</h2>
              </div>
              {transactions.length === 0 ? (
                <div className="p-5">
                  <EmptyState title={t('admin.noRecentTransactions')} />
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transactions.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{tx.description}</p>
                        <p className="text-xs text-slate-500">{tx.type} • {formatRelativeDate(tx.date)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-black ${tx.amount > 0 ? 'text-emerald-500' : 'text-slate-900 dark:text-slate-100'}`}>
                          {tx.amount > 0 ? '+' : ''}{formatCoins(tx.amount)} coins
                        </p>
                        <p className="text-[11px] capitalize text-slate-500">{tx.status}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/*  USERS TAB                                                    */}
      {/* ============================================================ */}
      {activeTab === 'users' && (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-slate-100 p-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <h2 className="inline-flex items-center gap-2 text-xl font-black tracking-tight">
              <Shield size={20} className="text-primary" /> {t('admin.userManagement')}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={userFilters.search}
                  onChange={(e) => setUserFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder={t('admin.searchUsers')}
                  className="h-10 w-56 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="relative">
                <select
                  value={userFilters.role}
                  onChange={(e) => setUserFilters((prev) => ({ ...prev, role: e.target.value as AdminUserFilters['role'] }))}
                  className="h-10 appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-semibold outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                  <option value="guest">Guest</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
              <div className="relative">
                <select
                  value={userFilters.status}
                  onChange={(e) => setUserFilters((prev) => ({ ...prev, status: e.target.value as AdminUserFilters['status'] }))}
                  className="h-10 appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-semibold outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="locked">Locked</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          {/* User detail panel */}
          {selectedUser && (
            <div className="border-b border-slate-100 bg-slate-50/60 p-6 dark:border-slate-800 dark:bg-slate-800/30">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <img
                    src={selectedUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name)}&background=random`}
                    alt={selectedUser.name}
                    className="size-14 rounded-2xl object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name)}&background=random`; }}
                  />
                  <div>
                    <h3 className="text-lg font-black">{selectedUser.name}</h3>
                    <p className="text-sm text-slate-500">{selectedUser.email}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge label={selectedUser.role} className="bg-primary/10 text-primary" />
                      <Badge label={selectedUser.status} className={USER_STATUS_STYLES[selectedUser.status] ?? 'bg-slate-100 text-slate-600'} />
                    </div>
                  </div>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  <p><strong>{t('admin.subject')}:</strong> {selectedUser.subject || '—'}</p>
                  <p><strong>{t('admin.location')}:</strong> {selectedUser.location || '—'}</p>
                  <p><strong>{t('admin.joined')}:</strong> {toDateLabel(selectedUser.createdAt)}</p>
                  <p><strong>{t('admin.lessonsLabel')}:</strong> {selectedUser.publishedLessons} {t('admin.publishedOf')} / {selectedUser.lessonsCount} {t('admin.total')}</p>
                  <p><strong>{t('admin.downloads')}:</strong> {selectedUser.totalDownloads}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="shrink-0 text-xs font-bold text-slate-400 transition hover:text-slate-600"
                >
                  {t('admin.close')} ✕
                </button>
              </div>
            </div>
          )}

          {/* User table */}
          {filteredUsers.length === 0 ? (
            <div className="p-6">
              <EmptyState title={t('admin.noMatchingUsers')} description={t('admin.broaderSearchHint')} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:bg-slate-800/50">
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3">Lessons</th>
                    <th className="px-6 py-3">Downloads</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.map((row) => (
                    <tr
                      key={row.id}
                      className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40 ${selectedUser?.id === row.id ? 'bg-primary/5' : ''}`}
                      onClick={() => setSelectedUser(row)}
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{toDateLabel(row.createdAt)}</td>
                      <td className="px-6 py-4 text-sm">
                        {row.publishedLessons} / {row.lessonsCount}
                      </td>
                      <td className="px-6 py-4 text-sm">{row.totalDownloads}</td>
                      <td className="px-6 py-4">
                        <select
                          value={row.role}
                          disabled={updatingUserId === row.id}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { void updateRole(row.id, e.target.value as UserRole); }}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                          <option value="guest">guest</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={row.status}
                          disabled={updatingUserId === row.id}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { void updateStatus(row.id, e.target.value as UserStatus); }}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                        >
                          <option value="active">active</option>
                          <option value="suspended">suspended</option>
                          <option value="locked">locked</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ============================================================ */}
      {/*  LESSON MODERATION TAB                                        */}
      {/* ============================================================ */}
      {activeTab === 'lessons' && (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-slate-100 p-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
            <h2 className="inline-flex items-center gap-2 text-xl font-black tracking-tight">
              <BookOpen size={20} className="text-primary" /> {t('admin.lessonModeration')}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={lessonFilters.search}
                  onChange={(e) => setLessonFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder={t('admin.searchLessons')}
                  className="h-10 w-56 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="relative">
                <select
                  value={lessonFilters.moderationStatus}
                  onChange={(e) => setLessonFilters((prev) => ({ ...prev, moderationStatus: e.target.value as AdminLessonModerationFilters['moderationStatus'] }))}
                  className="h-10 appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-semibold outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="all">All Moderation</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
              <div className="relative">
                <select
                  value={lessonFilters.lifecycleStatus}
                  onChange={(e) => setLessonFilters((prev) => ({ ...prev, lifecycleStatus: e.target.value as AdminLessonModerationFilters['lifecycleStatus'] }))}
                  className="h-10 appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-semibold outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="hidden">Hidden</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Moderation count */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3 dark:border-slate-800">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {filteredLessons.length} lesson{filteredLessons.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Lesson cards */}
          {filteredLessons.length === 0 ? (
            <div className="p-6">
              <EmptyState title={t('admin.noLessonsInQueue')} description={t('admin.adjustFiltersHint')} />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLessons.map((lesson) => (
                <article key={lesson.id} className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Left: lesson info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge label={lesson.moderationStatus} className={MODERATION_STATUS_STYLES[lesson.moderationStatus]} />
                        <Badge label={lesson.status} className={LIFECYCLE_STATUS_STYLES[lesson.status]} />
                        <span className="text-xs text-slate-400">{lesson.subject} • {lesson.gradeLevel}</span>
                      </div>
                      <h3 className="mt-2 text-lg font-black tracking-tight">{lesson.title}</h3>
                      <p className="text-sm text-slate-500">
                        by {lesson.authorName} • {toDateLabel(lesson.createdAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1"><Download size={12} /> {lesson.downloads}</span>
                        <span className="inline-flex items-center gap-1"><Star size={12} /> {lesson.rating.toFixed(1)}</span>
                        <span className="inline-flex items-center gap-1"><Wallet size={12} /> {lesson.price === 0 ? t('admin.free') : `${formatCoins(lesson.price)} coins`}</span>
                      </div>
                      {lesson.moderationNote ? (
                        <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          <strong>{t('admin.noteLabel')}:</strong> {lesson.moderationNote}
                        </p>
                      ) : null}
                      {lesson.moderationUpdatedAt ? (
                        <p className="mt-1 text-[11px] text-slate-400">
                          {t('admin.lastModerated')}: {formatRelativeDate(lesson.moderationUpdatedAt)}
                          {lesson.moderationUpdatedBy ? ` by ${lesson.moderationUpdatedBy}` : ''}
                        </p>
                      ) : null}
                    </div>

                    {/* Right: actions */}
                    <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                      <Link
                        to={`/lesson/${lesson.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <ExternalLink size={13} /> {t('admin.previewLesson')}
                      </Link>
                      <input
                        placeholder={t('admin.moderationNotePlaceholder')}
                        value={moderationNotes[lesson.id] ?? ''}
                        onChange={(e) =>
                          setModerationNotes((prev) => ({
                            ...prev,
                            [lesson.id]: e.target.value,
                          }))
                        }
                        disabled={moderatingLessonId === lesson.id}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 lg:w-56"
                      />
                      <div className="flex flex-wrap gap-2">
                        {lesson.moderationStatus !== 'approved' && lesson.status !== 'published' && (
                          <button
                            type="button"
                            disabled={moderatingLessonId === lesson.id}
                            onClick={() => { void moderateLesson(lesson.id, 'approve'); }}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                          >
                            <CheckCircle size={13} /> {t('admin.approve')}
                          </button>
                        )}
                        {lesson.moderationStatus !== 'rejected' && (
                          <button
                            type="button"
                            disabled={moderatingLessonId === lesson.id}
                            onClick={() => { void moderateLesson(lesson.id, 'reject'); }}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-500 px-3 text-xs font-bold text-white transition hover:bg-rose-600 disabled:opacity-60"
                          >
                            <XCircle size={13} /> {t('admin.reject')}
                          </button>
                        )}
                        {lesson.status === 'published' && (
                          <button
                            type="button"
                            disabled={moderatingLessonId === lesson.id}
                            onClick={() => { void moderateLesson(lesson.id, 'hide'); }}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-orange-500 px-3 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
                          >
                            <EyeOff size={13} /> {t('admin.hide')}
                          </button>
                        )}
                        {lesson.status === 'hidden' && (
                          <button
                            type="button"
                            disabled={moderatingLessonId === lesson.id}
                            onClick={() => { void moderateLesson(lesson.id, 'unhide'); }}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-500 px-3 text-xs font-bold text-white transition hover:bg-sky-600 disabled:opacity-60"
                          >
                            <Eye size={13} /> {t('admin.unhide')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ============================================================ */}
      {/*  COMMUNITY MODERATION TAB                                    */}
      {/* ============================================================ */}
      {activeTab === 'community' && (
        <AdminCommunityTab onRefreshRequest={() => { void loadDashboard(); }} />
      )}

      {/* ============================================================ */}
      {/*  REPORT MANAGEMENT TAB                                        */}
      {/* ============================================================ */}
      {activeTab === 'reports' && (
        <AdminReportsTab />
      )}

      {/* ============================================================ */}
      {/*  ORDERS & TRANSACTIONS TAB                                    */}
      {/* ============================================================ */}
      {activeTab === 'orders' && (
        <AdminOrdersTab />
      )}
    </div>
  );
};
