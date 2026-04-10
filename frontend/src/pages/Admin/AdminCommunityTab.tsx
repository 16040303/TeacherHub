import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  MessageSquare,
  Search,
  Trash2,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { useToast } from '../../app/providers/ToastProvider';
import { EmptyState } from '../../components/common/EmptyState';
import type { AdminCommunityModerationItem } from '../../types';
import { formatRelativeDate } from '../../utils/format';
import { useLanguage } from '../../app/providers/LanguageProvider';

interface Props {
  onRefreshRequest?: () => void;
}

export const AdminCommunityTab: React.FC<Props> = ({ onRefreshRequest }) => {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [items, setItems] = useState<AdminCommunityModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [contentType, setContentType] = useState<'all' | 'post' | 'comment'>('all');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await adminService.listCommunityForModeration({ search, contentType });
      setItems(rows);
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : t('admin.failedToLoadCommunityContent') });
    } finally {
      setLoading(false);
    }
  }, [search, contentType, showToast, t]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (item: AdminCommunityModerationItem) => {
    if (removingId) return;

    const contentLabel = t(item.contentType === 'post' ? 'admin.post' : 'admin.comment');
    const confirmed = window.confirm(
      t('admin.confirmRemoveCommunityContent', {
        type: contentLabel,
      }),
    );
    if (!confirmed) {
      return;
    }

    setRemovingId(item.id);
    try {
      await adminService.removeCommunityContent(item.id, item.contentType);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      showToast({ type: 'success', message: t(item.contentType === 'post' ? 'admin.postRemoved' : 'admin.commentRemoved') });
      onRefreshRequest?.();
    } catch (err) {
      showToast({ type: 'error', message: err instanceof Error ? err.message : t('admin.removalFailed') });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
        <h2 className="inline-flex items-center gap-2 text-xl font-black tracking-tight">
          <MessageSquare size={20} className="text-primary" /> {t('admin.communityModeration')}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.searchContentPlaceholder')}
              className="h-10 w-56 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="relative">
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value as 'all' | 'post' | 'comment')}
              className="h-10 appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-semibold outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="all">{t('admin.allContent')}</option>
              <option value="post">{t('admin.posts')}</option>
              <option value="comment">{t('admin.comments')}</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3 dark:border-slate-800">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {loading
            ? t('common.loadingDots')
            : t(items.length === 1 ? 'admin.itemsCountOne' : 'admin.itemsCountOther', { count: String(items.length) })}
        </p>
      </div>

      {!loading && items.length === 0 ? (
        <div className="p-6"><EmptyState title={t('admin.noCommunityContentFound')} description={t('admin.adjustFilters')} /></div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item) => (
            <article key={item.id} className="flex flex-col gap-3 p-6 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    item.contentType === 'post'
                      ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                      : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                  }`}>
                    {t(item.contentType === 'post' ? 'admin.post' : 'admin.comment')}
                  </span>
                  <span className="text-xs text-slate-400">{t('admin.by')} {item.authorName} • {formatRelativeDate(item.createdAt)}</span>
                </div>
                {item.title ? <h3 className="mt-1 font-black tracking-tight">{item.title}</h3> : null}
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.preview}</p>
                {item.postTitle ? <p className="mt-1 text-xs text-slate-400">{t('admin.onPost')}: {item.postTitle}</p> : null}
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                  {item.contentType === 'post' ? <span>{t('admin.likesComments', { likes: String(item.likes), comments: String(item.commentCount) })}</span> : null}
                </div>
              </div>
              <button
                type="button"
                disabled={removingId === item.id}
                onClick={() => { void remove(item); }}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-rose-500 px-3 text-xs font-bold text-white transition hover:bg-rose-600 disabled:opacity-60"
              >
                <Trash2 size={13} /> {removingId === item.id ? t('admin.removing') : t('admin.remove')}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
