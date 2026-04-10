import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ExternalLink, Search } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../app/providers/ToastProvider';
import { EmptyState } from '../../components/common/EmptyState';
import type {
  AdminReportFilters,
  AdminReportRow,
  ReportStatus,
  ReportTargetType,
} from '../../types';
import { formatRelativeDate } from '../../utils/format';
import { useLanguage } from '../../app/providers/LanguageProvider';

const STATUS_STYLES: Record<ReportStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  reviewing: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  dismissed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_LABEL_KEYS: Record<ReportStatus, string> = {
  pending: 'common.pending',
  reviewing: 'admin.reportsTab.reviewing',
  resolved: 'admin.reportsTab.resolved',
  dismissed: 'admin.reportsTab.dismissed',
};

const TARGET_STYLES: Record<ReportTargetType, string> = {
  post: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  comment: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  lesson: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  user: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const TARGET_LABEL_KEYS: Record<ReportTargetType, string> = {
  post: 'admin.reportsTab.targetPost',
  comment: 'admin.reportsTab.targetComment',
  lesson: 'admin.reportsTab.targetLesson',
  user: 'admin.reportsTab.targetUser',
};

const Badge: React.FC<{ label: string; className: string }> = ({ label, className }) => (
  <span
    className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${className}`}
  >
    {label}
  </span>
);

export const AdminReportsTab: React.FC = () => {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AdminReportFilters>({
    search: '',
    status: 'all',
    targetType: 'all',
  });
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await adminService.listReportsForAdmin(filters);
      setReports(rows);
    } catch (err) {
      showToast({
        type: 'error',
        message: err instanceof Error ? err.message : t('admin.reportsTab.failedToLoad'),
      });
    } finally {
      setLoading(false);
    }
  }, [filters, showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (reportId: string, status: ReportStatus) => {
    if (updatingId) return;
    setUpdatingId(reportId);
    try {
      const note = noteInputs[reportId]?.trim();
      const updated = await adminService.updateReportAsAdmin(reportId, {
        status,
        adminNote: note || undefined,
      });
      setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
      setNoteInputs((prev) => ({ ...prev, [reportId]: '' }));
      showToast({
        type: 'success',
        message: t('admin.reportsTab.reportMarked', {
          status: t(STATUS_LABEL_KEYS[status]).toLowerCase(),
        }),
      });
    } catch (err) {
      showToast({
        type: 'error',
        message: err instanceof Error ? err.message : t('admin.reportsTab.updateFailed'),
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUnavailableTarget = (reason?: string): void => {
    showToast({
      type: 'info',
      message: reason?.trim() || t('admin.reportsTab.unavailableTargetFallback'),
    });
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
        <h2 className="inline-flex items-center gap-2 text-xl font-black tracking-tight">
          <AlertTriangle size={20} className="text-amber-500" /> {t('admin.reportsTab.title')}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              placeholder={t('admin.reportsTab.searchPlaceholder')}
              className="h-10 w-56 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="relative">
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((p) => ({
                  ...p,
                  status: e.target.value as AdminReportFilters['status'],
                }))
              }
              className="h-10 appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-semibold outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="all">{t('admin.allStatus')}</option>
              <option value="pending">{t('common.pending')}</option>
              <option value="reviewing">{t('admin.reportsTab.reviewing')}</option>
              <option value="resolved">{t('admin.reportsTab.resolved')}</option>
              <option value="dismissed">{t('admin.reportsTab.dismissed')}</option>
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
          <div className="relative">
            <select
              value={filters.targetType}
              onChange={(e) =>
                setFilters((p) => ({
                  ...p,
                  targetType: e.target.value as AdminReportFilters['targetType'],
                }))
              }
              className="h-10 appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-semibold outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="all">{t('admin.reportsTab.allTargets')}</option>
              <option value="post">{t('admin.reportsTab.targetPost')}</option>
              <option value="comment">{t('admin.reportsTab.targetComment')}</option>
              <option value="lesson">{t('admin.reportsTab.targetLesson')}</option>
              <option value="user">{t('admin.reportsTab.targetUser')}</option>
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3 dark:border-slate-800">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {loading
            ? t('common.loadingDots')
            : t('admin.reportsTab.reportsCount', {
                count: String(reports.length),
                suffix: reports.length === 1 ? '' : t('common.s'),
              })}
        </p>
      </div>

      {!loading && reports.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title={t('admin.reportsTab.noReportsFound')}
            description={t('admin.adjustFiltersHint')}
          />
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {reports.map((report) => (
            <article key={report.id} className="p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      label={t(STATUS_LABEL_KEYS[report.status])}
                      className={STATUS_STYLES[report.status]}
                    />
                    <Badge
                      label={t(TARGET_LABEL_KEYS[report.targetType])}
                      className={TARGET_STYLES[report.targetType]}
                    />
                    <span className="text-xs text-slate-400">{report.category}</span>
                  </div>
                  <p className="mt-2 font-bold">{report.reason}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('admin.reportsTab.targetLabel', { target: report.targetPreview })}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {report.targetPath ? (
                      <Link
                        to={report.targetPath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-slate-300"
                      >
                        <ExternalLink size={12} /> {t('admin.reportsTab.openTarget')}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUnavailableTarget(report.targetUnavailableReason)}
                        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400"
                      >
                        {t('admin.reportsTab.targetUnavailable')}
                      </button>
                    )}
                    {report.targetUnavailableReason ? (
                      <span className="text-xs text-slate-400">{report.targetUnavailableReason}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {t('admin.reportsTab.reportedBy', { name: report.reporterName })} •{' '}
                    {formatRelativeDate(report.createdAt)}
                  </p>
                  {report.adminNote ? (
                    <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      <strong>{t('admin.reportsTab.adminNoteLabel')}</strong> {report.adminNote}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <input
                    placeholder={t('admin.reportsTab.adminNotePlaceholder')}
                    value={noteInputs[report.id] ?? ''}
                    onChange={(e) => setNoteInputs((p) => ({ ...p, [report.id]: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 lg:w-52"
                  />
                  <div className="flex flex-wrap gap-2">
                    {report.status !== 'reviewing' && (
                      <button
                        type="button"
                        disabled={updatingId === report.id}
                        onClick={() => {
                          void updateStatus(report.id, 'reviewing');
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-500 px-3 text-xs font-bold text-white transition hover:bg-sky-600 disabled:opacity-60"
                      >
                        {t('admin.reportsTab.reviewAction')}
                      </button>
                    )}
                    {report.status !== 'resolved' && (
                      <button
                        type="button"
                        disabled={updatingId === report.id}
                        onClick={() => {
                          void updateStatus(report.id, 'resolved');
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                      >
                        {t('admin.reportsTab.resolveAction')}
                      </button>
                    )}
                    {report.status !== 'dismissed' && (
                      <button
                        type="button"
                        disabled={updatingId === report.id}
                        onClick={() => {
                          void updateStatus(report.id, 'dismissed');
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-400 px-3 text-xs font-bold text-white transition hover:bg-slate-500 disabled:opacity-60"
                      >
                        {t('admin.reportsTab.dismissAction')}
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
  );
};
