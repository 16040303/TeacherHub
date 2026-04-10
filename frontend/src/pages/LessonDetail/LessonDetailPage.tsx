import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Star,
  Download,
  Share2,
  Heart,
  MessageCircle,
  ChevronLeft,
  FileText,
  Clock,
  Calendar,
  ShieldCheck,
  RefreshCw,
  UserCheck,
  UserPlus,
  Sparkles,
  BadgeCheck,
  ShoppingCart,
  Lock,
  Edit3,
  Trash2,
  Flag,
  AlertCircle,
  X,
} from 'lucide-react';
import { lessonsService } from '../../services/lessonsService';
import { profileService } from '../../services/profileService';
import { ordersService } from '../../services/ordersService';
import { followsService } from '../../services/followsService';
import { lessonFavoritesService } from '../../services/lessonFavoritesService';
import { useAuth } from '../../app/providers/AuthProvider';
import { useToast } from '../../app/providers/ToastProvider';
import {
  Lesson,
  LessonDetailSnapshot,
  LessonReviewView,
  TeacherPublicProfile,
} from '../../types';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { LessonCard } from '../../features/lessons/components/LessonCard';
import { LoginRequiredPrompt } from '../../components/common/LoginRequiredPrompt';
import { formatRelativeDate, formatCoins, toDateLabel } from '../../utils/format';
import { isAppError } from '../../utils/api-error';
import { useLanguage } from '../../app/providers/LanguageProvider';

const starSet = [1, 2, 3, 4, 5];
const relatedSkeletonItems = Array.from({ length: 3 }, (_, index) => index);
const REPORT_CATEGORIES = ['Spam', 'Harassment', 'Misinformation', 'Inappropriate', 'Other'] as const;

const toFallbackAvatar = (seed: string): string =>
  `https://picsum.photos/seed/${encodeURIComponent(seed || 'teacherhub-author')}/120/120`;

const toReviewReasonLabel = (reason: LessonDetailSnapshot['reviewPermission']['reason'], t: (key: string) => string): string => {
  switch (reason) {
    case 'login_required':
      return t('lesson.reviewPermissionLoginRequired');
    case 'purchase_required':
      return t('lesson.reviewPermissionPurchaseRequired');
    case 'verified_buyer':
      return t('lesson.reviewPermissionVerifiedBuyer');
    case 'free_lesson':
      return t('lesson.reviewPermissionFreeLesson');
    case 'owner':
      return t('lesson.reviewPermissionOwner');
    default:
      return t('lesson.reviewPermissionEligibilityRequired');
  }
};

export const LessonDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const reviewsSectionRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<LessonDetailSnapshot | null>(null);
  const [authorProfile, setAuthorProfile] = useState<TeacherPublicProfile | null>(null);
  const [authorName, setAuthorName] = useState(t('lesson.authorNameDefault'));
  const [relatedLessons, setRelatedLessons] = useState<Lesson[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [isUsingPreviewFallback, setIsUsingPreviewFallback] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [loginPromptMessage, setLoginPromptMessage] = useState<string | null>(null);

  /* ── Edit review state ── */
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editReviewRating, setEditReviewRating] = useState(5);
  const [editReviewComment, setEditReviewComment] = useState('');
  const [savingEditReview, setSavingEditReview] = useState(false);

  /* ── Delete review state ── */
  const [confirmDeleteReviewId, setConfirmDeleteReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  /* ── Report modal state ── */
  const [reportTarget, setReportTarget] = useState<{ type: 'lesson' | 'review'; id: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportCategory, setReportCategory] = useState<string>(REPORT_CATEGORIES[0]);
  const [submittingReport, setSubmittingReport] = useState(false);

  const lesson = detail?.lesson ?? null;

  const loadRelatedLessons = async (lessonId: string): Promise<void> => {
    setRelatedLoading(true);
    setRelatedError(null);

    try {
      const related = await lessonsService.getRelatedLessons(lessonId, 4, user?.id);
      const safeRelated = Array.isArray(related)
        ? related.filter((item) => item.id !== lessonId)
        : [];
      setRelatedLessons(safeRelated);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('lesson.unableToLoadRelated');
      setRelatedError(message);
      setRelatedLessons([]);
    } finally {
      setRelatedLoading(false);
    }
  };

  const loadData = async (): Promise<void> => {
    if (!id) {
      setDetail(null);
      setAuthorProfile(null);
      setRelatedLessons([]);
      setRelatedError(null);
      setRelatedLoading(false);
      setIsFavorited(false);
      setIsFollowingAuthor(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const snapshot = await lessonsService.getLessonDetailSnapshot(id, user?.id);
      if (!snapshot || snapshot.lesson.status !== 'published') {
        setDetail(null);
        setAuthorProfile(null);
        setRelatedLessons([]);
        setRelatedError(null);
        setRelatedLoading(false);
        setIsFavorited(false);
        setIsFollowingAuthor(false);
        return;
      }

      const [teacherProfile, favorited, followsAuthor] = await Promise.all([
        profileService.getTeacherPublicProfile(snapshot.lesson.authorId),
        isAuthenticated && user
          ? lessonFavoritesService.isLessonFavorited(user.id, snapshot.lesson.id)
          : Promise.resolve(false),
        isAuthenticated && user && user.id !== snapshot.lesson.authorId
          ? followsService.isFollowingUser(user.id, snapshot.lesson.authorId)
          : Promise.resolve(false),
      ]);

      setDetail(snapshot);
      setAuthorProfile(teacherProfile);
      setAuthorName(teacherProfile?.name?.trim() || 'TeacherHub Contributor');
      setIsFavorited(favorited);
      setIsFollowingAuthor(followsAuthor);
      setLoginPromptMessage(null);

      await loadRelatedLessons(snapshot.lesson.id);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isAppError(error)
            ? error.message
            : t('lesson.unableToLoadRelated');
      showToast({ type: 'error', message });
      setDetail(null);
      setAuthorProfile(null);
      setRelatedLessons([]);
      setRelatedError(null);
      setRelatedLoading(false);
      setIsFavorited(false);
      setIsFollowingAuthor(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [id, isAuthenticated, user?.id]);

  useEffect(() => {
    setIsUsingPreviewFallback(false);
  }, [lesson?.id, lesson?.thumbnail, lesson?.previewMediaUrl]);

  useEffect(() => {
    if (detail?.reviewPermission.canSubmit) {
      setReviewComment('');
      setReviewRating(5);
    }
  }, [detail?.reviewPermission.canSubmit, lesson?.id]);

  const metadata = useMemo(
    () =>
      lesson
        ? [
            {
              label: t('lesson.duration'),
              icon: <Clock size={16} className="text-primary" />,
              value: lesson.duration || `${Math.max(lesson.estimatedMinutes ?? 0, 45)} mins`,
            },
            {
              label: t('lesson.format'),
              icon: <FileText size={16} className="text-primary" />,
              value: lesson.format,
            },
            {
              label: t('lesson.fileSize'),
              icon: <Download size={16} className="text-primary" />,
              value: lesson.fileSize || t('lesson.unknownFileSize'),
            },
            {
              label: t('lesson.lastUpdated'),
              icon: <Calendar size={16} className="text-primary" />,
              value: toDateLabel(lesson.updatedAt),
            },
            {
              label: t('lesson.quality'),
              icon: <ShieldCheck size={16} className="text-emerald-500" />,
              value: t('lesson.qualityVerified'),
            },
          ]
        : [],
    [lesson, t],
  );

  const ensureAuthenticated = (message: string): boolean => {
    if (isAuthenticated && user) {
      setLoginPromptMessage(null);
      return true;
    }

    setLoginPromptMessage(message);
    showToast({ type: 'info', message });
    return false;
  };

  const refreshSnapshot = async (): Promise<void> => {
    if (!id) {
      return;
    }

    try {
      const snapshot = await lessonsService.getLessonDetailSnapshot(id, user?.id);
      if (snapshot) {
        setDetail(snapshot);
      }
    } catch {
      // Ignore silent refresh errors to avoid noisy UX
    }
  };

  const handleAcquireLesson = async (): Promise<void> => {
    if (!lesson || !detail) {
      return;
    }

    if (!isAuthenticated || !user) {
      const message = detail.isFreeLesson
        ? t('lesson.loginToUnlock')
        : t('lesson.loginToPurchase');
      setLoginPromptMessage(message);
      showToast({ type: 'info', message });
      return;
    }

    if (!detail.canPurchase) {
      if (detail.canDownload) {
        showToast({ type: 'success', message: t('toast.alreadyHaveAccess') });
      } else {
        showToast({ type: 'info', message: t('toast.lessonUnavailable') });
      }
      return;
    }

    setIsProcessing(true);
    try {
      const pendingOrder = await ordersService.createPendingOrder(user.id, lesson.id);
      if (pendingOrder.status === 'paid') {
        showToast({
          type: 'success',
          message: t('toast.freeLessonUnlocked'),
        });
        navigate(`/orders/${pendingOrder.id}/payment-result`);
        await loadData();
        return;
      }

      await ordersService.processOrderPayment(pendingOrder.id, 'success');
      navigate(`/orders/${pendingOrder.id}/payment-result`);
      await loadData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to complete checkout';
      showToast({ type: 'error', message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadLesson = async (): Promise<void> => {
    if (!lesson || !detail) {
      return;
    }

    if (!detail.canDownload) {
      showToast({ type: 'info', message: t('toast.downloadProtection') });
      return;
    }

    if (!ensureAuthenticated(t('lesson.loginToDownload'))) {
      return;
    }

    try {
      await lessonsService.incrementLessonDownload(lesson.id);
      await refreshSnapshot();
      showToast({ type: 'success', message: t('toast.downloadStarted') });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('lesson.unableToDownload');
      showToast({ type: 'error', message });
    }
  };

  const handleToggleFavorite = async (): Promise<void> => {
    if (!lesson || isTogglingFavorite) {
      return;
    }

    if (!ensureAuthenticated(t('toast.loginToFavorite'))) {
      return;
    }

    if (!user) {
      return;
    }

    const previous = isFavorited;
    setIsFavorited(!previous);
    setIsTogglingFavorite(true);

    try {
      const next = await lessonFavoritesService.toggleLessonFavorite(user.id, lesson.id);
      setIsFavorited(next);
      showToast({
        type: next ? 'success' : 'info',
        message: next ? t('toast.favoritedLesson') : t('toast.unfavoritedLesson'),
      });
    } catch (error) {
      setIsFavorited(previous);
      const message =
        error instanceof Error ? error.message : t('lesson.unableToUpdateFavorites');
      showToast({ type: 'error', message });
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleToggleAuthorFollow = async (): Promise<void> => {
    if (!lesson || isTogglingFollow) {
      return;
    }

    if (!ensureAuthenticated(t('toast.loginToFollow'))) {
      return;
    }

    if (!user || user.id === lesson.authorId) {
      return;
    }

    const previous = isFollowingAuthor;
    const next = !previous;

    setIsFollowingAuthor(next);
    setAuthorProfile((current) =>
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
        await followsService.followUser(user.id, lesson.authorId);
        showToast({ type: 'success', message: t('toast.followingUser', { name: authorName }) });
      } else {
        await followsService.unfollowUser(user.id, lesson.authorId);
        showToast({ type: 'info', message: t('toast.unfollowedUser', { name: authorName }) });
      }
    } catch (error) {
      setIsFollowingAuthor(previous);
      setAuthorProfile((current) =>
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
        error instanceof Error
          ? error.message
          : t('lesson.unableToUpdateFollow');
      showToast({ type: 'error', message });
    } finally {
      setIsTogglingFollow(false);
    }
  };

  const handleShareLesson = async (): Promise<void> => {
    if (!lesson) {
      return;
    }

    const shareUrl = `${window.location.origin}/lesson/${lesson.id}`;

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard is not available in this browser context.');
      }
      await navigator.clipboard.writeText(shareUrl);
      showToast({ type: 'success', message: t('lesson.lessonCopied') });
    } catch {
      showToast({ type: 'error', message: t('lesson.unableToCopyLink') });
    }
  };

  const handleJumpToReviews = (): void => {
    reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmitReview = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!lesson || !detail || isSubmittingReview) {
      return;
    }

    if (!ensureAuthenticated(t('toast.loginToReview'))) {
      return;
    }

    if (!detail.reviewPermission.canSubmit) {
      showToast({ type: 'info', message: detail.reviewPermission.message });
      return;
    }

    const trimmedComment = reviewComment.trim();
    if (!trimmedComment) {
      showToast({ type: 'info', message: t('lesson.addWrittenFeedback') });
      return;
    }

    setIsSubmittingReview(true);

    try {
      await lessonsService.createLessonReview(user!.id, {
        lessonId: lesson.id,
        rating: reviewRating,
        comment: trimmedComment,
      });

      showToast({ type: 'success', message: t('toast.reviewSubmitted') });
      setReviewComment('');
      await refreshSnapshot();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('lesson.unableToSubmitReview');
      showToast({ type: 'error', message });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  /* ── Edit review ── */
  const startEditingReview = (review: LessonReviewView): void => {
    setEditingReviewId(review.id);
    setEditReviewRating(review.rating);
    setEditReviewComment(review.comment);
  };

  const cancelEditingReview = (): void => {
    setEditingReviewId(null);
    setEditReviewRating(5);
    setEditReviewComment('');
  };

  const handleUpdateReview = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!user || !editingReviewId || savingEditReview) return;

    setSavingEditReview(true);
    try {
      await lessonsService.updateLessonReview(editingReviewId, user.id, {
        rating: editReviewRating,
        comment: editReviewComment,
      });
      cancelEditingReview();
      await refreshSnapshot();
      showToast({ type: 'success', message: t('toast.reviewUpdated') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('lesson.unableToUpdateReview');
      showToast({ type: 'error', message });
    } finally {
      setSavingEditReview(false);
    }
  };

  /* ── Delete review ── */
  const handleDeleteReview = async (reviewId: string): Promise<void> => {
    if (!user || deletingReviewId) return;

    setDeletingReviewId(reviewId);
    try {
      await lessonsService.deleteLessonReview(reviewId, user.id);
      setConfirmDeleteReviewId(null);
      await refreshSnapshot();
      showToast({ type: 'success', message: t('toast.reviewDeleted') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('lesson.unableToDeleteReview');
      showToast({ type: 'error', message });
      setConfirmDeleteReviewId(null);
    } finally {
      setDeletingReviewId(null);
    }
  };

  /* ── Report ── */
  const openReportModal = (type: 'lesson' | 'review', targetId: string): void => {
    if (!ensureAuthenticated(t('toast.loginToReport'))) return;
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
      await lessonsService.createLessonReport(user.id, {
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        reason: reportReason,
        category: reportCategory,
      });
      showToast({ type: 'success', message: t('toast.reportSubmitted') });
      closeReportModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('lesson.unableToSubmitReport');
      showToast({ type: 'error', message });
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <LoadingState
        title={t('lesson.loadingLesson')}
        description={t('lesson.loadingLessonDescription')}
      />
    );
  }

  if (!lesson || !detail) {
    return (
      <EmptyState
        title={t('lesson.lessonNotFound')}
        description={t('lesson.lessonNotFoundDescription')}
        action={
          <button
            type="button"
            onClick={() => navigate('/library')}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            {t('lesson.backToLibraryButton')}
          </button>
        }
      />
    );
  }

  const followerCount = Math.max(0, Number(authorProfile?.stats.followers) || 0);
  const authorAvatarSrc = authorProfile?.avatar?.trim() || toFallbackAvatar(lesson.authorId);
  const authorSubject = authorProfile?.subject?.trim() || 'TeacherHub Educator';
  const authorExperience = authorProfile?.experience?.trim() || 'Experienced classroom teacher';

  const safeRating = Number.isFinite(lesson.rating)
    ? Math.max(0, Math.min(5, lesson.rating))
    : 0;
  const safeDownloads = Number.isFinite(lesson.downloads)
    ? Math.max(0, lesson.downloads)
    : 0;
  const safeReviewCount = Number.isFinite(lesson.reviewCount)
    ? Math.max(0, lesson.reviewCount)
    : 0;
  const safeTags = Array.isArray(lesson.tags)
    ? lesson.tags.map((tag) => tag.trim()).filter(Boolean)
    : [];
  const safePrice = Number.isFinite(lesson.price)
    ? Math.max(0, Math.round(lesson.price))
    : 0;

  const previewFallback = `https://picsum.photos/seed/${encodeURIComponent(lesson.id || 'lesson-preview')}/1200/800`;
  const previewSource = lesson.previewMediaUrl?.trim() || lesson.thumbnail?.trim() || previewFallback;

  const ctaLabel = detail.canDownload
    ? t('lesson.downloadResource')
    : detail.canPurchase
      ? detail.isFreeLesson
        ? t('lesson.unlockForFree')
        : t('lesson.buyUnlock')
      : t('lesson.unavailable');

  const ctaIcon = detail.canDownload ? <Download size={22} /> : detail.canPurchase ? <ShoppingCart size={22} /> : <Lock size={22} />;

  const canShowFollowButton = Boolean(user?.id !== lesson.authorId);

  const reviewList: LessonReviewView[] = detail.reviews.slice(0, 8);

  return (
    <div className="flex flex-col gap-10 pb-20">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex w-fit items-center gap-2 font-bold text-slate-500 transition-all hover:text-primary"
      >
        <ChevronLeft size={20} /> {t('lesson.backToLibrary')}
      </button>

      {loginPromptMessage ? (
        <LoginRequiredPrompt
          message={loginPromptMessage}
          redirectPath={`/lesson/${lesson.id}`}
          onDismiss={() => setLoginPromptMessage(null)}
        />
      ) : null}

      {/* ── Report Modal ── */}
      {reportTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-black">
                <Flag size={18} className="text-amber-500" /> {reportTarget.type === 'lesson' ? t('lesson.reportLesson') : t('lesson.reportReview')}
              </h3>
              <button type="button" onClick={closeReportModal} className="text-slate-400 transition hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitReport} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                {t('lesson.reportCategory')}
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
                {t('lesson.reportReason')}
                <textarea
                  required
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder={t('lesson.reportReasonPlaceholder')}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium normal-case outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeReportModal} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold dark:border-slate-700">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={submittingReport || !reportReason.trim()} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                  {submittingReport ? t('lesson.submittingReport') : t('lesson.submitReport')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="grid gap-12 lg:grid-cols-3">
        <div className="flex flex-col gap-10 lg:col-span-2">
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl font-black leading-tight tracking-tight">{lesson.title}</h1>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <Link
                to={`/teacher/${lesson.authorId}`}
                className="group flex items-center gap-3 rounded-2xl border border-transparent px-2 py-1 transition hover:border-primary/20 hover:bg-primary/5"
              >
                <div className="size-10 overflow-hidden rounded-full bg-slate-100">
                  <img src={authorAvatarSrc} alt={authorName} className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold group-hover:text-primary">{authorName}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {authorSubject}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
                    {followerCount} {followerCount === 1 ? t('lesson.follower') : t('lesson.followers')}
                  </span>
                </div>
              </Link>

              {canShowFollowButton ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleToggleAuthorFollow();
                  }}
                  disabled={isTogglingFollow}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-black uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                    isFollowingAuthor
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-slate-200 text-slate-600 hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {isFollowingAuthor ? <UserCheck size={15} /> : <UserPlus size={15} />}
                  {isTogglingFollow ? t('common.updating') : isFollowingAuthor ? t('lesson.following') : t('lesson.follow')}
                </button>
              ) : (
                <span className="rounded-xl bg-primary/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-primary">
                  {t('lesson.yourLesson')}
                </span>
              )}

              <div className="hidden h-8 w-px bg-slate-200 sm:block dark:bg-slate-800" />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {starSet.map((item) => (
                    <Star
                      key={item}
                      size={16}
                      className={
                        item <= Math.floor(safeRating)
                          ? 'fill-yellow-500 text-yellow-500'
                          : 'text-slate-200'
                      }
                    />
                  ))}
                </div>
                <span className="text-sm font-bold text-slate-500">({safeRating.toFixed(1)})</span>
              </div>
            </div>
          </div>

          <div className="group relative aspect-16/10 overflow-hidden rounded-[2.5rem] border-4 border-white bg-slate-200 shadow-2xl dark:border-slate-900 dark:bg-slate-800">
            <img
              src={isUsingPreviewFallback ? previewFallback : previewSource}
              alt="Lesson preview"
              onError={() => {
                setIsUsingPreviewFallback(true);
              }}
              className="absolute inset-0 h-full w-full object-cover opacity-30 blur-sm transition-opacity group-hover:opacity-40"
            />
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4">
              <div className="flex size-20 items-center justify-center rounded-3xl bg-white shadow-xl dark:bg-slate-900">
                <FileText size={40} className="text-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold">{t('lesson.lessonPreview')}</h3>
                <p className="font-medium text-slate-500">
                  {t('lesson.updatedOn', { date: formatRelativeDate(lesson.updatedAt) })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <h2 className="text-2xl font-bold">{t('lesson.lessonOverview')}</h2>
            <p className="leading-relaxed text-slate-600 dark:text-slate-400">
              {lesson.description}
            </p>

            {lesson.pedagogicalGoals ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                <span className="font-black text-primary">{t('lesson.pedagogicalGoal')}</span>{' '}
                {lesson.pedagogicalGoals}
              </div>
            ) : null}

            {lesson.attachmentSummary?.trim() ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                <span className="font-black text-slate-700 dark:text-slate-100">{t('lesson.includes')}</span>{' '}
                {lesson.attachmentSummary}
              </div>
            ) : null}

            {lesson.keyLearnings && lesson.keyLearnings.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {lesson.keyLearnings.map((point) => (
                  <span
                    key={point}
                    className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800"
                  >
                    {point}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-primary">
                {lesson.subject}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {lesson.gradeLevel}
              </span>
              {safeTags.map((tag) => (
                <span
                  key={`${lesson.id}-tag-${tag}`}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-300"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-6 md:grid-cols-5">
              {metadata.map((item) => (
                <div key={item.label} className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    {item.icon}
                    <span>{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            ref={reviewsSectionRef}
            id="lesson-reviews"
            className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h3 className="text-lg font-black">{t('lesson.verifiedReviews')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('lesson.verifiedReviewsDescription')}
                </p>
              </div>
              <div className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-black uppercase tracking-wider text-primary">
                {t('lesson.totalReviews', { count: safeReviewCount })}
              </div>
            </div>

            {reviewList.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t('lesson.noReviewsYet')}
              </p>
            ) : (
              <ul className="space-y-4">
                {reviewList.map((review) => {
                  const isReviewAuthor = Boolean(user?.id && review.authorId === user.id);
                  const isEditing = editingReviewId === review.id;
                  const isConfirmingDelete = confirmDeleteReviewId === review.id;
                  const isDeleting = deletingReviewId === review.id;

                  return (
                    <li key={review.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                          {formatRelativeDate(review.createdAt)}
                        </span>
                        <div className="flex items-center gap-2">
                          {review.isVerifiedBuyer ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                              <BadgeCheck size={12} /> {t('common.verified')}
                            </span>
                          ) : null}
                          <span className="text-sm font-bold text-primary">
                            {review.rating.toFixed(1)} / 5
                          </span>
                        </div>
                      </div>

                      {isEditing ? (
                        <form onSubmit={handleUpdateReview} className="mt-2 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                          <p className="text-xs font-black uppercase tracking-wider text-primary">{t('lesson.editingYourReview')}</p>
                          <div className="flex items-center gap-1">
                            {starSet.map((s) => (
                              <button
                                key={`edit-star-${s}`}
                                type="button"
                                onClick={() => setEditReviewRating(s)}
                                className="rounded-md p-0.5"
                              >
                                <Star size={16} className={s <= editReviewRating ? 'fill-yellow-500 text-yellow-500' : 'text-slate-300'} />
                              </button>
                            ))}
                          </div>
                          <textarea
                            required
                            rows={3}
                            value={editReviewComment}
                            onChange={(e) => setEditReviewComment(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
                          />
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={cancelEditingReview} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-slate-700">
                              {t('common.cancel')}
                            </button>
                            <button type="submit" disabled={savingEditReview} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-70">
                              {savingEditReview ? t('common.saving') : t('common.save')}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                          {review.comment}
                        </p>
                      )}

                      {/* Review actions row */}
                      {!isEditing ? (
                        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                          {/* Author-only edit/delete */}
                          {isReviewAuthor ? (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditingReview(review)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 transition-colors hover:text-primary"
                              >
                                <Edit3 size={12} /> {t('lesson.editReview')}
                              </button>
                              {isConfirmingDelete ? (
                                <span className="inline-flex items-center gap-2">
                                  <AlertCircle size={12} className="text-rose-400" />
                                  <span className="text-[11px] font-medium text-rose-400">{t('lesson.confirmDelete')}</span>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => void handleDeleteReview(review.id)}
                                    className="text-[11px] font-bold text-rose-500 hover:underline disabled:opacity-60"
                                  >
                                    {isDeleting ? t('lesson.deleting') : t('lesson.yes')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteReviewId(null)}
                                    className="text-[11px] font-bold text-slate-400 hover:underline"
                                  >
                                    {t('lesson.no')}
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteReviewId(review.id)}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 transition-colors hover:text-rose-500"
                                >
                                  <Trash2 size={12} /> {t('lesson.deleteReview')}
                                </button>
                              )}
                            </>
                          ) : null}

                          {/* Report review (non-author only) */}
                          {!isReviewAuthor && isAuthenticated ? (
                            <button
                              type="button"
                              onClick={() => openReportModal('review', review.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 transition-colors hover:text-amber-500"
                            >
                              <Flag size={12} /> {t('lesson.reportReview')}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-100">
                  {t('lesson.writeReview')}
                </h4>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                  detail.reviewPermission.canSubmit
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                }`}>
                  {toReviewReasonLabel(detail.reviewPermission.reason, t)}
                </span>
              </div>

              <p className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                {detail.reviewPermission.message}
              </p>

              <form onSubmit={(event) => { void handleSubmitReview(event); }} className="space-y-3">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                    {t('lesson.rating')}
                  </label>
                  <div className="flex items-center gap-1">
                    {starSet.map((item) => {
                      const active = item <= reviewRating;
                      return (
                        <button
                          key={`review-star-${item}`}
                          type="button"
                          disabled={!detail.reviewPermission.canSubmit || isSubmittingReview}
                          onClick={() => setReviewRating(item)}
                          className="rounded-md p-1 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Set rating to ${item}`}
                        >
                          <Star
                            size={18}
                            className={active ? 'fill-yellow-500 text-yellow-500' : 'text-slate-300'}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                    {t('lesson.feedback')}
                  </span>
                  <textarea
                    rows={4}
                    value={reviewComment}
                    onChange={(event) => setReviewComment(event.target.value)}
                    disabled={!detail.reviewPermission.canSubmit || isSubmittingReview}
                    placeholder={
                      detail.reviewPermission.canSubmit
                        ? t('lesson.feedbackPlaceholder')
                        : t('lesson.feedbackDisabledPlaceholder')
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800"
                  />
                </label>

                <button
                  type="submit"
                  disabled={!detail.reviewPermission.canSubmit || isSubmittingReview}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-black uppercase tracking-wider text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingReview ? t('lesson.submittingReview') : t('lesson.submitReview')}
                </button>
              </form>
            </div>
          </div>

          <section className="rounded-[2.25rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-primary">
                  <Sparkles size={14} /> {t('lesson.similarToViewed')}
                </div>
                <h3 className="text-xl font-black">{t('lesson.relatedLessonPlans')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('lesson.relatedLessonPlansDescription')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadRelatedLessons(lesson.id);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300"
              >
                <RefreshCw size={14} /> {t('lesson.refreshSuggestions')}
              </button>
            </div>

            {relatedLoading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {relatedSkeletonItems.map((item) => (
                  <div
                    key={item}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="aspect-4/3 animate-pulse bg-slate-200 dark:bg-slate-800" />
                    <div className="space-y-3 p-5">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800/80" />
                    </div>
                  </div>
                ))}
              </div>
            ) : relatedError ? (
              <EmptyState
                title={t('lesson.unableToLoadRelated')}
                description={relatedError}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      void loadRelatedLessons(lesson.id);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
                  >
                    <RefreshCw size={16} /> {t('lesson.retryRecommendations')}
                  </button>
                }
              />
            ) : relatedLessons.length === 0 ? (
              <EmptyState
                title={t('lesson.noRelatedLessons')}
                description={t('lesson.noRelatedLessonsDescription')}
                action={
                  <Link
                    to="/library"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
                  >
                    {t('lesson.exploreLibrary')}
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {relatedLessons.map((relatedLesson) => (
                  <LessonCard key={`related-${relatedLesson.id}`} lesson={relatedLesson} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-8 lg:col-span-1">
          <div className="sticky top-32 rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-8">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold uppercase tracking-widest text-slate-400">
                  {t('lesson.price')}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">
                    {safePrice <= 0 ? t('common.free') : formatCoins(safePrice)}
                  </span>
                  {safePrice > 0 ? (
                    <span className="text-lg font-bold text-slate-500">{t('common.coins')}</span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {t('lesson.accessState')}:{' '}
                <span className="font-black uppercase tracking-wider text-primary">
                  {detail.accessState.replace('_', ' ')}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={isProcessing || (!detail.canPurchase && !detail.canDownload)}
                  onClick={() => {
                    if (detail.canDownload) {
                      void handleDownloadLesson();
                      return;
                    }
                    void handleAcquireLesson();
                  }}
                  className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary text-lg font-black text-white shadow-xl shadow-primary/20 transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isProcessing ? (
                    <RefreshCw size={22} className="animate-spin" />
                  ) : (
                    ctaIcon
                  )}
                  {isProcessing ? t('lesson.processing') : ctaLabel}
                </button>
                <button
                  type="button"
                  disabled={isTogglingFavorite}
                  onClick={() => {
                    void handleToggleFavorite();
                  }}
                  className={`flex h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 font-bold transition-all disabled:cursor-not-allowed disabled:opacity-70 ${
                    isFavorited
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800'
                  }`}
                >
                  <Heart size={20} className={isFavorited ? 'fill-primary text-primary' : ''} />
                  {isTogglingFavorite
                    ? t('common.updating')
                    : isFavorited
                      ? t('lesson.favorited')
                      : t('lesson.addToFavorites')}
                </button>
              </div>

              {!detail.canDownload ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                  {t('lesson.downloadProtection', { message: detail.reviewPermission.message })}
                </p>
              ) : (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {t('lesson.hasEntitlement')}
                </p>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    {t('lesson.teacherTrust')}
                  </span>
                </div>
                <Link
                  to={`/teacher/${lesson.authorId}`}
                  className="mb-3 flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="size-10 overflow-hidden rounded-full bg-slate-200">
                    <img src={authorAvatarSrc} alt={authorName} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold text-slate-700 dark:text-slate-100">
                      {authorName}
                    </span>
                    <span className="truncate text-xs text-slate-500 dark:text-slate-300">
                      {authorExperience}
                    </span>
                  </div>
                </Link>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('lesson.viewEducatorProfile')}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-6 dark:border-slate-800">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl font-black">{formatCoins(safeDownloads)}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {t('lesson.downloads')}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl font-black">{formatCoins(safeReviewCount)}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {t('lesson.reviews')}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl font-black">{safeTags.length}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {t('lesson.tags')}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleShareLesson();
                  }}
                  className="flex h-12 flex-1 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:text-primary dark:bg-slate-800"
                >
                  <Share2 size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleJumpToReviews}
                  className="flex h-12 flex-1 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:text-primary dark:bg-slate-800"
                >
                  <MessageCircle size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
