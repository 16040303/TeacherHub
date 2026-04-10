import {
  LessonLifecycleStatus,
  ModerationStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ReportStatus,
  UserRole,
  UserStatus,
  WalletTransactionStatus,
} from "@prisma/client";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import {
  DashboardSnapshotQueryInput,
  ListAdminOrdersQueryInput,
  ListAdminReportsQueryInput,
  ListAdminUsersQueryInput,
  ListCommunityModerationQueryInput,
  ListLessonsForModerationQueryInput,
  ListRecentTransactionsQueryInput,
  ModerateLessonInput,
  UpdateAdminReportInput,
  UpdateAdminUserInput,
} from "../validators/admin.validator";

interface DashboardStats {
  totalUsers: number;
  totalCreators: number;
  totalLessons: number;
  totalCommunityPosts: number;
  totalReports: number;
  totalOrders: number;
  totalTransactions: number;
  totalRevenue: number;
  pendingModerations: number;
  pendingReports: number;
}

type UserRoleView = "guest" | "user" | "admin";
type UserStatusView = "active" | "suspended" | "locked";
type LessonStatusView = "draft" | "published" | "hidden";
type LessonModerationStatusView = "pending" | "approved" | "rejected";
type ReportStatusView = "pending" | "reviewing" | "resolved" | "dismissed";
type ReportTargetTypeView = "post" | "comment" | "lesson" | "user";
type PaymentStatusView = "success" | "failed" | "pending";
type WalletTransactionTypeView =
  | "sale"
  | "withdrawal"
  | "purchase"
  | "bonus"
  | "topup"
  | "refund";
type WalletTransactionStatusView = "completed" | "pending" | "failed" | "cancelled";

interface AdminRecentActivityItem {
  id: string;
  type:
    | "user_joined"
    | "lesson_submitted"
    | "lesson_moderated"
    | "order_paid"
    | "report_flagged";
  title: string;
  subtitle?: string;
  createdAt: string;
}

interface AdminDashboardSnapshot {
  stats: DashboardStats;
  recentActivity: AdminRecentActivityItem[];
}

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRoleView;
  status: UserStatusView;
  avatar?: string;
  subject?: string;
  experience?: string;
  location?: string;
  bio?: string;
  language: "en" | "vi";
  createdAt: string;
  lessonsCount: number;
  publishedLessons: number;
  totalDownloads: number;
  lastLessonUpdatedAt: string | null;
}

interface AdminLessonModerationRow {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  subject: string;
  gradeLevel: string;
  status: LessonStatusView;
  moderationStatus: LessonModerationStatusView;
  moderationNote?: string;
  price: number;
  downloads: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  moderationUpdatedAt?: string;
  moderationUpdatedBy?: string;
}

interface AdminCommunityModerationItem {
  id: string;
  contentType: "post" | "comment";
  authorId: string;
  authorName: string;
  title?: string;
  preview: string;
  postTitle?: string;
  likes: number;
  commentCount: number;
  createdAt: string;
}

interface AdminReportRow {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: ReportTargetTypeView;
  targetId: string;
  targetPreview: string;
  targetPath?: string;
  targetUnavailableReason?: string;
  reason: string;
  category: string;
  adminNote?: string;
  status: ReportStatusView;
  createdAt: string;
  updatedAt: string;
}

interface AdminOrderRow {
  id: string;
  userId: string;
  buyerName: string;
  lessonId: string;
  lessonTitle: string;
  lessonAuthorId: string;
  sellerName: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  paymentStatus?: PaymentStatusView;
  createdAt: string;
  updatedAt?: string;
  paidAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  entitlementGrantedAt?: string;
  entitlementSource?: "payment_confirmed" | "free_lesson" | "manual" | "unknown";
  paymentMethod?: "bank" | "vnpay" | "momo" | "wallet" | "promo" | "unknown";
  paymentRef?: string;
}

interface WalletTransactionView {
  id: string;
  userId: string;
  date: string;
  description: string;
  type: WalletTransactionTypeView;
  amount: number;
  status: WalletTransactionStatusView;
  contextTitle?: string;
  contextId?: string;
  contextType?: "lesson" | "order" | "wallet" | "system";
  target?: string;
  note?: string;
}

interface ListFilter<TStatus, TType = never> {
  search?: string;
  status?: TStatus;
  targetType?: TType;
}

const toIso = (value: Date | string | null | undefined, fallback: string): string => {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
};

const toTimestamp = (value: Date | string | null | undefined): number => {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const toSearchable = (values: Array<string | number | undefined>): string => {
  return values
    .map((value) => String(value ?? ""))
    .join(" ")
    .toLowerCase();
};

const toPositiveNumber = (value: Prisma.Decimal | number | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }

  return num;
};

const mapUserRole = (role: UserRole): UserRoleView => {
  switch (role) {
    case UserRole.ADMIN:
      return "admin";
    case UserRole.STUDENT:
      return "guest";
    case UserRole.TEACHER:
    default:
      return "user";
  }
};

const mapUserStatus = (status: UserStatus): UserStatusView => {
  switch (status) {
    case UserStatus.SUSPENDED:
      return "suspended";
    case UserStatus.PENDING:
      return "locked";
    case UserStatus.INACTIVE:
      return "locked";
    case UserStatus.ACTIVE:
    default:
      return "active";
  }
};

const toPrismaUserRole = (role: UserRoleView): UserRole => {
  switch (role) {
    case "admin":
      return UserRole.ADMIN;
    case "guest":
      return UserRole.STUDENT;
    case "user":
    default:
      return UserRole.TEACHER;
  }
};

const toPrismaUserStatus = (status: UserStatusView): UserStatus => {
  switch (status) {
    case "suspended":
      return UserStatus.SUSPENDED;
    case "locked":
      return UserStatus.INACTIVE;
    case "active":
    default:
      return UserStatus.ACTIVE;
  }
};

const mapLessonStatus = (status: LessonLifecycleStatus): LessonStatusView => {
  switch (status) {
    case LessonLifecycleStatus.PUBLISHED:
      return "published";
    case LessonLifecycleStatus.ARCHIVED:
      return "hidden";
    case LessonLifecycleStatus.DRAFT:
    default:
      return "draft";
  }
};

const mapModerationStatus = (
  moderationStatus: ModerationStatus,
  lessonStatus: LessonLifecycleStatus
): LessonModerationStatusView => {
  if (moderationStatus === ModerationStatus.APPROVED) {
    return "approved";
  }

  if (moderationStatus === ModerationStatus.REJECTED) {
    return "rejected";
  }

  return lessonStatus === LessonLifecycleStatus.DRAFT ? "pending" : "approved";
};

const toPrismaModerationStatus = (
  status: LessonModerationStatusView
): ModerationStatus => {
  switch (status) {
    case "approved":
      return ModerationStatus.APPROVED;
    case "rejected":
      return ModerationStatus.REJECTED;
    case "pending":
    default:
      return ModerationStatus.PENDING;
  }
};

const mapReportStatus = (status: ReportStatus): ReportStatusView => {
  switch (status) {
    case ReportStatus.IN_REVIEW:
      return "reviewing";
    case ReportStatus.RESOLVED:
      return "resolved";
    case ReportStatus.REJECTED:
      return "dismissed";
    case ReportStatus.OPEN:
    default:
      return "pending";
  }
};

const toPrismaReportStatus = (status: ReportStatusView): ReportStatus => {
  switch (status) {
    case "reviewing":
      return ReportStatus.IN_REVIEW;
    case "resolved":
      return ReportStatus.RESOLVED;
    case "dismissed":
      return ReportStatus.REJECTED;
    case "pending":
    default:
      return ReportStatus.OPEN;
  }
};

const mapOrderStatus = (status: OrderStatus): AdminOrderRow["status"] => {
  switch (status) {
    case OrderStatus.PAID:
      return "paid";
    case OrderStatus.FAILED:
      return "failed";
    case OrderStatus.CANCELLED:
      return "cancelled";
    case OrderStatus.PENDING:
    default:
      return "pending";
  }
};

const mapPaymentStatus = (status: PaymentStatus | null | undefined): PaymentStatusView | undefined => {
  if (!status) {
    return undefined;
  }

  switch (status) {
    case PaymentStatus.PAID:
      return "success";
    case PaymentStatus.FAILED:
    case PaymentStatus.CANCELLED:
      return "failed";
    case PaymentStatus.PENDING:
    default:
      return "pending";
  }
};

const mapWalletTransactionStatus = (
  status: WalletTransactionStatus
): WalletTransactionStatusView => {
  switch (status) {
    case WalletTransactionStatus.PENDING:
      return "pending";
    case WalletTransactionStatus.FAILED:
      return "failed";
    case WalletTransactionStatus.CANCELLED:
      return "cancelled";
    case WalletTransactionStatus.COMPLETED:
    default:
      return "completed";
  }
};

const mapWalletTransactionType = (type: string): WalletTransactionTypeView => {
  const normalized = type.trim().toLowerCase();

  if (
    normalized === "sale" ||
    normalized === "withdrawal" ||
    normalized === "purchase" ||
    normalized === "bonus" ||
    normalized === "topup" ||
    normalized === "refund"
  ) {
    return normalized;
  }

  return "bonus";
};

const parseTransactionMeta = (
  metadata: Prisma.JsonValue | null
): Record<string, unknown> | undefined => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }

  return metadata as Record<string, unknown>;
};

const mapTransactionContextType = (
  value: unknown
): WalletTransactionView["contextType"] => {
  if (value === "lesson" || value === "order" || value === "wallet" || value === "system") {
    return value;
  }

  return undefined;
};

const toLanguage = (value: string | null | undefined): "en" | "vi" => {
  return value?.toLowerCase() === "vi" ? "vi" : "en";
};

const matchesSearch = (search: string | undefined, values: Array<string | number | undefined>): boolean => {
  if (!search?.trim()) {
    return true;
  }

  return toSearchable(values).includes(search.trim().toLowerCase());
};

const getReportTargetType = (report: {
  targetPostId: number | null;
  targetCommentId: number | null;
  targetLessonId: number | null;
  targetUserId: number | null;
}): ReportTargetTypeView => {
  if (report.targetCommentId !== null) {
    return "comment";
  }

  if (report.targetPostId !== null) {
    return "post";
  }

  if (report.targetLessonId !== null) {
    return "lesson";
  }

  return "user";
};

const getReportTargetId = (report: {
  targetPostId: number | null;
  targetCommentId: number | null;
  targetLessonId: number | null;
  targetUserId: number | null;
}): number => {
  return (
    report.targetCommentId ??
    report.targetPostId ??
    report.targetLessonId ??
    report.targetUserId ??
    0
  );
};

const getReportTargetPreview = (report: {
  targetPost: { title: string | null; content: string } | null;
  targetComment: { content: string } | null;
  targetLesson: { title: string } | null;
  targetUser: { fullName: string; email: string } | null;
}): string => {
  if (report.targetComment) {
    const content = report.targetComment.content.trim();
    return content.slice(0, 120) || "Deleted or unknown comment";
  }

  if (report.targetPost) {
    return report.targetPost.title?.trim() || report.targetPost.content.slice(0, 120) || "Deleted or unknown post";
  }

  if (report.targetLesson) {
    return report.targetLesson.title || "Deleted or unknown lesson";
  }

  if (report.targetUser) {
    return report.targetUser.fullName || report.targetUser.email || "Unknown user";
  }

  return "Unknown target";
};

const getReportTargetPath = (report: {
  targetPostId: number | null;
  targetCommentId: number | null;
  targetLessonId: number | null;
  targetUserId: number | null;
  targetComment: { postId: number } | null;
  targetPost: { id: number } | null;
  targetLesson: { id: number } | null;
  targetUser: { id: number } | null;
}): { path?: string; unavailableReason?: string } => {
  if (report.targetCommentId !== null) {
    if (!report.targetComment) {
      return { unavailableReason: "This comment is no longer available." };
    }

    return { path: `/community/${report.targetComment.postId}` };
  }

  if (report.targetPostId !== null) {
    if (!report.targetPost) {
      return { unavailableReason: "This post is no longer available." };
    }

    return { path: `/community/${report.targetPost.id}` };
  }

  if (report.targetLessonId !== null) {
    if (!report.targetLesson) {
      return { unavailableReason: "This lesson is no longer available." };
    }

    return { path: `/lesson/${report.targetLesson.id}` };
  }

  if (report.targetUserId !== null) {
    if (!report.targetUser) {
      return { unavailableReason: "This user profile is no longer available." };
    }

    return { path: `/teacher/${report.targetUser.id}` };
  }

  return { unavailableReason: "This report target type is not supported for navigation." };
};

const adminUserInclude = {
  teacherProfile: {
    select: {
      expertise: true,
      yearsExperience: true,
      location: true,
    },
  },
  lessons: {
    select: {
      id: true,
      status: true,
      updatedAt: true,
      orders: {
        where: {
          status: OrderStatus.PAID,
        },
        select: {
          id: true,
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type AdminUserRecord = Prisma.UserGetPayload<{
  include: typeof adminUserInclude;
}>;

const adminModerationLessonInclude = {
  author: {
    select: {
      fullName: true,
    },
  },
  orders: {
    where: {
      status: OrderStatus.PAID,
    },
    select: {
      id: true,
    },
  },
  reviews: {
    select: {
      rating: true,
    },
  },
} satisfies Prisma.LessonInclude;

type AdminModerationLessonRecord = Prisma.LessonGetPayload<{
  include: typeof adminModerationLessonInclude;
}>;

const buildUserRow = (user: AdminUserRecord): AdminUserRow => {
  const lessonsCount = user.lessons.length;
  const publishedLessons = user.lessons.filter(
    (lesson) => lesson.status === LessonLifecycleStatus.PUBLISHED
  ).length;
  const totalDownloads = user.lessons.reduce(
    (total, lesson) => total + lesson.orders.length,
    0
  );

  const lastLessonUpdatedAt = user.lessons.reduce<string | null>((latest, lesson) => {
    const iso = lesson.updatedAt.toISOString();

    if (!latest) {
      return iso;
    }

    return toTimestamp(iso) > toTimestamp(latest) ? iso : latest;
  }, null);

  const experienceYears = user.teacherProfile?.yearsExperience;
  const experience =
    typeof experienceYears === "number"
      ? experienceYears <= 0
        ? "Less than 1 year"
        : experienceYears === 1
          ? "1 year"
          : `${experienceYears} years`
      : undefined;

  return {
    id: String(user.id),
    name: user.fullName,
    email: user.email,
    role: mapUserRole(user.role),
    status: mapUserStatus(user.status),
    avatar: user.avatarUrl ?? undefined,
    subject: user.teacherProfile?.expertise ?? undefined,
    experience,
    location: user.teacherProfile?.location ?? undefined,
    bio: user.bio ?? undefined,
    language: toLanguage(null),
    createdAt: user.createdAt.toISOString(),
    lessonsCount,
    publishedLessons,
    totalDownloads,
    lastLessonUpdatedAt,
  };
};

const buildLessonModerationRow = (
  lesson: AdminModerationLessonRecord
): AdminLessonModerationRow => {
  const lifecycleStatus = mapLessonStatus(lesson.status);
  const averageRating =
    lesson.reviews.length === 0
      ? 0
      : Number(
          (
            lesson.reviews.reduce((total, review) => total + review.rating, 0) /
            lesson.reviews.length
          ).toFixed(2)
        );

  return {
    id: String(lesson.id),
    authorId: String(lesson.authorId),
    authorName: lesson.author.fullName,
    title: lesson.title,
    subject: lesson.subject ?? "Unknown subject",
    gradeLevel: lesson.gradeLevel ?? "Unknown grade level",
    status: lifecycleStatus,
    moderationStatus: mapModerationStatus(lesson.moderationStatus, lesson.status),
    moderationNote: lesson.moderationNote ?? undefined,
    price: toPositiveNumber(lesson.price),
    downloads: lesson.orders.length,
    rating: averageRating,
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
    moderationUpdatedAt: lesson.moderationUpdatedAt?.toISOString(),
    moderationUpdatedBy: lesson.moderationUpdatedBy ?? undefined,
  };
};

export const getAdminDashboardSnapshot = async (
  query: DashboardSnapshotQueryInput
): Promise<AdminDashboardSnapshot> => {
  const activityLimit = Math.max(1, query.activityLimit ?? 10);

  const [
    totalUsers,
    totalLessons,
    totalCommunityPosts,
    totalReports,
    totalOrders,
    totalTransactions,
    paidOrdersAggregate,
    pendingModerations,
    pendingReports,
    creatorRows,
    recentUsers,
    recentLessons,
    recentPaidOrders,
    recentReports,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.lesson.count(),
    prisma.post.count(),
    prisma.report.count(),
    prisma.order.count(),
    prisma.walletTransaction.count(),
    prisma.order.aggregate({
      where: { status: OrderStatus.PAID },
      _sum: { amount: true },
    }),
    prisma.lesson.count({
      where: { moderationStatus: ModerationStatus.PENDING },
    }),
    prisma.report.count({
      where: { status: ReportStatus.OPEN },
    }),
    prisma.lesson.findMany({
      select: { authorId: true },
      distinct: ["authorId"],
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: activityLimit,
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
      },
    }),
    prisma.lesson.findMany({
      orderBy: { createdAt: "desc" },
      take: activityLimit,
      select: {
        id: true,
        title: true,
        moderationStatus: true,
        status: true,
        moderationNote: true,
        moderationUpdatedAt: true,
        createdAt: true,
      },
    }),
    prisma.order.findMany({
      where: { status: OrderStatus.PAID },
      orderBy: { createdAt: "desc" },
      take: activityLimit,
      select: {
        id: true,
        amount: true,
        createdAt: true,
      },
    }),
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: activityLimit,
      select: {
        id: true,
        category: true,
        createdAt: true,
      },
    }),
  ]);

  const stats: DashboardStats = {
    totalUsers,
    totalCreators: creatorRows.length,
    totalLessons,
    totalCommunityPosts,
    totalReports,
    totalOrders,
    totalTransactions,
    totalRevenue: toPositiveNumber(paidOrdersAggregate._sum.amount),
    pendingModerations,
    pendingReports,
  };

  const epochIso = new Date(0).toISOString();

  const userActivities: AdminRecentActivityItem[] = recentUsers.map((user) => ({
    id: `activity-user-${user.id}`,
    type: "user_joined",
    title: `${user.fullName || "A user"} joined TeacherHub`,
    subtitle: user.email,
    createdAt: toIso(user.createdAt, epochIso),
  }));

  const lessonSubmittedActivities: AdminRecentActivityItem[] = recentLessons.map((lesson) => ({
    id: `activity-lesson-submitted-${lesson.id}`,
    type: "lesson_submitted",
    title: `Lesson submitted: ${lesson.title || "Untitled lesson"}`,
    subtitle: undefined,
    createdAt: toIso(lesson.createdAt, epochIso),
  }));

  const lessonModeratedActivities: AdminRecentActivityItem[] = recentLessons
    .filter((lesson) => lesson.moderationUpdatedAt)
    .map((lesson) => ({
      id: `activity-lesson-moderated-${lesson.id}`,
      type: "lesson_moderated",
      title: `Lesson moderated: ${lesson.title || "Untitled lesson"}`,
      subtitle:
        lesson.moderationNote ??
        `Status: ${mapModerationStatus(lesson.moderationStatus, lesson.status)}`,
      createdAt: toIso(lesson.moderationUpdatedAt, toIso(lesson.createdAt, epochIso)),
    }));

  const orderActivities: AdminRecentActivityItem[] = recentPaidOrders.map((order) => ({
    id: `activity-order-${order.id}`,
    type: "order_paid",
    title: "Order payment completed",
    subtitle: `Amount: ${toPositiveNumber(order.amount)} coins`,
    createdAt: toIso(order.createdAt, epochIso),
  }));

  const reportActivities: AdminRecentActivityItem[] = recentReports.map((report) => ({
    id: `activity-report-${report.id}`,
    type: "report_flagged",
    title: `Report flagged: ${report.category || "Other"}`,
    createdAt: toIso(report.createdAt, epochIso),
  }));

  const recentActivity = [
    ...userActivities,
    ...lessonSubmittedActivities,
    ...lessonModeratedActivities,
    ...orderActivities,
    ...reportActivities,
  ]
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
    .slice(0, activityLimit);

  return {
    stats,
    recentActivity,
  };
};

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const snapshot = await getAdminDashboardSnapshot({ activityLimit: 10 });
  return snapshot.stats;
};

export const listUsersForAdmin = async (
  query: ListAdminUsersQueryInput
): Promise<AdminUserRow[]> => {
  const users = await prisma.user.findMany({
    include: adminUserInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  const rows = users.map(buildUserRow).filter((row) => {
    if (query.role !== "all" && row.role !== query.role) {
      return false;
    }

    if (query.status !== "all" && row.status !== query.status) {
      return false;
    }

    return matchesSearch(query.search, [
      row.name,
      row.email,
      row.role,
      row.status,
      row.subject,
      row.location,
      row.bio,
    ]);
  });

  return rows;
};

export const getUserForAdmin = async (userId: number): Promise<AdminUserRow | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: adminUserInclude,
  });

  if (!user) {
    return null;
  }

  return buildUserRow(user);
};

export const updateUserAsAdmin = async (
  userId: number,
  payload: UpdateAdminUserInput
): Promise<AdminUserRow> => {
  const patch: Prisma.UserUpdateInput = {};

  if (payload.role !== undefined) {
    patch.role = toPrismaUserRole(payload.role);
  }

  if (payload.status !== undefined) {
    patch.status = toPrismaUserStatus(payload.status);
  }

  await prisma.user.update({
    where: { id: userId },
    data: patch,
  });

  const updated = await getUserForAdmin(userId);
  if (!updated) {
    throw new HttpError(404, "User not found");
  }

  return updated;
};

export const listLessonsForModeration = async (
  query: ListLessonsForModerationQueryInput
): Promise<AdminLessonModerationRow[]> => {
  const lessons = await prisma.lesson.findMany({
    include: adminModerationLessonInclude,
    orderBy: {
      updatedAt: "desc",
    },
  });

  const rows = lessons.map(buildLessonModerationRow).filter((row) => {
    if (query.moderationStatus !== "all" && row.moderationStatus !== query.moderationStatus) {
      return false;
    }

    if (query.lifecycleStatus !== "all" && row.status !== query.lifecycleStatus) {
      return false;
    }

    return matchesSearch(query.search, [
      row.title,
      row.authorName,
      row.subject,
      row.gradeLevel,
      row.status,
      row.moderationStatus,
      row.moderationNote,
    ]);
  });

  const moderationWeight: Record<LessonModerationStatusView, number> = {
    pending: 0,
    rejected: 1,
    approved: 2,
  };

  rows.sort((left, right) => {
    if (moderationWeight[left.moderationStatus] !== moderationWeight[right.moderationStatus]) {
      return moderationWeight[left.moderationStatus] - moderationWeight[right.moderationStatus];
    }

    return toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
  });

  return rows;
};

export const getLessonForModeration = async (
  lessonId: number
): Promise<AdminLessonModerationRow | null> => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: adminModerationLessonInclude,
  });

  if (!lesson) {
    return null;
  }

  return buildLessonModerationRow(lesson);
};

export const moderateLessonAsAdmin = async (
  lessonId: number,
  payload: ModerateLessonInput,
  moderatorUserId: number
): Promise<AdminLessonModerationRow> => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      status: true,
      moderationStatus: true,
      moderationNote: true,
    },
  });

  if (!lesson) {
    throw new HttpError(404, "Lesson not found");
  }

  const now = new Date();
  let nextLifecycleStatus: LessonLifecycleStatus = lesson.status;
  let nextModerationStatus: ModerationStatus = lesson.moderationStatus;
  let nextModerationNote = payload.note ?? lesson.moderationNote;

  if (payload.action === "approve") {
    nextLifecycleStatus = LessonLifecycleStatus.PUBLISHED;
    nextModerationStatus = ModerationStatus.APPROVED;
    nextModerationNote = payload.note ?? "Approved by admin moderation.";
  }

  if (payload.action === "reject") {
    nextLifecycleStatus = LessonLifecycleStatus.DRAFT;
    nextModerationStatus = ModerationStatus.REJECTED;
    nextModerationNote = payload.note ?? "Rejected by admin moderation. Requires revision.";
  }

  if (payload.action === "hide") {
    nextLifecycleStatus = LessonLifecycleStatus.ARCHIVED;
    nextModerationStatus = ModerationStatus.APPROVED;
    nextModerationNote = payload.note ?? lesson.moderationNote ?? "Hidden by admin moderation.";
  }

  if (payload.action === "unhide") {
    nextLifecycleStatus = LessonLifecycleStatus.PUBLISHED;
    nextModerationStatus = ModerationStatus.APPROVED;
    nextModerationNote = payload.note ?? lesson.moderationNote ?? "Lesson unhidden by admin moderation.";
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      status: nextLifecycleStatus,
      isPublished: nextLifecycleStatus === LessonLifecycleStatus.PUBLISHED,
      moderationStatus: toPrismaModerationStatus(
        mapModerationStatus(nextModerationStatus, nextLifecycleStatus)
      ),
      moderationNote: nextModerationNote,
      moderationUpdatedAt: now,
      moderationUpdatedBy: String(payload.adminId ?? moderatorUserId),
      updatedAt: now,
    },
  });

  const updated = await getLessonForModeration(lessonId);
  if (!updated) {
    throw new HttpError(404, "Lesson not found");
  }

  return updated;
};

export const listRecentTransactions = async (
  query: ListRecentTransactionsQueryInput
): Promise<WalletTransactionView[]> => {
  const limit = Math.max(1, query.limit ?? 10);

  const transactions = await prisma.walletTransaction.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
    include: {
      wallet: {
        select: {
          userId: true,
        },
      },
    },
  });

  return transactions.map((transaction) => {
    const metadata = parseTransactionMeta(transaction.metadata);

    return {
      id: String(transaction.id),
      userId: String(transaction.wallet.userId),
      date: transaction.createdAt.toISOString(),
      description:
        typeof metadata?.description === "string"
          ? metadata.description
          : `Wallet ${mapWalletTransactionType(transaction.type)}`,
      type: mapWalletTransactionType(transaction.type),
      amount: toPositiveNumber(transaction.amount),
      status: mapWalletTransactionStatus(transaction.status),
      contextTitle:
        typeof metadata?.contextTitle === "string" ? metadata.contextTitle : undefined,
      contextId: typeof metadata?.contextId === "string" ? metadata.contextId : undefined,
      contextType: mapTransactionContextType(metadata?.contextType),
      target: typeof metadata?.target === "string" ? metadata.target : undefined,
      note:
        typeof metadata?.note === "string"
          ? metadata.note
          : transaction.note ?? undefined,
    };
  });
};

export const listCommunityForModeration = async (
  query: ListCommunityModerationQueryInput
): Promise<AdminCommunityModerationItem[]> => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
    },
  });

  const usersById = new Map(users.map((user) => [user.id, user.fullName]));
  const items: AdminCommunityModerationItem[] = [];

  if (query.contentType === "all" || query.contentType === "post") {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        reactions: {
          where: { type: "LIKE" },
          select: { id: true },
        },
        comments: {
          select: { id: true },
        },
      },
    });

    posts.forEach((post) => {
      const preview = post.content.trim().slice(0, 140) || "No content";

      items.push({
        id: String(post.id),
        contentType: "post",
        authorId: String(post.authorId),
        authorName: usersById.get(post.authorId) ?? "Unknown",
        title: post.title ?? undefined,
        preview,
        likes: post.reactions.length,
        commentCount: post.comments.length,
        createdAt: post.createdAt.toISOString(),
      });
    });
  }

  if (query.contentType === "all" || query.contentType === "comment") {
    const comments = await prisma.comment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        post: {
          select: {
            title: true,
          },
        },
      },
    });

    comments.forEach((comment) => {
      items.push({
        id: String(comment.id),
        contentType: "comment",
        authorId: String(comment.authorId),
        authorName: usersById.get(comment.authorId) ?? "Unknown",
        preview: comment.content.trim().slice(0, 200) || "No content",
        postTitle: comment.post?.title ?? undefined,
        likes: 0,
        commentCount: 0,
        createdAt: comment.createdAt.toISOString(),
      });
    });
  }

  const filtered = items
    .filter((item) =>
      matchesSearch(query.search, [
        item.authorName,
        item.title,
        item.preview,
        item.postTitle,
        item.contentType,
      ])
    )
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));

  return filtered;
};

export const removeCommunityContent = async (
  contentId: number,
  contentType: "post" | "comment"
): Promise<void> => {
  if (contentType === "post") {
    await prisma.post.delete({ where: { id: contentId } });
    return;
  }

  await prisma.comment.delete({ where: { id: contentId } });
};

export const listReportsForAdmin = async (
  query: ListAdminReportsQueryInput
): Promise<AdminReportRow[]> => {
  const reports = await prisma.report.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      reporter: {
        select: {
          fullName: true,
        },
      },
      targetPost: {
        select: {
          id: true,
          title: true,
          content: true,
        },
      },
      targetComment: {
        select: {
          id: true,
          postId: true,
          content: true,
        },
      },
      targetLesson: {
        select: {
          id: true,
          title: true,
        },
      },
      targetUser: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  const rows = reports.map((report) => {
    const targetType = getReportTargetType(report);
    const targetId = getReportTargetId(report);
    const target = getReportTargetPath(report);

    return {
      id: String(report.id),
      reporterId: String(report.reporterId),
      reporterName: report.reporter.fullName || "Unknown reporter",
      targetType,
      targetId: String(targetId),
      targetPreview: getReportTargetPreview(report),
      targetPath: target.path,
      targetUnavailableReason: target.unavailableReason,
      reason: report.reason,
      category: report.category,
      adminNote: report.resolutionNote ?? undefined,
      status: mapReportStatus(report.status),
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    } satisfies AdminReportRow;
  });

  const statusWeight: Record<ReportStatusView, number> = {
    pending: 0,
    reviewing: 1,
    resolved: 2,
    dismissed: 3,
  };

  return rows
    .filter((row) => {
      if (query.status !== "all" && row.status !== query.status) {
        return false;
      }

      if (query.targetType !== "all" && row.targetType !== query.targetType) {
        return false;
      }

      return matchesSearch(query.search, [
        row.reporterName,
        row.reason,
        row.category,
        row.targetPreview,
        row.targetType,
        row.status,
        row.adminNote,
      ]);
    })
    .sort((left, right) => {
      if (statusWeight[left.status] !== statusWeight[right.status]) {
        return statusWeight[left.status] - statusWeight[right.status];
      }

      return toTimestamp(right.createdAt) - toTimestamp(left.createdAt);
    });
};

export const updateReportAsAdmin = async (
  reportId: number,
  payload: UpdateAdminReportInput,
  moderatorUserId: number
): Promise<AdminReportRow> => {
  await prisma.report.update({
    where: { id: reportId },
    data: {
      status: toPrismaReportStatus(payload.status),
      resolutionNote: payload.adminNote,
      reviewedById: moderatorUserId,
    },
  });

  const rows = await listReportsForAdmin({
    search: "",
    status: "all",
    targetType: "all",
  });

  const updated = rows.find((row) => row.id === String(reportId));
  if (!updated) {
    throw new HttpError(404, "Report not found");
  }

  return updated;
};

export const listOrdersForAdmin = async (
  query: ListAdminOrdersQueryInput
): Promise<AdminOrderRow[]> => {
  const orders = await prisma.order.findMany({
    include: {
      buyer: {
        select: {
          fullName: true,
        },
      },
      lesson: {
        select: {
          id: true,
          title: true,
          authorId: true,
          author: {
            select: {
              fullName: true,
            },
          },
        },
      },
      payment: {
        select: {
          status: true,
          method: true,
          reference: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const rows = orders.map((order) => {
    const method = order.payment?.method?.trim().toLowerCase();

    const paymentMethod:
      | "bank"
      | "vnpay"
      | "momo"
      | "wallet"
      | "promo"
      | "unknown"
      | undefined =
      method === "bank" ||
      method === "vnpay" ||
      method === "momo" ||
      method === "wallet" ||
      method === "promo" ||
      method === "unknown"
        ? method
        : method
          ? "unknown"
          : undefined;

    const entitlementSource =
      order.entitlementSource === "payment_confirmed" ||
      order.entitlementSource === "free_lesson" ||
      order.entitlementSource === "manual" ||
      order.entitlementSource === "unknown"
        ? order.entitlementSource
        : undefined;

    return {
      id: String(order.id),
      userId: String(order.buyerId),
      buyerName: order.buyer.fullName,
      lessonId: String(order.lessonId),
      lessonTitle: order.lesson.title,
      lessonAuthorId: String(order.lesson.authorId),
      sellerName: order.lesson.author.fullName,
      amount: toPositiveNumber(order.amount),
      status: mapOrderStatus(order.status),
      paymentStatus: mapPaymentStatus(order.payment?.status),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      paidAt: order.paidAt?.toISOString(),
      failedAt: order.failedAt?.toISOString(),
      cancelledAt: order.cancelledAt?.toISOString(),
      entitlementGrantedAt: order.entitlementGrantedAt?.toISOString(),
      entitlementSource,
      paymentMethod,
      paymentRef: order.payment?.reference ?? order.referenceCode ?? undefined,
    } satisfies AdminOrderRow;
  });

  return rows.filter((row) => {
    if (query.status !== "all" && row.status !== query.status) {
      return false;
    }

    return matchesSearch(query.search, [
      row.id,
      row.buyerName,
      row.lessonTitle,
      row.sellerName,
      row.status,
      row.paymentRef,
    ]);
  });
};
