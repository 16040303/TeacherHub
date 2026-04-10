import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../app/providers/LanguageProvider';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Edit3,
  Flag,
  Heart,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { communityService } from '../../services/communityService';
import { profileService } from '../../services/profileService';
import { followsService } from '../../services/followsService';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { CommunityPost } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { LoginRequiredPrompt } from '../../components/common/LoginRequiredPrompt';
import { formatRelativeDate } from '../../utils/format';

interface FeedPost extends CommunityPost {
  authorName: string;
  authorAvatar: string;
  commentsCount: number;
}

interface Contributor {
  userId: string;
  name: string;
  avatar?: string;
  posts: number;
}

const defaultComposer = {
  title: '',
  content: '',
  category: 'General',
  tags: '',
};

const REPORT_CATEGORIES = ['Spam', 'Harassment', 'Misinformation', 'Inappropriate', 'Other'] as const;

const COMMUNITY_FEED_BATCH_SIZE = 8;

const resolveAvatar = (avatar: string | undefined, seed: string): string => {
  const normalized = avatar?.trim();
  return normalized && normalized.length > 0 ? normalized : `https://picsum.photos/seed/${seed}/100/100`;
};

const buildContributors = (rows: FeedPost[]): Contributor[] => {
  const contributorMap = new Map<string, Contributor>();

  rows.forEach((post) => {
    const existing = contributorMap.get(post.authorId);
    if (existing) {
      existing.posts += 1;
      return;
    }

    contributorMap.set(post.authorId, {
      userId: post.authorId,
      name: post.authorName,
      avatar: post.authorAvatar,
      posts: 1,
    });
  });

  return Array.from(contributorMap.values())
    .sort((a, b) => b.posts - a.posts)
    .slice(0, 4);
};

const areStringArraysEqual = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
};

export const CommunityPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeLikePostId, setActiveLikePostId] = useState<string | null>(null);
  const [activeSavePostId, setActiveSavePostId] = useState<string | null>(null);
  const [followingContributorId, setFollowingContributorId] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('query')?.trim() ?? '';
  const categoryFilter = searchParams.get('category')?.trim() || 'all';
  const [queryInput, setQueryInput] = useState(query);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [topics, setTopics] = useState<Array<{ tag: string; count: number }>>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [composer, setComposer] = useState(defaultComposer);
  const [visibleCount, setVisibleCount] = useState(COMMUNITY_FEED_BATCH_SIZE);
  const initialLoadDone = useRef(false);

  /* ── Edit post state ── */
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  /* ── Delete post state ── */
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  /* ── Report modal state ── */
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportCategory, setReportCategory] = useState<string>(REPORT_CATEGORIES[0]);
  const [submittingReport, setSubmittingReport] = useState(false);

  const loadData = useCallback(async (): Promise<void> => {
    if (!initialLoadDone.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    const normalizedQuery = query.trim();
    const normalizedCategory = categoryFilter.trim() || 'all';

    if (import.meta.env.DEV) {
      console.debug('[CommunityPage] Fetching feed', {
        query: normalizedQuery,
        category: normalizedCategory,
        reloadToken,
      });
    }

    setFeedError(null);

    try {
      const [feed, trending, users] = await Promise.all([
        communityService.listCommunityPosts({
          page: 1,
          pageSize: 200,
          search: normalizedQuery || undefined,
          category: normalizedCategory,
        }),
        communityService.listTrendingTopics(),
        profileService.listPublicUsers(),
      ]);

      const userMap = new Map(users.map((item) => [item.id, item]));
      const commentCountMap = await communityService.listCommunityCommentCounts(feed.data.map((post) => post.id));

      const hydrated: FeedPost[] = feed.data.map((post) => {
        const author = userMap.get(post.authorId);
        return {
          ...post,
          authorName: author?.name ?? t('community.unknownTeacher'),
          authorAvatar: resolveAvatar(author?.avatar, post.authorId),
          commentsCount: commentCountMap[post.id] ?? 0,
        };
      });

      setPosts(hydrated);
      setTopics(trending);
      setContributors(buildContributors(hydrated));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('community.unableToLoadFeed');
      setFeedError(message);
      showToast({ type: 'error', message });
    } finally {
      initialLoadDone.current = true;
      setRefreshing(false);
      setLoading(false);
    }
  }, [categoryFilter, query, reloadToken, showToast]);

  useEffect(() => {
    setQueryInput(query);
  }, [query]);

  useEffect(() => {
    setVisibleCount(COMMUNITY_FEED_BATCH_SIZE);
  }, [categoryFilter, query]);

  useEffect(() => {
    const normalizedInput = queryInput.trim();
    if (normalizedInput === query) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);

        if (normalizedInput) {
          next.set('query', normalizedInput);
        } else {
          next.delete('query');
        }

        return current.toString() === next.toString() ? current : next;
      });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query, queryInput, setSearchParams]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setFollowingIds((current) => (current.length > 0 ? [] : current));
      return;
    }

    let active = true;

    const loadFollowingIds = async (): Promise<void> => {
      try {
        const ids = await followsService.listFollowingIds(user.id);
        if (active) {
          setFollowingIds((current) =>
            areStringArraysEqual(current, ids) ? current : ids,
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        const message = error instanceof Error ? error.message : t('community.unableToLoadFollowData');
        showToast({ type: 'error', message });
      }
    };

    void loadFollowingIds();

    return () => {
      active = false;
    };
  }, [isAuthenticated, showToast, user?.id]);

  const categories = useMemo(() => {
    const set = new Set<string>(['all']);
    if (categoryFilter !== 'all') {
      set.add(categoryFilter);
    }
    posts.forEach((post) => set.add(post.category));
    return Array.from(set);
  }, [categoryFilter, posts]);

  const visiblePosts = useMemo(() => posts.slice(0, visibleCount), [posts, visibleCount]);

  const hasMorePosts = visibleCount < posts.length;
  const visiblePostCount = Math.min(visibleCount, posts.length);
  const hasActiveFeedFilters = query.length > 0 || categoryFilter !== 'all';

  const emptyFeedDescription = hasActiveFeedFilters
    ? t('community.noMatchingFilters')
    : t('community.emptyFeedHint');

  const loadMorePosts = (): void => {
    setVisibleCount((current) => Math.min(current + COMMUNITY_FEED_BATCH_SIZE, posts.length));
  };

  const updateCategoryFilter = (nextCategory: string): void => {
    const normalizedCategory = nextCategory.trim() || 'all';

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (normalizedCategory === 'all') {
        next.delete('category');
      } else {
        next.set('category', normalizedCategory);
      }

      return current.toString() === next.toString() ? current : next;
    });
  };

  const refreshFeed = (): void => {
    setReloadToken((current) => current + 1);
  };

  const requireAuthForAction = (message: string): boolean => {
    if (isAuthenticated && user) {
      setActionMessage(null);
      return true;
    }

    setActionMessage(message);
    showToast({ type: 'info', message });
    return false;
  };

  const handleLike = async (postId: string): Promise<void> => {
    if (!requireAuthForAction(t('community.loginToLike'))) {
      return;
    }

    if (activeLikePostId === postId || !user) {
      return;
    }

    const previousPosts = posts;
    const optimisticPosts = posts.map((post) => {
      if (post.id !== postId) {
        return post;
      }

      const hasLiked = post.likedBy.includes(user.id);
      const nextLikedBy = hasLiked ? post.likedBy.filter((id) => id !== user.id) : [...post.likedBy, user.id];

      return {
        ...post,
        likedBy: nextLikedBy,
        likes: Math.max(0, nextLikedBy.length),
      };
    });

    setPosts(optimisticPosts);
    setActiveLikePostId(postId);

    try {
      const updatedPost = await communityService.toggleCommunityPostLike(postId, user.id);
      setPosts((current) =>
        current.map((post) => {
          if (post.id !== postId) {
            return post;
          }

          return {
            ...post,
            ...updatedPost,
            commentsCount: post.commentsCount,
            authorName: post.authorName,
            authorAvatar: post.authorAvatar,
          };
        }),
      );
    } catch (error) {
      setPosts(previousPosts);
      const message = error instanceof Error ? error.message : t('community.unableToUpdateLike');
      showToast({ type: 'error', message });
    } finally {
      setActiveLikePostId(null);
    }
  };

  const handleSave = async (postId: string): Promise<void> => {
    if (!requireAuthForAction(t('community.loginToSave'))) {
      return;
    }

    if (activeSavePostId === postId || !user) {
      return;
    }

    const previousPosts = posts;
    const optimisticPosts = posts.map((post) => {
      if (post.id !== postId) {
        return post;
      }

      const hasSaved = post.savedBy.includes(user.id);
      const nextSavedBy = hasSaved ? post.savedBy.filter((id) => id !== user.id) : [...post.savedBy, user.id];

      return {
        ...post,
        savedBy: nextSavedBy,
      };
    });

    setPosts(optimisticPosts);
    setActiveSavePostId(postId);

    try {
      const updatedPost = await communityService.toggleCommunityPostSave(postId, user.id);
      setPosts((current) =>
        current.map((post) => {
          if (post.id !== postId) {
            return post;
          }

          return {
            ...post,
            ...updatedPost,
            commentsCount: post.commentsCount,
            authorName: post.authorName,
            authorAvatar: post.authorAvatar,
          };
        }),
      );
    } catch (error) {
      setPosts(previousPosts);
      const message = error instanceof Error ? error.message : t('community.unableToUpdateSaved');
      showToast({ type: 'error', message });
    } finally {
      setActiveSavePostId(null);
    }
  };

  const handleToggleContributorFollow = async (contributor: Contributor): Promise<void> => {
    if (contributor.userId === user?.id) {
      return;
    }

    if (!requireAuthForAction(t('community.loginToFollow'))) {
      return;
    }

    if (!user || followingContributorId === contributor.userId) {
      return;
    }

    const wasFollowing = followingIds.includes(contributor.userId);
    const previousFollowingIds = [...followingIds];

    setFollowingContributorId(contributor.userId);
    setFollowingIds((current) =>
      wasFollowing
        ? current.filter((entry) => entry !== contributor.userId)
        : [...current, contributor.userId],
    );

    try {
      if (wasFollowing) {
        await followsService.unfollowUser(user.id, contributor.userId);
        showToast({ type: 'info', message: t('community.unfollowed', { values: { name: contributor.name } }) });
      } else {
        await followsService.followUser(user.id, contributor.userId);
        showToast({ type: 'success', message: t('community.nowFollowing', { values: { name: contributor.name } }) });
      }
    } catch (error) {
      setFollowingIds(previousFollowingIds);
      const message = error instanceof Error ? error.message : t('community.unableToUpdateFollow');
      showToast({ type: 'error', message });
    } finally {
      setFollowingContributorId(null);
    }
  };

  const handleCreatePost = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!user || !isAuthenticated || saving) {
      if (!isAuthenticated) {
        setActionMessage(t('community.loginToDiscuss'));
      }
      return;
    }

    setSaving(true);

    try {
      const created = await communityService.createCommunityPost(user.id, {
        title: composer.title,
        content: composer.content,
        category: composer.category,
        tags: composer.tags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });

      const authorAvatar = resolveAvatar(user.avatar, user.id);
      const localPost: FeedPost = {
        ...created,
        authorName: user.name,
        authorAvatar,
        commentsCount: 0,
      };

      setPosts((current) => [localPost, ...current]);
      setTopics((current) => {
        const topicCounts = new Map<string, number>(current.map((item) => [item.tag, item.count]));
        created.tags.forEach((tag) => {
          const normalized = tag.trim().toLowerCase();
          if (!normalized) {
            return;
          }
          topicCounts.set(normalized, (topicCounts.get(normalized) ?? 0) + 1);
        });

        return Array.from(topicCounts.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((left, right) => right.count - left.count)
          .slice(0, 8);
      });
      setContributors((current) => {
        const map = new Map<string, Contributor>(current.map((item) => [item.userId, { ...item }]));
        const existing = map.get(user.id);

        if (existing) {
          existing.posts += 1;
        } else {
          map.set(user.id, {
            userId: user.id,
            name: user.name,
            avatar: authorAvatar,
            posts: 1,
          });
        }

        return Array.from(map.values())
          .sort((a, b) => b.posts - a.posts)
          .slice(0, 4);
      });
      setComposer(defaultComposer);
      setShowComposer(false);
      setActionMessage(null);

      showToast({ type: 'success', message: t('community.postCreated') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('community.unableToCreatePost');
      showToast({ type: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  /* ── Edit post (feed-level) ── */
  const startEditingPost = (post: FeedPost): void => {
    setComposer({
      title: post.title,
      content: post.content,
      category: post.category,
      tags: post.tags.join(', '),
    });
    setEditingPostId(post.id);
    setShowComposer(true);
  };

  const handleUpdatePost = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!user || !editingPostId || savingEdit) return;

    setSavingEdit(true);
    try {
      const updated = await communityService.updateCommunityPost(editingPostId, user.id, {
        title: composer.title,
        content: composer.content,
        category: composer.category,
        tags: composer.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });

      setPosts((current) =>
        current.map((p) => {
          if (p.id !== editingPostId) return p;
          return { ...p, ...updated, commentsCount: p.commentsCount, authorName: p.authorName, authorAvatar: p.authorAvatar };
        }),
      );

      setComposer(defaultComposer);
      setShowComposer(false);
      setEditingPostId(null);
      showToast({ type: 'success', message: t('community.postUpdated') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('community.unableToUpdatePost');
      showToast({ type: 'error', message });
    } finally {
      setSavingEdit(false);
    }
  };

  /* ── Delete post (feed-level) ── */
  const handleDeletePost = async (postId: string): Promise<void> => {
    if (!user || deletingPostId) return;

    setDeletingPostId(postId);
    try {
      await communityService.deleteCommunityPost(postId, user.id);
      setPosts((current) => current.filter((p) => p.id !== postId));
      setConfirmDeletePostId(null);
      showToast({ type: 'success', message: t('community.postDeleted') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('community.unableToDeletePost');
      showToast({ type: 'error', message });
      setConfirmDeletePostId(null);
    } finally {
      setDeletingPostId(null);
    }
  };

  /* ── Report (feed-level) ── */
  const openReportModal = (type: 'post' | 'comment', targetId: string): void => {
    if (!requireAuthForAction(t('community.loginToReport'))) return;
    setReportTarget({ type, id: targetId });
    setReportReason('');
    setReportCategory(REPORT_CATEGORIES[0]);
  };

  const closeReportModal = (): void => {
    setReportTarget(null);
    setReportReason('');
    setReportCategory(REPORT_CATEGORIES[0]);
  };

  const handleSubmitReport = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!user || !reportTarget || submittingReport) return;

    setSubmittingReport(true);
    try {
      await communityService.createCommunityReport(user.id, {
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        reason: reportReason,
        category: reportCategory,
      });
      showToast({ type: 'success', message: t('community.reportSubmitted') });
      closeReportModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('community.unableToSubmitReport');
      showToast({ type: 'error', message });
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return <LoadingState title={t('community.loadingTitle')} description={t('community.loadingDescription')} />;
  }

  return (
    <div className="flex flex-col gap-10 pb-20">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tight">{t('community.title')}</h1>
          <p className="font-medium text-slate-500">{t('community.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              setActionMessage(t('community.loginToDiscuss'));
              showToast({ type: 'info', message: t('community.loginToDiscuss') });
              return;
            }
            setActionMessage(null);
            setShowComposer((current) => !current);
          }}
          className="flex h-14 items-center gap-2 rounded-2xl bg-primary px-8 font-black text-white shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover"
        >
          <Plus size={22} /> {t('community.startDiscussion')}
        </button>
      </div>

      {actionMessage ? (
        <LoginRequiredPrompt
          message={actionMessage}
          redirectPath="/community"
          onDismiss={() => setActionMessage(null)}
        />
      ) : null}

      {/* ── Report Modal ── */}
      {reportTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-black">
                <Flag size={18} className="text-amber-500" /> {t('community.reportPost')}
              </h3>
              <button type="button" onClick={closeReportModal} className="text-slate-400 transition hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitReport} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                {t('community.category')}
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium normal-case outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                >
                  {REPORT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                {t('community.reason')}
                <textarea
                  required
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder={t('community.reportPlaceholder')}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium normal-case outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeReportModal} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700">
                  {t('community.cancel')}
                </button>
                <button type="submit" disabled={submittingReport || !reportReason.trim()} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                  {submittingReport ? t('community.submitting') : t('community.submitReport')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showComposer ? (
        <form onSubmit={editingPostId ? handleUpdatePost : handleCreatePost} className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          {editingPostId ? (
            <p className="mb-3 text-sm font-black uppercase tracking-wider text-primary">{t('community.editingPost')}</p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <input
              required
              value={composer.title}
              onChange={(event) => setComposer((current) => ({ ...current, title: event.target.value }))}
              placeholder={t('community.discussionTitle')}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 md:col-span-2"
            />
            <input
              required
              value={composer.category}
              onChange={(event) => setComposer((current) => ({ ...current, category: event.target.value }))}
              placeholder={t('community.categoryPlaceholder')}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              value={composer.tags}
              onChange={(event) => setComposer((current) => ({ ...current, tags: event.target.value }))}
              placeholder={t('community.tagsPlaceholder')}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            />
            <textarea
              required
              rows={4}
              value={composer.content}
              onChange={(event) => setComposer((current) => ({ ...current, content: event.target.value }))}
              placeholder={t('community.contentPlaceholder')}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 md:col-span-2"
            />
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setShowComposer(false); setEditingPostId(null); setComposer(defaultComposer); }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700"
            >
              {t('community.cancel')}
            </button>
            <button type="submit" disabled={saving || savingEdit} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-70">
              {editingPostId ? (savingEdit ? t('community.saving') : t('community.saveChanges')) : (saving ? t('community.posting') : t('community.publishDiscussion'))}
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-12 lg:grid-cols-3">
        <div className="flex flex-col gap-8 lg:col-span-2">
          <div className="flex flex-wrap gap-4">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                type="text"
                placeholder={t('community.searchPlaceholder')}
                className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-medium transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-800 dark:bg-slate-900"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(event) => updateCategoryFilter(event.target.value)}
              className="h-14 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? t('community.allCategories') : category}
                </option>
              ))}
            </select>
          </div>

          {feedError ? (
            <EmptyState
              title={t('community.unableToLoadDiscussions')}
              description={feedError}
              action={
                <button
                  type="button"
                  onClick={refreshFeed}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
                >
                  {t('community.retry')}
                </button>
              }
            />
          ) : posts.length === 0 ? (
            <EmptyState
              title={t('community.noDiscussionsFound')}
              description={emptyFeedDescription}
              action={
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      setActionMessage(t('community.loginToDiscuss'));
                      showToast({ type: 'info', message: t('community.loginToDiscuss') });
                      return;
                    }
                    setActionMessage(null);
                    setShowComposer(true);
                  }}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
                >
                  {t('community.startADiscussion')}
                </button>
              }
            />
          ) : (
            <div className="flex flex-col gap-6">
              {visiblePosts.map((post) => {
                const liked = Boolean(user?.id && post.likedBy.includes(user.id));
                const saved = Boolean(user?.id && post.savedBy.includes(user.id));
                const liking = activeLikePostId === post.id;
                const savingPost = activeSavePostId === post.id;
                const isAuthor = Boolean(user?.id && post.authorId === user.id);
                const isConfirmingDelete = confirmDeletePostId === post.id;
                const isDeleting = deletingPostId === post.id;

                return (
                  <article
                    key={post.id}
                    className="flex flex-col gap-6 rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="size-12 overflow-hidden rounded-2xl bg-slate-100">
                          <img src={post.authorAvatar} alt={post.authorName} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-lg font-bold">{post.authorName}</span>
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{formatRelativeDate(post.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Author-only edit/delete */}
                        {isAuthor ? (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditingPost(post)}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 transition-colors hover:border-primary hover:text-primary dark:border-slate-700"
                            >
                              <Edit3 size={12} /> {t('community.edit')}
                            </button>
                            {isConfirmingDelete ? (
                              <span className="inline-flex items-center gap-2 rounded-xl border border-rose-300/40 bg-rose-500/10 px-2.5 py-1.5">
                                <AlertCircle size={12} className="text-rose-400" />
                                <span className="text-[11px] font-medium text-rose-400">{t('community.deleteConfirm')}</span>
                                <button type="button" disabled={isDeleting} onClick={() => void handleDeletePost(post.id)} className="text-[11px] font-bold text-rose-500 hover:underline disabled:opacity-60">
                                  {isDeleting ? t('community.deleting') : t('community.yes')}
                                </button>
                                <button type="button" onClick={() => setConfirmDeletePostId(null)} className="text-[11px] font-bold text-slate-400 hover:underline">
                                  {t('community.no')}
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePostId(post.id)}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 transition-colors hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700"
                              >
                                <Trash2 size={12} /> {t('community.delete')}
                              </button>
                            )}
                          </>
                        ) : null}

                        {/* Report (non-author only) */}
                        {!isAuthor && isAuthenticated ? (
                          <button
                            type="button"
                            onClick={() => openReportModal('post', post.id)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-amber-500 transition-colors hover:border-amber-300 hover:bg-amber-50 dark:border-slate-700"
                          >
                            <Flag size={12} /> {t('community.report')}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => {
                            void handleSave(post.id);
                          }}
                          disabled={savingPost}
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                            saved
                              ? 'border-primary/40 bg-primary/10 text-primary'
                              : 'border-slate-200 text-slate-500 hover:text-primary dark:border-slate-700'
                          } disabled:cursor-not-allowed disabled:opacity-70`}
                        >
                          {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                          {savingPost ? t('community.saving') : saved ? t('community.saved') : t('community.save')}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <button
                        type="button"
                        onClick={() => navigate(`/community/${post.id}`)}
                        className="w-fit text-left text-xl font-black leading-snug transition-colors hover:text-primary"
                      >
                        {post.title}
                      </button>
                      <p className="font-medium leading-relaxed text-slate-600 dark:text-slate-400">{post.content}</p>
                      {post.image ? (
                        <div className="aspect-video overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800">
                          <img src={post.image} alt={post.title} className="h-full w-full object-cover" />
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {post.tags.map((tag) => (
                          <span
                            key={`${post.id}-${tag}`}
                            className="rounded-lg bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-6 border-t border-slate-100 pt-6 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          void handleLike(post.id);
                        }}
                        disabled={liking}
                        className={`flex items-center gap-2 text-sm font-bold transition-colors ${
                          liked ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500'
                        } disabled:cursor-not-allowed disabled:opacity-70`}
                      >
                        <Heart size={20} className={liked ? 'fill-rose-500' : ''} /> {post.likes}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/community/${post.id}`)}
                        className="flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-primary"
                      >
                        <MessageSquare size={20} /> {post.commentsCount}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(`${window.location.origin}/community/${post.id}`);
                          showToast({ type: 'success', message: t('community.linkCopied') });
                        }}
                        className="ml-auto flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-primary"
                      >
                        <Share2 size={20} /> {t('community.share')}
                      </button>
                    </div>
                  </article>
                );
              })}
              <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Showing {visiblePostCount} of {posts.length} discussions
                </p>
                {hasMorePosts ? (
                  <button
                    type="button"
                    onClick={loadMorePosts}
                    className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover"
                  >
                    {t('community.loadMore')}
                  </button>
                ) : (
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('community.caughtUp')}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-8 lg:col-span-1">
          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-6 flex items-center gap-2 text-xl font-black">
              <TrendingUp size={24} className="text-primary" /> {t('community.trendingTopics')}
            </h3>
            {topics.length === 0 ? (
              <p className="text-sm text-slate-500">{t('community.noTrending')}</p>
            ) : (
              <div className="flex flex-col gap-4">
                {topics.map((topic) => (
                  <button
                    key={topic.tag}
                    type="button"
                    onClick={() => {
                      setQueryInput(topic.tag);
                      setSearchParams((current) => {
                        const next = new URLSearchParams(current);
                        const normalizedTag = topic.tag.trim();

                        if (normalizedTag) {
                          next.set('query', normalizedTag);
                        } else {
                          next.delete('query');
                        }

                        return current.toString() === next.toString() ? current : next;
                      });
                    }}
                    className="group flex items-center justify-between"
                  >
                    <span className="text-sm font-bold text-slate-600 transition-colors group-hover:text-primary dark:text-slate-300">
                      #{topic.tag}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{topic.count} posts</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-6 flex items-center gap-2 text-xl font-black">
              <Users size={24} className="text-primary" /> {t('community.topContributors')}
            </h3>
            {contributors.length === 0 ? (
              <p className="text-sm text-slate-500">{t('community.noContributors')}</p>
            ) : (
              <div className="flex flex-col gap-6">
                {contributors.map((person) => {
                  const isSelf = user?.id === person.userId;
                  const isFollowing = followingIds.includes(person.userId);
                  const isUpdating = followingContributorId === person.userId;

                  return (
                    <div key={person.userId} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 overflow-hidden rounded-xl bg-slate-100">
                          <img src={resolveAvatar(person.avatar, person.userId)} alt={person.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold">{person.name}</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{person.posts} posts</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void handleToggleContributorFollow(person);
                        }}
                        disabled={isSelf || isUpdating}
                        className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                          isSelf
                            ? 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                            : isFollowing
                              ? 'bg-primary/10 text-primary hover:bg-primary/20'
                              : 'text-primary hover:bg-primary/10'
                        }`}
                      >
                        {isSelf ? t('community.you') : isUpdating ? t('community.updating') : isFollowing ? t('community.following') : t('community.follow')}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={refreshFeed}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition-opacity disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? t('community.refreshing') : t('community.refreshFeed')}
          </button>
        </aside>
      </div>
    </div>
  );
};
