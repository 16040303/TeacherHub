import { AdminModerateLessonPayload, AdminUpdateReportPayload, AdminUpdateUserPayload } from '../mock/contracts';
import { getDatabase, updateDatabase, withLatency } from '../mock/server/database';
import {
  AdminCommunityModerationFilters,
  AdminCommunityModerationItem,
  AdminDashboardSnapshot,
  AdminLessonModerationFilters,
  AdminOrderFilters,
  AdminOrderRow,
  AdminRecentActivityItem,
  AdminReportFilters,
  AdminReportRow,
  AdminUserFilters,
  DashboardStats,
  Lesson,
  LessonModerationStatus,
  LessonStatus,
  OrderStatus,
  ReportStatus,
  ReportTargetType,
  User,
  UserRole,
  UserStatus,
  WalletTransaction,
} from '../types';
import { mapBackendOrderStatus, mapBackendPaymentStatus } from '../utils/mappers';

export type SafeUser = Omit<User, 'password'>;

export interface AdminUserRow extends SafeUser {
  lessonsCount: number;
  publishedLessons: number;
  totalDownloads: number;
  lastLessonUpdatedAt: string | null;
}

export interface AdminLessonModerationRow {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  subject: string;
  gradeLevel: string;
  status: LessonStatus;
  moderationStatus: LessonModerationStatus;
  moderationNote?: string;
  price: number;
  downloads: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  moderationUpdatedAt?: string;
  moderationUpdatedBy?: string;
}

const DEFAULT_USER_FILTERS: AdminUserFilters = {
  search: '',
  role: 'all',
  status: 'all',
};

const DEFAULT_LESSON_FILTERS: AdminLessonModerationFilters = {
  search: '',
  moderationStatus: 'all',
  lifecycleStatus: 'all',
};

const sanitizeUser = (user: User): SafeUser => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

const normalizeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeRole = (value: unknown): UserRole => {
  if (value === 'admin' || value === 'user' || value === 'guest') {
    return value;
  }
  return 'user';
};

const normalizeUserStatus = (value: unknown): UserStatus => {
  if (value === 'active' || value === 'suspended' || value === 'locked') {
    return value;
  }
  return 'active';
};

const normalizeLessonStatus = (value: unknown): LessonStatus => {
  if (value === 'published' || value === 'draft' || value === 'hidden') {
    return value;
  }
  return 'draft';
};

const normalizeModerationStatus = (
  moderationStatus: unknown,
  lifecycleStatus: LessonStatus,
): LessonModerationStatus => {
  if (moderationStatus === 'pending' || moderationStatus === 'approved' || moderationStatus === 'rejected') {
    return moderationStatus;
  }

  return lifecycleStatus === 'draft' ? 'pending' : 'approved';
};

const normalizeRoleFilter = (value: AdminUserFilters['role'] | undefined): AdminUserFilters['role'] => {
  if (value === 'admin' || value === 'user' || value === 'guest') {
    return value;
  }
  return 'all';
};

const normalizeStatusFilter = (
  value: AdminUserFilters['status'] | undefined,
): AdminUserFilters['status'] => {
  if (value === 'active' || value === 'suspended' || value === 'locked') {
    return value;
  }
  return 'all';
};

const normalizeModerationFilter = (
  value: AdminLessonModerationFilters['moderationStatus'] | undefined,
): AdminLessonModerationFilters['moderationStatus'] => {
  if (value === 'pending' || value === 'approved' || value === 'rejected') {
    return value;
  }
  return 'all';
};

const normalizeLifecycleFilter = (
  value: AdminLessonModerationFilters['lifecycleStatus'] | undefined,
): AdminLessonModerationFilters['lifecycleStatus'] => {
  if (value === 'draft' || value === 'published' || value === 'hidden') {
    return value;
  }
  return 'all';
};

const toTimestamp = (value: string): number => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const toSafeIsoDate = (value: unknown, fallback: string): string => {
  const raw = normalizeText(value);
  if (!raw) {
    return fallback;
  }

  const timestamp = new Date(raw).getTime();
  if (Number.isNaN(timestamp)) {
    return fallback;
  }

  return new Date(timestamp).toISOString();
};

const toSafeNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const toSearchable = (values: Array<string | number | undefined>): string =>
  values
    .map((value) => String(value ?? ''))
    .join(' ')
    .toLowerCase();

const buildUserRow = (user: User, lessons: Lesson[]): AdminUserRow => {
  const safe = sanitizeUser(user);

  const safeLessons = lessons.map((lesson) => ({
    ...lesson,
    updatedAt: toSafeIsoDate(lesson.updatedAt, toSafeIsoDate(lesson.createdAt, new Date(0).toISOString())),
    status: normalizeLessonStatus(lesson.status),
    downloads: toSafeNumber(lesson.downloads),
  }));

  const latestLessonTimestamp = safeLessons.reduce(
    (latest, lesson) => Math.max(latest, toTimestamp(lesson.updatedAt)),
    0,
  );

  return {
    ...safe,
    id: normalizeText(safe.id) || normalizeText(safe.email) || 'unknown-user',
    name: normalizeText(safe.name) || 'Unknown User',
    email: normalizeText(safe.email) || 'unknown@teacherhub.local',
    role: normalizeRole(safe.role),
    status: normalizeUserStatus(safe.status),
    createdAt: toSafeIsoDate(safe.createdAt, new Date(0).toISOString()),
    lessonsCount: safeLessons.length,
    publishedLessons: safeLessons.filter((lesson) => lesson.status === 'published').length,
    totalDownloads: safeLessons.reduce((total, lesson) => total + lesson.downloads, 0),
    lastLessonUpdatedAt: latestLessonTimestamp > 0 ? new Date(latestLessonTimestamp).toISOString() : null,
  };
};

const buildLessonModerationRow = (
  lesson: Lesson,
  index: number,
  usersById: Map<string, User>,
): AdminLessonModerationRow => {
  const safeId = normalizeText(lesson.id) || `lesson-${index + 1}`;
  const authorId = normalizeText(lesson.authorId) || 'unknown-author';
  const author = usersById.get(authorId);
  const lifecycleStatus = normalizeLessonStatus(lesson.status);
  const moderationStatus = normalizeModerationStatus(
    lesson.moderationStatus,
    lifecycleStatus,
  );
  const createdAt = toSafeIsoDate(lesson.createdAt, new Date(0).toISOString());
  const updatedAt = toSafeIsoDate(lesson.updatedAt, createdAt);

  return {
    id: safeId,
    authorId,
    authorName: normalizeText(author?.name) || 'Unknown author',
    title: normalizeText(lesson.title) || 'Untitled lesson',
    subject: normalizeText(lesson.subject) || 'Unknown subject',
    gradeLevel: normalizeText(lesson.gradeLevel) || 'Unknown grade level',
    status: lifecycleStatus,
    moderationStatus,
    moderationNote: normalizeText(lesson.moderationNote) || undefined,
    price: Math.max(0, toSafeNumber(lesson.price)),
    downloads: Math.max(0, toSafeNumber(lesson.downloads)),
    rating: Math.max(0, toSafeNumber(lesson.rating)),
    createdAt,
    updatedAt,
    moderationUpdatedAt: normalizeText(lesson.moderationUpdatedAt)
      ? toSafeIsoDate(lesson.moderationUpdatedAt, updatedAt)
      : undefined,
    moderationUpdatedBy: normalizeText(lesson.moderationUpdatedBy) || undefined,
  };
};

const sortModerationRows = (
  left: AdminLessonModerationRow,
  right: AdminLessonModerationRow,
): number => {
  const moderationWeight: Record<LessonModerationStatus, number> = {
    pending: 0,
    rejected: 1,
    approved: 2,
  };

  if (moderationWeight[left.moderationStatus] !== moderationWeight[right.moderationStatus]) {
    return moderationWeight[left.moderationStatus] - moderationWeight[right.moderationStatus];
  }

  return toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
};

const buildRecentActivity = (
  limit: number,
): AdminRecentActivityItem[] => {
  const database = getDatabase();
  const usersById = new Map(database.users.map((user) => [normalizeText(user.id), user]));
  const activities: AdminRecentActivityItem[] = [];

  database.users.forEach((user, index) => {
    const createdAt = toSafeIsoDate(user.createdAt, new Date(0).toISOString());
    activities.push({
      id: `activity-user-${normalizeText(user.id) || index}`,
      type: 'user_joined',
      title: `${normalizeText(user.name) || 'A user'} joined TeacherHub`,
      subtitle: normalizeText(user.email) || undefined,
      createdAt,
    });
  });

  database.lessons.forEach((lesson, index) => {
    const authorName =
      normalizeText(usersById.get(normalizeText(lesson.authorId) || '')?.name) || 'Unknown author';
    const createdAt = toSafeIsoDate(lesson.createdAt, new Date(0).toISOString());

    activities.push({
      id: `activity-lesson-submitted-${normalizeText(lesson.id) || index}`,
      type: 'lesson_submitted',
      title: `Lesson submitted: ${normalizeText(lesson.title) || 'Untitled lesson'}`,
      subtitle: `by ${authorName}`,
      createdAt,
    });

    const moderationUpdatedAt = normalizeText(lesson.moderationUpdatedAt);
    if (moderationUpdatedAt) {
      activities.push({
        id: `activity-lesson-moderated-${normalizeText(lesson.id) || index}`,
        type: 'lesson_moderated',
        title: `Lesson moderated: ${normalizeText(lesson.title) || 'Untitled lesson'}`,
        subtitle:
          normalizeText(lesson.moderationNote) || `Status: ${normalizeModerationStatus(lesson.moderationStatus, normalizeLessonStatus(lesson.status))}`,
        createdAt: toSafeIsoDate(moderationUpdatedAt, createdAt),
      });
    }
  });

  database.orders.forEach((order, index) => {
    if (order.status !== 'paid') {
      return;
    }

    activities.push({
      id: `activity-order-${normalizeText(order.id) || index}`,
      type: 'order_paid',
      title: 'Order payment completed',
      subtitle: `Amount: ${Math.max(0, toSafeNumber(order.amount))} coins`,
      createdAt: toSafeIsoDate(order.createdAt, new Date(0).toISOString()),
    });
  });

  return activities
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
    .slice(0, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 8));
};

export const getAdminDashboardSnapshot = async (
  activityLimit = 10,
): Promise<AdminDashboardSnapshot> => {
  const database = getDatabase();

  const creatorIds = new Set(
    database.lessons
      .map((lesson) => normalizeText(lesson.authorId))
      .filter(Boolean),
  );

  const pendingModerations = database.lessons.filter((lesson) => {
    const lifecycleStatus = normalizeLessonStatus(lesson.status);
    const moderationStatus = normalizeModerationStatus(lesson.moderationStatus, lifecycleStatus);
    return moderationStatus === 'pending';
  }).length;

  const totalRevenue = database.orders.reduce((total, order) => {
    if (order.status !== 'paid') {
      return total;
    }

    return total + Math.max(0, toSafeNumber(order.amount));
  }, 0);

  const stats: DashboardStats = {
    totalUsers: database.users.length,
    totalCreators: creatorIds.size,
    totalLessons: database.lessons.length,
    totalCommunityPosts: database.communityPosts.length,
    totalReports: 0,
    totalOrders: database.orders.length,
    totalTransactions: database.walletTransactions.length,
    totalRevenue,
    pendingModerations,
    pendingReports: 0,
  };

  return withLatency(
    {
      stats,
      recentActivity: buildRecentActivity(activityLimit),
    },
    170,
  );
};

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const snapshot = await getAdminDashboardSnapshot(8);
  return snapshot.stats;
};

export const listUsersForAdmin = async (
  filters: Partial<AdminUserFilters> = {},
): Promise<AdminUserRow[]> => {
  const database = getDatabase();
  const mergedFilters: AdminUserFilters = {
    search: normalizeText(filters.search ?? DEFAULT_USER_FILTERS.search),
    role: normalizeRoleFilter(filters.role),
    status: normalizeStatusFilter(filters.status),
  };

  const rows = database.users.map((user) => {
    const lessons = database.lessons.filter(
      (lesson) => normalizeText(lesson.authorId) === normalizeText(user.id),
    );
    return buildUserRow(user, lessons);
  });

  const keyword = mergedFilters.search.toLowerCase();

  const filtered = rows.filter((row) => {
    if (mergedFilters.role !== 'all' && row.role !== mergedFilters.role) {
      return false;
    }

    if (mergedFilters.status !== 'all' && row.status !== mergedFilters.status) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const haystack = toSearchable([
      row.name,
      row.email,
      row.role,
      row.status,
      row.subject,
      row.location,
      row.bio,
    ]);

    return haystack.includes(keyword);
  });

  filtered.sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));

  return withLatency(filtered, 180);
};

export const getUserForAdmin = async (userId: string): Promise<AdminUserRow | null> => {
  const safeUserId = normalizeText(userId);
  if (!safeUserId) {
    return withLatency(null, 80);
  }

  const database = getDatabase();
  const user = database.users.find((item) => normalizeText(item.id) === safeUserId);
  if (!user) {
    return withLatency(null, 80);
  }

  const lessons = database.lessons.filter(
    (lesson) => normalizeText(lesson.authorId) === safeUserId,
  );

  return withLatency(buildUserRow(user, lessons), 120);
};

export const updateUserAsAdmin = async (
  userId: string,
  payload: AdminUpdateUserPayload,
): Promise<AdminUserRow> => {
  const safeUserId = normalizeText(userId);
  if (!safeUserId) {
    throw new Error('User not found');
  }

  let touchedUserId: string | null = null;

  updateDatabase((draft) => {
    const user = draft.users.find((item) => normalizeText(item.id) === safeUserId);
    if (!user) {
      return;
    }

    if (payload.role) {
      user.role = normalizeRole(payload.role);
    }

    if (payload.status) {
      user.status = normalizeUserStatus(payload.status);
    }

    touchedUserId = normalizeText(user.id);
  });

  if (!touchedUserId) {
    throw new Error('User not found');
  }

  const database = getDatabase();
  const user = database.users.find((item) => normalizeText(item.id) === touchedUserId);
  if (!user) {
    throw new Error('User not found');
  }

  const lessons = database.lessons.filter(
    (lesson) => normalizeText(lesson.authorId) === touchedUserId,
  );

  return withLatency(buildUserRow(user, lessons), 140);
};

export const listLessonsForModeration = async (
  filters: Partial<AdminLessonModerationFilters> = {},
): Promise<AdminLessonModerationRow[]> => {
  const database = getDatabase();
  const usersById = new Map(database.users.map((user) => [normalizeText(user.id), user]));
  const mergedFilters: AdminLessonModerationFilters = {
    search: normalizeText(filters.search ?? DEFAULT_LESSON_FILTERS.search),
    moderationStatus: normalizeModerationFilter(filters.moderationStatus),
    lifecycleStatus: normalizeLifecycleFilter(filters.lifecycleStatus),
  };

  const keyword = mergedFilters.search.toLowerCase();

  const rows = database.lessons
    .map((lesson, index) => buildLessonModerationRow(lesson, index, usersById))
    .filter((row) => {
      if (
        mergedFilters.moderationStatus !== 'all' &&
        row.moderationStatus !== mergedFilters.moderationStatus
      ) {
        return false;
      }

      if (
        mergedFilters.lifecycleStatus !== 'all' &&
        row.status !== mergedFilters.lifecycleStatus
      ) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const haystack = toSearchable([
        row.title,
        row.authorName,
        row.subject,
        row.gradeLevel,
        row.status,
        row.moderationStatus,
        row.moderationNote,
      ]);

      return haystack.includes(keyword);
    })
    .sort(sortModerationRows);

  return withLatency(rows, 170);
};

export const getLessonForModeration = async (
  lessonId: string,
): Promise<AdminLessonModerationRow | null> => {
  const safeLessonId = normalizeText(lessonId);
  if (!safeLessonId) {
    return withLatency(null, 90);
  }

  const database = getDatabase();
  const usersById = new Map(database.users.map((user) => [normalizeText(user.id), user]));
  const index = database.lessons.findIndex(
    (lesson) => normalizeText(lesson.id) === safeLessonId,
  );

  if (index < 0) {
    return withLatency(null, 90);
  }

  return withLatency(buildLessonModerationRow(database.lessons[index], index, usersById), 120);
};

export const moderateLessonAsAdmin = async (
  lessonId: string,
  payload: AdminModerateLessonPayload,
): Promise<AdminLessonModerationRow> => {
  const safeLessonId = normalizeText(lessonId);
  const action = payload.action;

  if (!safeLessonId) {
    throw new Error('Lesson not found');
  }

  if (!action || !['approve', 'reject', 'hide', 'unhide'].includes(action)) {
    throw new Error('Unsupported moderation action');
  }

  let updatedLessonId: string | null = null;

  updateDatabase((draft) => {
    const lesson = draft.lessons.find((item) => normalizeText(item.id) === safeLessonId);
    if (!lesson) {
      return;
    }

    const note = normalizeText(payload.note);
    const now = new Date().toISOString();

    if (action === 'approve') {
      lesson.status = 'published';
      lesson.moderationStatus = 'approved';
      lesson.moderationNote = note || 'Approved by admin moderation.';
    }

    if (action === 'reject') {
      lesson.status = 'draft';
      lesson.moderationStatus = 'rejected';
      lesson.moderationNote = note || 'Rejected by admin moderation. Requires revision.';
    }

    if (action === 'hide') {
      lesson.status = 'hidden';
      lesson.moderationStatus = 'approved';
      lesson.moderationNote = note || lesson.moderationNote || 'Hidden by admin moderation.';
    }

    if (action === 'unhide') {
      lesson.status = 'published';
      lesson.moderationStatus = 'approved';
      lesson.moderationNote = note || lesson.moderationNote || 'Lesson unhidden by admin moderation.';
    }

    lesson.updatedAt = now;
    lesson.moderationUpdatedAt = now;
    lesson.moderationUpdatedBy = normalizeText(payload.adminId) || 'u-admin';

    updatedLessonId = normalizeText(lesson.id);
  });

  if (!updatedLessonId) {
    throw new Error('Lesson not found');
  }

  const row = await getLessonForModeration(updatedLessonId);
  if (!row) {
    throw new Error('Unable to load moderated lesson');
  }

  return withLatency(row, 120);
};

const normalizeTransactionType = (
  type: WalletTransaction['type'] | string,
): WalletTransaction['type'] => {
  if (
    type === 'sale' ||
    type === 'withdrawal' ||
    type === 'purchase' ||
    type === 'bonus' ||
    type === 'topup'
  ) {
    return type;
  }

  return 'bonus';
};

const normalizeTransactionStatus = (
  status: WalletTransaction['status'] | string,
): WalletTransaction['status'] => {
  if (status === 'pending' || status === 'completed') {
    return status;
  }

  return 'completed';
};

export const listRecentTransactions = async (
  limit = 10,
): Promise<WalletTransaction[]> => {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;

  const transactions = [...getDatabase().walletTransactions]
    .map((transaction, index) => ({
      ...transaction,
      id: normalizeText(transaction.id) || `tx-${index + 1}`,
      userId: normalizeText(transaction.userId) || 'unknown-user',
      description: normalizeText(transaction.description) || 'Wallet transaction',
      date: toSafeIsoDate(transaction.date, new Date(0).toISOString()),
      amount: toSafeNumber(transaction.amount),
      type: normalizeTransactionType(transaction.type),
      status: normalizeTransactionStatus(transaction.status),
    }))
    .sort((left, right) => toTimestamp(right.date) - toTimestamp(left.date))
    .slice(0, safeLimit);

  return withLatency(transactions, 120);
};

/* ================================================================== */
/*  BATCH 2 — Community Moderation                                     */
/* ================================================================== */

const DEFAULT_COMMUNITY_MOD_FILTERS: AdminCommunityModerationFilters = {
  search: '',
  contentType: 'all',
};

export const listCommunityForModeration = async (
  filters: Partial<AdminCommunityModerationFilters> = {},
): Promise<AdminCommunityModerationItem[]> => {
  const database = getDatabase();
  const usersById = new Map(database.users.map((u) => [normalizeText(u.id), u]));
  const mergedFilters: AdminCommunityModerationFilters = {
    search: normalizeText(filters.search ?? DEFAULT_COMMUNITY_MOD_FILTERS.search),
    contentType: (['post', 'comment'].includes(filters.contentType ?? '') ? filters.contentType! : 'all') as AdminCommunityModerationFilters['contentType'],
  };

  const keyword = mergedFilters.search.toLowerCase();
  const items: AdminCommunityModerationItem[] = [];

  // Build comment counts map
  const commentCounts = new Map<string, number>();
  database.communityComments.forEach((c) => {
    commentCounts.set(c.postId, (commentCounts.get(c.postId) ?? 0) + 1);
  });

  if (mergedFilters.contentType === 'all' || mergedFilters.contentType === 'post') {
    database.communityPosts.forEach((post) => {
      const author = usersById.get(normalizeText(post.authorId));
      const authorName = normalizeText(author?.name) || 'Unknown';
      const preview = normalizeText(post.excerpt) || normalizeText(post.content).slice(0, 140) || 'No content';
      const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];

      items.push({
        id: normalizeText(post.id) || `post-${items.length}`,
        contentType: 'post',
        authorId: normalizeText(post.authorId) || 'unknown',
        authorName,
        title: normalizeText(post.title) || undefined,
        preview,
        likes: likedBy.length,
        commentCount: commentCounts.get(post.id) ?? 0,
        createdAt: toSafeIsoDate(post.createdAt, new Date(0).toISOString()),
      });
    });
  }

  if (mergedFilters.contentType === 'all' || mergedFilters.contentType === 'comment') {
    const postsById = new Map(database.communityPosts.map((p) => [normalizeText(p.id), p]));
    database.communityComments.forEach((comment) => {
      const author = usersById.get(normalizeText(comment.authorId));
      const authorName = normalizeText(author?.name) || 'Unknown';
      const parentPost = postsById.get(normalizeText(comment.postId));

      items.push({
        id: normalizeText(comment.id) || `comment-${items.length}`,
        contentType: 'comment',
        authorId: normalizeText(comment.authorId) || 'unknown',
        authorName,
        preview: normalizeText(comment.content).slice(0, 200) || 'No content',
        postTitle: normalizeText(parentPost?.title) || undefined,
        likes: 0,
        commentCount: 0,
        createdAt: toSafeIsoDate(comment.createdAt, new Date(0).toISOString()),
      });
    });
  }

  const filtered = keyword
    ? items.filter((item) => {
        const haystack = toSearchable([
          item.authorName,
          item.title,
          item.preview,
          item.postTitle,
          item.contentType,
        ]);
        return haystack.includes(keyword);
      })
    : items;

  filtered.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));

  return withLatency(filtered, 160);
};

export const removeCommunityContent = async (
  contentId: string,
  contentType: 'post' | 'comment',
): Promise<void> => {
  const safeId = normalizeText(contentId);
  if (!safeId) throw new Error('Content not found');

  let removed = false;

  updateDatabase((draft) => {
    if (contentType === 'post') {
      const index = draft.communityPosts.findIndex((p) => normalizeText(p.id) === safeId);
      if (index >= 0) {
        draft.communityPosts.splice(index, 1);
        draft.communityComments = draft.communityComments.filter((c) => normalizeText(c.postId) !== safeId);
        removed = true;
      }
    } else {
      const index = draft.communityComments.findIndex((c) => normalizeText(c.id) === safeId);
      if (index >= 0) {
        draft.communityComments.splice(index, 1);
        removed = true;
      }
    }
  });

  if (!removed) throw new Error('Content not found');

  await withLatency(true, 100);
};

/* ================================================================== */
/*  BATCH 2 — Report Management                                        */
/* ================================================================== */

const DEFAULT_REPORT_FILTERS: AdminReportFilters = {
  search: '',
  status: 'all',
  targetType: 'all',
};

const normalizeReportStatus = (value: unknown): ReportStatus => {
  if (value === 'pending' || value === 'reviewing' || value === 'resolved' || value === 'dismissed') {
    return value;
  }
  return 'pending';
};

const normalizeReportTargetType = (value: unknown): ReportTargetType => {
  if (value === 'post' || value === 'comment' || value === 'lesson' || value === 'user') {
    return value;
  }
  return 'post';
};

const getTargetPreview = (targetType: ReportTargetType, targetId: string): string => {
  const database = getDatabase();
  const safeId = normalizeText(targetId);

  if (targetType === 'post') {
    const post = database.communityPosts.find((p) => normalizeText(p.id) === safeId);
    return normalizeText(post?.title) || normalizeText(post?.excerpt) || 'Deleted or unknown post';
  }
  if (targetType === 'comment') {
    const comment = database.communityComments.find((c) => normalizeText(c.id) === safeId);
    return normalizeText(comment?.content)?.slice(0, 120) || 'Deleted or unknown comment';
  }
  if (targetType === 'lesson') {
    const lesson = database.lessons.find((l) => normalizeText(l.id) === safeId);
    return normalizeText(lesson?.title) || 'Deleted or unknown lesson';
  }
  if (targetType === 'user') {
    const user = database.users.find((u) => normalizeText(u.id) === safeId);
    return normalizeText(user?.name) || normalizeText(user?.email) || 'Unknown user';
  }
  return 'Unknown target';
};

const resolveReportTargetPath = (
  targetType: ReportTargetType,
  targetId: string,
): { path?: string; unavailableReason?: string } => {
  const database = getDatabase();
  const safeId = normalizeText(targetId);
  if (!safeId) {
    return { unavailableReason: 'Target id is missing for this report.' };
  }

  if (targetType === 'post') {
    const postExists = database.communityPosts.some((post) => normalizeText(post.id) === safeId);
    if (!postExists) {
      return { unavailableReason: 'This post is no longer available.' };
    }
    return { path: `/community/${safeId}` };
  }

  if (targetType === 'comment') {
    const comment = database.communityComments.find((item) => normalizeText(item.id) === safeId);
    if (!comment) {
      return { unavailableReason: 'This comment is no longer available.' };
    }

    const postId = normalizeText(comment.postId);
    if (!postId) {
      return { unavailableReason: 'The parent post for this comment is missing.' };
    }

    const postExists = database.communityPosts.some((post) => normalizeText(post.id) === postId);
    if (!postExists) {
      return { unavailableReason: 'The parent post for this comment is no longer available.' };
    }

    return { path: `/community/${postId}` };
  }

  if (targetType === 'lesson') {
    const lessonExists = database.lessons.some((lesson) => normalizeText(lesson.id) === safeId);
    if (!lessonExists) {
      return { unavailableReason: 'This lesson is no longer available.' };
    }
    return { path: `/lesson/${safeId}` };
  }

  if (targetType === 'user') {
    const userExists = database.users.some((user) => normalizeText(user.id) === safeId);
    if (!userExists) {
      return { unavailableReason: 'This user profile is no longer available.' };
    }
    return { path: `/teacher/${safeId}` };
  }

  return { unavailableReason: 'This report target type is not supported for navigation.' };
};

export const listReportsForAdmin = async (
  filters: Partial<AdminReportFilters> = {},
): Promise<AdminReportRow[]> => {
  const database = getDatabase();
  const usersById = new Map(database.users.map((u) => [normalizeText(u.id), u]));
  const mergedFilters: AdminReportFilters = {
    search: normalizeText(filters.search ?? DEFAULT_REPORT_FILTERS.search),
    status: (['pending', 'reviewing', 'resolved', 'dismissed'].includes(filters.status ?? '') ? filters.status! : 'all') as AdminReportFilters['status'],
    targetType: (['post', 'comment', 'lesson', 'user'].includes(filters.targetType ?? '') ? filters.targetType! : 'all') as AdminReportFilters['targetType'],
  };

  const keyword = mergedFilters.search.toLowerCase();
  const reports = Array.isArray(database.reports) ? database.reports : [];

  const rows: AdminReportRow[] = reports.map((report) => {
    const targetType = normalizeReportTargetType(report.targetType);
    const reporter = usersById.get(normalizeText(report.reporterId));
    const safeTargetId = normalizeText(report.targetId) || 'unknown';
    const resolvedTarget = resolveReportTargetPath(targetType, safeTargetId);

    return {
      id: normalizeText(report.id) || `rpt-unknown`,
      reporterId: normalizeText(report.reporterId) || 'unknown',
      reporterName: normalizeText(reporter?.name) || 'Unknown reporter',
      targetType,
      targetId: safeTargetId,
      targetPreview: getTargetPreview(targetType, safeTargetId),
      targetPath: resolvedTarget.path,
      targetUnavailableReason: resolvedTarget.unavailableReason,
      reason: normalizeText(report.reason) || 'No reason provided',
      category: normalizeText(report.category) || 'Other',
      adminNote: normalizeText(report.adminNote) || undefined,
      status: normalizeReportStatus(report.status),
      createdAt: toSafeIsoDate(report.createdAt, new Date(0).toISOString()),
      updatedAt: toSafeIsoDate(report.updatedAt, new Date(0).toISOString()),
    };
  });

  const filtered = rows.filter((row) => {
    if (mergedFilters.status !== 'all' && row.status !== mergedFilters.status) return false;
    if (mergedFilters.targetType !== 'all' && row.targetType !== mergedFilters.targetType) return false;
    if (!keyword) return true;
    const haystack = toSearchable([
      row.reporterName,
      row.reason,
      row.category,
      row.targetPreview,
      row.targetType,
      row.status,
      row.adminNote,
    ]);
    return haystack.includes(keyword);
  });

  const statusWeight: Record<ReportStatus, number> = {
    pending: 0,
    reviewing: 1,
    resolved: 2,
    dismissed: 3,
  };

  filtered.sort((a, b) => {
    if (statusWeight[a.status] !== statusWeight[b.status]) {
      return statusWeight[a.status] - statusWeight[b.status];
    }
    return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
  });

  return withLatency(filtered, 160);
};

export const updateReportAsAdmin = async (
  reportId: string,
  payload: AdminUpdateReportPayload,
): Promise<AdminReportRow> => {
  const safeId = normalizeText(reportId);
  if (!safeId) throw new Error('Report not found');

  let updatedId: string | null = null;

  updateDatabase((draft) => {
    const reports = Array.isArray(draft.reports) ? draft.reports : [];
    const report = reports.find((r) => normalizeText(r.id) === safeId);
    if (!report) return;

    report.status = normalizeReportStatus(payload.status);
    if (typeof payload.adminNote === 'string') {
      report.adminNote = payload.adminNote.trim();
    }
    report.updatedAt = new Date().toISOString();
    updatedId = normalizeText(report.id);
  });

  if (!updatedId) throw new Error('Report not found');

  const rows = await listReportsForAdmin();
  const row = rows.find((r) => r.id === updatedId);
  if (!row) throw new Error('Unable to load updated report');

  return withLatency(row, 100);
};

/* ================================================================== */
/*  BATCH 2 — Orders / Transactions Admin                              */
/* ================================================================== */

const DEFAULT_ORDER_FILTERS: AdminOrderFilters = {
  search: '',
  status: 'all',
};

export const listOrdersForAdmin = async (
  filters: Partial<AdminOrderFilters> = {},
): Promise<AdminOrderRow[]> => {
  const database = getDatabase();
  const usersById = new Map(database.users.map((u) => [normalizeText(u.id), u]));
  const lessonsById = new Map(database.lessons.map((l) => [normalizeText(l.id), l]));
  const mergedFilters: AdminOrderFilters = {
    search: normalizeText(filters.search ?? DEFAULT_ORDER_FILTERS.search),
    status: (['pending', 'paid', 'failed', 'cancelled'].includes(filters.status ?? '') ? filters.status! : 'all') as AdminOrderFilters['status'],
  };

  const keyword = mergedFilters.search.toLowerCase();

  const rows: AdminOrderRow[] = database.orders.map((order) => {
    const buyer = usersById.get(normalizeText(order.userId));
    const lesson = lessonsById.get(normalizeText(order.lessonId));
    const seller = usersById.get(normalizeText(order.lessonAuthorId));

    return {
      id: normalizeText(order.id) || `order-unknown`,
      userId: normalizeText(order.userId) || 'unknown',
      buyerName: normalizeText(buyer?.name) || 'Unknown buyer',
      lessonId: normalizeText(order.lessonId) || 'unknown',
      lessonTitle: normalizeText(lesson?.title) || 'Unknown lesson',
      lessonAuthorId: normalizeText(order.lessonAuthorId) || 'unknown',
      sellerName: normalizeText(seller?.name) || 'Unknown seller',
      amount: toSafeNumber(order.amount),
      status: mapBackendOrderStatus(String(order.status)),
      paymentStatus: order.paymentStatus
        ? mapBackendPaymentStatus(String(order.paymentStatus))
        : undefined,
      createdAt: toSafeIsoDate(order.createdAt, new Date(0).toISOString()),
      updatedAt: toSafeIsoDate(order.updatedAt, toSafeIsoDate(order.createdAt, new Date(0).toISOString())),
      paidAt: normalizeText(order.paidAt) ? toSafeIsoDate(order.paidAt, toSafeIsoDate(order.createdAt, new Date(0).toISOString())) : undefined,
      failedAt: normalizeText(order.failedAt)
        ? toSafeIsoDate(order.failedAt, toSafeIsoDate(order.createdAt, new Date(0).toISOString()))
        : undefined,
      cancelledAt: normalizeText(order.cancelledAt)
        ? toSafeIsoDate(order.cancelledAt, toSafeIsoDate(order.createdAt, new Date(0).toISOString()))
        : undefined,
      entitlementGrantedAt: normalizeText(order.entitlementGrantedAt)
        ? toSafeIsoDate(order.entitlementGrantedAt, toSafeIsoDate(order.createdAt, new Date(0).toISOString()))
        : undefined,
      entitlementSource:
        order.entitlementSource === 'payment_confirmed' ||
        order.entitlementSource === 'free_lesson' ||
        order.entitlementSource === 'manual' ||
        order.entitlementSource === 'unknown'
          ? order.entitlementSource
          : undefined,
      paymentMethod:
        order.paymentMethod === 'bank' ||
        order.paymentMethod === 'vnpay' ||
        order.paymentMethod === 'momo' ||
        order.paymentMethod === 'wallet' ||
        order.paymentMethod === 'promo' ||
        order.paymentMethod === 'unknown'
          ? order.paymentMethod
          : undefined,
      paymentRef: normalizeText(order.paymentRef) || undefined,
    };
  });

  const filtered = rows.filter((row) => {
    if (mergedFilters.status !== 'all' && row.status !== mergedFilters.status) return false;
    if (!keyword) return true;
    const haystack = toSearchable([
      row.id,
      row.buyerName,
      row.lessonTitle,
      row.sellerName,
      row.status,
      row.paymentRef,
    ]);
    return haystack.includes(keyword);
  });

  filtered.sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));

  return withLatency(filtered, 150);
};
