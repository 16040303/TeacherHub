import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  Edit3,
  Flag,
  Heart,
  MessageSquare,
  Send,
  Share2,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { communityService } from '../../services/communityService';
import { profileService } from '../../services/profileService';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import { CommunityComment, CommunityPost } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { LoginRequiredPrompt } from '../../components/common/LoginRequiredPrompt';
import { formatRelativeDate } from '../../utils/format';

interface CommentNode extends CommunityComment {
  authorName: string;
  authorAvatar: string;
  replies: CommentNode[];
}

const REPORT_CATEGORIES = ['Spam', 'Harassment', 'Misinformation', 'Inappropriate', 'Other'] as const;

const resolveAvatar = (avatar: string | undefined, seed: string): string => {
  const normalized = avatar?.trim();
  return normalized && normalized.length > 0 ? normalized : `https://picsum.photos/seed/${seed}/120/120`;
};

const buildCommentTree = (comments: CommentNode[]): CommentNode[] => {
  const commentMap = new Map<string, CommentNode>();

  comments.forEach((comment) => {
    commentMap.set(comment.id, {
      ...comment,
      replies: [],
    });
  });

  const roots: CommentNode[] = [];

  commentMap.forEach((comment) => {
    if (!comment.parentId) {
      roots.push(comment);
      return;
    }

    const parent = commentMap.get(comment.parentId);
    if (!parent) {
      roots.push(comment);
      return;
    }

    parent.replies.push(comment);
  });

  const sortNodes = (nodes: CommentNode[]): CommentNode[] =>
    nodes
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((node) => ({
        ...node,
        replies: sortNodes(node.replies),
      }));

  return sortNodes(roots);
};

export const CommunityPostDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [authorName, setAuthorName] = useState('TeacherHub Contributor');
  const [authorAvatar, setAuthorAvatar] = useState('');
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const [savingComment, setSavingComment] = useState(false);
  const [savingReply, setSavingReply] = useState(false);
  const [activeLike, setActiveLike] = useState(false);
  const [activeSave, setActiveSave] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  /* ── Edit post state ── */
  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  /* ── Delete post state ── */
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);

  /* ── Delete comment state ── */
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  /* ── Report modal state ── */
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportCategory, setReportCategory] = useState<string>(REPORT_CATEGORIES[0]);
  const [submittingReport, setSubmittingReport] = useState(false);

  const isPostAuthor = Boolean(user?.id && post?.authorId && user.id === post.authorId);

  const hydrateComments = async (postId: string): Promise<void> => {
    const [rawComments, users] = await Promise.all([
      communityService.listCommunityComments(postId),
      profileService.listPublicUsers(),
    ]);

    const userMap = new Map(users.map((entry) => [entry.id, entry]));
    const hydratedComments: CommentNode[] = rawComments.map((comment) => {
      const author = userMap.get(comment.authorId);
      return {
        ...comment,
        authorName: author?.name ?? 'Unknown teacher',
        authorAvatar: resolveAvatar(author?.avatar, comment.authorId),
        replies: [],
      };
    });

    setComments(buildCommentTree(hydratedComments));
  };

  const loadData = useCallback(async (): Promise<void> => {
    if (!id) {
      setLoading(false);
      setPost(null);
      return;
    }

    setLoading(true);
    try {
      const fetchedPost = await communityService.getCommunityPostById(id);
      if (!fetchedPost) {
        setPost(null);
        return;
      }

      const profile = await profileService.getPublicUserById(fetchedPost.authorId);
      setPost(fetchedPost);
      setAuthorName(profile?.name ?? 'TeacherHub Contributor');
      setAuthorAvatar(resolveAvatar(profile?.avatar, fetchedPost.authorId));

      await hydrateComments(fetchedPost.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load post details.';
      showToast({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalCommentCount = useMemo(() => {
    const flatten = (nodes: CommentNode[]): number =>
      nodes.reduce((count, node) => count + 1 + flatten(node.replies), 0);

    return flatten(comments);
  }, [comments]);

  const requireAuth = (message: string): boolean => {
    if (isAuthenticated && user) {
      setActionMessage(null);
      return true;
    }

    setActionMessage(message);
    showToast({ type: 'info', message });
    return false;
  };

  const applyUpdatedPost = (updated: CommunityPost): void => {
    setPost((current) => {
      if (!current || current.id !== updated.id) {
        return current;
      }
      return {
        ...current,
        ...updated,
      };
    });
  };

  /* ── Like ── */
  const handleLike = async (): Promise<void> => {
    if (!post || activeLike) {
      return;
    }

    if (!requireAuth('Please login to like posts.')) {
      return;
    }

    if (!user) {
      return;
    }

    const previous = post;
    const hasLiked = post.likedBy.includes(user.id);
    const nextLikedBy = hasLiked ? post.likedBy.filter((entry) => entry !== user.id) : [...post.likedBy, user.id];

    setPost({
      ...post,
      likedBy: nextLikedBy,
      likes: nextLikedBy.length,
    });
    setActiveLike(true);

    try {
      const updated = await communityService.toggleCommunityPostLike(post.id, user.id);
      applyUpdatedPost(updated);
    } catch (error) {
      setPost(previous);
      const message = error instanceof Error ? error.message : 'Unable to update like.';
      showToast({ type: 'error', message });
    } finally {
      setActiveLike(false);
    }
  };

  /* ── Save ── */
  const handleSave = async (): Promise<void> => {
    if (!post || activeSave) {
      return;
    }

    if (!requireAuth('Please login to save discussions.')) {
      return;
    }

    if (!user) {
      return;
    }

    const previous = post;
    const hasSaved = post.savedBy.includes(user.id);
    const nextSavedBy = hasSaved ? post.savedBy.filter((entry) => entry !== user.id) : [...post.savedBy, user.id];

    setPost({
      ...post,
      savedBy: nextSavedBy,
    });
    setActiveSave(true);

    try {
      const updated = await communityService.toggleCommunityPostSave(post.id, user.id);
      applyUpdatedPost(updated);
    } catch (error) {
      setPost(previous);
      const message = error instanceof Error ? error.message : 'Unable to update saved state.';
      showToast({ type: 'error', message });
    } finally {
      setActiveSave(false);
    }
  };

  /* ── Edit post ── */
  const startEditingPost = (): void => {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditCategory(post.category);
    setEditTags(post.tags.join(', '));
    setEditingPost(true);
  };

  const cancelEditingPost = (): void => {
    setEditingPost(false);
    setEditTitle('');
    setEditContent('');
    setEditCategory('');
    setEditTags('');
  };

  const handleUpdatePost = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!post || !user || savingEdit) return;

    setSavingEdit(true);
    try {
      const updated = await communityService.updateCommunityPost(post.id, user.id, {
        title: editTitle,
        content: editContent,
        category: editCategory,
        tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      applyUpdatedPost(updated);
      cancelEditingPost();
      showToast({ type: 'success', message: 'Post updated successfully.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update post.';
      showToast({ type: 'error', message });
    } finally {
      setSavingEdit(false);
    }
  };

  /* ── Delete post ── */
  const handleDeletePost = async (): Promise<void> => {
    if (!post || !user || deletingPost) return;

    setDeletingPost(true);
    try {
      await communityService.deleteCommunityPost(post.id, user.id);
      showToast({ type: 'success', message: 'Post deleted successfully.' });
      navigate('/community');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete post.';
      showToast({ type: 'error', message });
      setConfirmDeletePost(false);
    } finally {
      setDeletingPost(false);
    }
  };

  /* ── Delete comment ── */
  const handleDeleteComment = async (commentId: string): Promise<void> => {
    if (!user || deletingCommentId) return;

    setDeletingCommentId(commentId);
    try {
      await communityService.deleteCommunityComment(commentId, user.id);
      if (post) {
        await hydrateComments(post.id);
      }
      showToast({ type: 'success', message: 'Comment deleted.' });
      setConfirmDeleteCommentId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete comment.';
      showToast({ type: 'error', message });
    } finally {
      setDeletingCommentId(null);
    }
  };

  /* ── Report ── */
  const openReportModal = (type: 'post' | 'comment', targetId: string): void => {
    if (!requireAuth('Please login to report content.')) return;
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
      showToast({ type: 'success', message: 'Report submitted. Our team will review it shortly.' });
      closeReportModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit report.';
      showToast({ type: 'error', message });
    } finally {
      setSubmittingReport(false);
    }
  };

  /* ── Create comment ── */
  const createComment = async (payload: { content: string; parentId?: string }): Promise<void> => {
    if (!post) {
      return;
    }

    if (!requireAuth('Please login to comment in this discussion.')) {
      return;
    }

    if (!user) {
      return;
    }

    const trimmed = payload.content.trim();
    if (!trimmed) {
      showToast({ type: 'info', message: 'Comment cannot be empty.' });
      return;
    }

    const isReply = Boolean(payload.parentId);
    if (isReply) {
      setSavingReply(true);
    } else {
      setSavingComment(true);
    }

    try {
      await communityService.createCommunityComment(user.id, {
        postId: post.id,
        content: trimmed,
        parentId: payload.parentId,
      });

      if (payload.parentId) {
        setReplyDrafts((current) => ({ ...current, [payload.parentId as string]: '' }));
        setOpenReplyId(null);
      } else {
        setCommentDraft('');
      }

      await hydrateComments(post.id);
      showToast({ type: 'success', message: isReply ? 'Reply posted.' : 'Comment posted.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to post comment.';
      showToast({ type: 'error', message });
    } finally {
      setSavingComment(false);
      setSavingReply(false);
    }
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await createComment({ content: commentDraft });
  };

  if (loading) {
    return <LoadingState title="Loading discussion" description="Fetching post and conversation details..." />;
  }

  if (!post) {
    return (
      <EmptyState
        title="Discussion not found"
        description="This discussion may have been deleted or moved."
        action={
          <button type="button" onClick={() => navigate('/community')} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white">
            Back to community
          </button>
        }
      />
    );
  }

  const hasLiked = Boolean(user?.id && post.likedBy.includes(user.id));
  const hasSaved = Boolean(user?.id && post.savedBy.includes(user.id));

  const renderComment = (comment: CommentNode, depth = 0): React.ReactNode => {
    const replyDraft = replyDrafts[comment.id] ?? '';
    const isReplyOpen = openReplyId === comment.id;
    const isCommentAuthor = Boolean(user?.id && comment.authorId === user.id);
    const isOP = post.authorId === comment.authorId;
    const isConfirmingDelete = confirmDeleteCommentId === comment.id;
    const isDeleting = deletingCommentId === comment.id;

    return (
      <li key={comment.id} className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex items-center gap-3">
            <div className="size-10 overflow-hidden rounded-xl bg-slate-100">
              <img src={comment.authorAvatar} alt={comment.authorName} className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="flex items-center gap-2 text-sm font-bold">
                {comment.authorName}
                {isOP ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary">
                    <Shield size={10} /> Author
                  </span>
                ) : null}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{formatRelativeDate(comment.createdAt)}</span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{comment.content}</p>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!requireAuth('Please login to reply in this discussion.')) {
                  return;
                }
                setOpenReplyId((current) => (current === comment.id ? null : comment.id));
              }}
              className="text-xs font-black uppercase tracking-widest text-primary hover:underline"
            >
              Reply
            </button>

            {/* Delete own comment */}
            {isCommentAuthor ? (
              isConfirmingDelete ? (
                <span className="inline-flex items-center gap-2">
                  <span className="text-xs font-medium text-rose-400">Delete?</span>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => void handleDeleteComment(comment.id)}
                    className="text-xs font-bold text-rose-500 hover:underline disabled:opacity-60"
                  >
                    {isDeleting ? 'Deleting...' : 'Yes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCommentId(null)}
                    className="text-xs font-bold text-slate-400 hover:underline"
                  >
                    No
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteCommentId(comment.id)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 transition-colors hover:text-rose-500"
                >
                  <Trash2 size={12} /> Delete
                </button>
              )
            ) : null}

            {/* Report comment (non-author only) */}
            {!isCommentAuthor && isAuthenticated ? (
              <button
                type="button"
                onClick={() => openReportModal('comment', comment.id)}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 transition-colors hover:text-amber-500"
              >
                <Flag size={12} /> Report
              </button>
            ) : null}
          </div>

          {isReplyOpen ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void createComment({ content: replyDraft, parentId: comment.id });
              }}
              className="mt-3 space-y-2"
            >
              <textarea
                rows={3}
                value={replyDraft}
                onChange={(event) => setReplyDrafts((current) => ({ ...current, [comment.id]: event.target.value }))}
                placeholder="Write a reply..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenReplyId(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReply}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-70"
                >
                  {savingReply ? 'Posting...' : 'Reply'}
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {comment.replies.length > 0 ? (
          <ul className="space-y-3 pl-4" style={{ marginLeft: `${Math.min(depth + 1, 3) * 0.5}rem` }}>
            {comment.replies.map((reply) => renderComment(reply, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      <button
        type="button"
        onClick={() => navigate('/community')}
        className="flex w-fit items-center gap-2 font-bold text-slate-500 transition-colors hover:text-primary"
      >
        <ChevronLeft size={18} /> Back to community
      </button>

      {actionMessage ? (
        <LoginRequiredPrompt
          message={actionMessage}
          redirectPath={`/community/${post.id}`}
          onDismiss={() => setActionMessage(null)}
        />
      ) : null}

      {/* ── Report Modal ── */}
      {reportTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-black">
                <Flag size={18} className="text-amber-500" /> Report {reportTarget.type === 'post' ? 'Post' : 'Comment'}
              </h3>
              <button type="button" onClick={closeReportModal} className="text-slate-400 transition hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                Category
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
                Reason
                <textarea
                  required
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Describe why you are reporting this content..."
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium normal-case outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeReportModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport || !reportReason.trim()}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── Post article ── */}
      <article className="rounded-4xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="size-12 overflow-hidden rounded-2xl bg-slate-100">
              <img src={authorAvatar} alt={authorName} className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-lg font-black">{authorName}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{formatRelativeDate(post.createdAt)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Author-only edit/delete */}
            {isPostAuthor ? (
              <>
                <button
                  type="button"
                  onClick={startEditingPost}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:border-primary hover:text-primary dark:border-slate-700"
                >
                  <Edit3 size={14} /> Edit
                </button>
                {confirmDeletePost ? (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2">
                    <AlertCircle size={14} className="text-rose-400" />
                    <span className="text-xs font-medium text-rose-400">Delete?</span>
                    <button
                      type="button"
                      disabled={deletingPost}
                      onClick={() => void handleDeletePost()}
                      className="text-xs font-bold text-rose-500 hover:underline disabled:opacity-60"
                    >
                      {deletingPost ? 'Deleting...' : 'Yes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeletePost(false)}
                      className="text-xs font-bold text-slate-400 hover:underline"
                    >
                      No
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeletePost(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-rose-500 transition-colors hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:hover:border-rose-400"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </>
            ) : null}

            {/* Report post (non-author only) */}
            {!isPostAuthor && isAuthenticated ? (
              <button
                type="button"
                onClick={() => openReportModal('post', post.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-amber-500 transition-colors hover:border-amber-300 hover:bg-amber-50 dark:border-slate-700"
              >
                <Flag size={14} /> Report
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                void handleSave();
              }}
              disabled={activeSave}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                hasSaved
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-slate-200 text-slate-500 hover:text-primary dark:border-slate-700'
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {hasSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              {activeSave ? 'Saving...' : hasSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>

        {/* Edit form or post content */}
        {editingPost ? (
          <form onSubmit={handleUpdatePost} className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/2 p-5">
            <h3 className="text-sm font-black uppercase tracking-wider text-primary">Editing Post</h3>
            <input
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Discussion title"
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                required
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="Category"
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="Tags separated by commas"
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <textarea
              required
              rows={5}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Content..."
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelEditingPost}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-70"
              >
                {savingEdit ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <h1 className="text-3xl font-black leading-tight tracking-tight">{post.title}</h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">{post.content}</p>

            {post.image ? (
              <div className="mt-6 aspect-video overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800">
                <img src={post.image} alt={post.title} className="h-full w-full object-cover" />
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <button
                  key={`${post.id}-${tag}`}
                  type="button"
                  onClick={() => navigate(`/community?query=${encodeURIComponent(tag)}`)}
                  className="rounded-lg bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:bg-primary/10 hover:text-primary dark:bg-slate-800"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-6 flex items-center gap-6 border-t border-slate-100 pt-6 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              void handleLike();
            }}
            disabled={activeLike}
            className={`inline-flex items-center gap-2 text-sm font-bold transition-colors ${
              hasLiked ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500'
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            <Heart size={20} className={hasLiked ? 'fill-rose-500' : ''} /> {post.likes}
          </button>

          <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
            <MessageSquare size={20} /> {totalCommentCount}
          </div>

          <Link
            to="/community"
            className="ml-auto text-xs font-black uppercase tracking-widest text-primary transition-colors hover:text-primary-hover"
          >
            See more discussions
          </Link>

          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(`${window.location.origin}/community/${post.id}`);
              showToast({ type: 'success', message: 'Post link copied to clipboard.' });
            }}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-primary"
          >
            <Share2 size={20} /> Share
          </button>
        </div>
      </article>

      <section className="rounded-4xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black">Comments ({totalCommentCount})</h2>

        {isAuthenticated ? (
          <form onSubmit={submitComment} className="mt-4 space-y-3">
            <textarea
              rows={4}
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Share your thoughts..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingComment}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-black text-white disabled:opacity-70"
              >
                <Send size={16} /> {savingComment ? 'Posting...' : 'Post comment'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setActionMessage('Please login to comment in this discussion.');
                showToast({ type: 'info', message: 'Please login to comment in this discussion.' });
              }}
              className="font-bold text-primary transition hover:underline"
            >
              Log in
            </button>{' '}
            to join this conversation.
          </div>
        )}

        {comments.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No comments yet. Be the first to join this conversation.</p>
        ) : (
          <ul className="mt-6 space-y-4">{comments.map((comment) => renderComment(comment))}</ul>
        )}
      </section>
    </div>
  );
};
