import type { BackendUserRole } from './contract-dto';

export type UserRole = 'guest' | 'user' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'locked';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'vi';

export type LessonSubject =
  | 'Math'
  | 'Science'
  | 'English'
  | 'History'
  | 'Art'
  | 'Literature'
  | 'Technology'
  | 'Biology'
  | 'Earth Science'
  | 'STEM';

export type GradeLevel =
  | 'Elementary'
  | 'Middle School'
  | 'High School'
  | 'Grade 3'
  | 'Grade 4'
  | 'Grade 6-8'
  | 'Grade 7-8'
  | '9th Grade';

export type FileFormat = 'PDF' | 'Word' | 'PPT' | 'Video' | 'ZIP';
export type LessonStatus = 'draft' | 'published' | 'hidden';
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled';
export type PaymentStatus = 'success' | 'failed' | 'pending' | 'cancelled';
export type TopUpPaymentMethod = 'bank' | 'vnpay' | 'momo';
export type LessonModerationStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  /**
   * Simplified UI authorization vocabulary used by guards/redirects.
   * This is a projection from backend domain roles, not a backend-role source-of-truth.
   */
  role: UserRole;
  /**
   * Raw backend role (`TEACHER` / `STUDENT` / `ADMIN`) when known.
   * Preserved so backend role meaning remains explicit at the contract boundary.
   */
  backendRole?: BackendUserRole;
  status: UserStatus;
  avatar?: string;
  subject?: string;
  experience?: string;
  location?: string;
  bio?: string;
  language: Language;
  createdAt: string;
}

export interface AuthSession {
  /** Primary access token (JWT or opaque). */
  token: string;
  /** Authenticated user snapshot (password excluded). */
  user: Omit<User, 'password'>;
  /** ISO timestamp when the access token expires. Undefined in mock mode. */
  expiresAt?: string;
  /** Opaque refresh token for silent session renewal. Undefined in mock mode. */
  refreshToken?: string;
}

/* Auth request contracts (backend-ready, mock-agnostic). */
export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ProviderLoginPayload {
  provider: AuthProvider;
  /** Optional OAuth authorization code for real backend callback exchange. */
  oauthCode?: string;
  /** Optional provider-issued ID token for backend validation. */
  idToken?: string;
  /** Optional redirect URI used in OAuth callback validation. */
  redirectUri?: string;
  /** Optional anti-CSRF state returned by OAuth providers. */
  state?: string;
}

export interface LessonAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeMb: number;
  format: FileFormat;
  source: 'local' | 'remote';
  storageKey?: string;
  uploadToken?: string;
  checksum?: string;
  url?: string;
  uploadedAt: string;
}

export interface LessonAttachmentPayload {
  id?: string;
  fileName: string;
  mimeType?: string;
  sizeMb?: number;
  format?: FileFormat;
  source?: 'local' | 'remote';
  storageKey?: string;
  uploadToken?: string;
  checksum?: string;
  url?: string;
  uploadedAt?: string;
}

export interface Lesson {
  id: string;
  authorId: string;
  title: string;
  description: string;
  subject: LessonSubject;
  gradeLevel: GradeLevel;
  format: FileFormat;
  downloads: number;
  rating: number;
  reviewCount: number;
  thumbnail: string;
  price: number;
  duration?: string;
  estimatedMinutes?: number;
  language?: Language;
  fileSize?: string;
  attachmentSummary?: string;
  attachments?: LessonAttachment[];
  pedagogicalGoals?: string;
  keyLearnings?: string[];
  status: LessonStatus;
  versionLabel?: string;
  updateNotes?: string;
  previewMediaUrl?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  moderationStatus?: LessonModerationStatus;
  moderationNote?: string;
  moderationUpdatedAt?: string;
  moderationUpdatedBy?: string;
}

export interface LessonReview {
  id: string;
  lessonId: string;
  authorId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export type LessonAccessState = 'owner' | 'purchased' | 'free_unlocked' | 'locked';

export type LessonReviewEligibilityReason =
  | 'owner'
  | 'verified_buyer'
  | 'free_lesson'
  | 'purchase_required'
  | 'login_required';

export interface LessonReviewPermission {
  canSubmit: boolean;
  reason: LessonReviewEligibilityReason;
  message: string;
}

export interface LessonReviewView extends LessonReview {
  isVerifiedBuyer: boolean;
}

export interface LessonCommerceSnapshot {
  lesson: Lesson;
  accessState: LessonAccessState;
  canDownload: boolean;
  canPurchase: boolean;
  isOwnLesson: boolean;
  hasPurchased: boolean;
  isFreeLesson: boolean;
  reviewPermission: LessonReviewPermission;
}

export interface LessonDetailSnapshot extends LessonCommerceSnapshot {
  reviews: LessonReviewView[];
}

export type LessonPriceFilter =
  | 'all'
  | 'free'
  | 'paid'
  | 'under_100'
  | 'between_100_200'
  | 'above_200';

export interface LessonFilters {
  search?: string;
  subject?: LessonSubject | 'All';
  gradeLevel?: GradeLevel | 'All';
  priceType?: LessonPriceFilter;
  tags?: string[];
  minimumRating?: number;
  sortBy?: 'popular' | 'newest' | 'rating' | 'price_asc' | 'price_desc';
  page?: number;
  pageSize?: number;
  onlyPublished?: boolean;
}

export interface LessonFilterMetadata {
  subjects: LessonSubject[];
  gradeLevels: GradeLevel[];
  tags: string[];
  ratingOptions: number[];
}

export interface CommunityPost {
  id: string;
  authorId: string;
  title: string;
  excerpt: string;
  content: string;
  image?: string;
  category: string;
  tags: string[];
  likes: number;
  likedBy: string[];
  savedBy: string[];
  createdAt: string;
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  parentId?: string;
  createdAt: string;
}

export type AppNotificationType = 'system' | 'follow' | 'community' | 'order';

export interface AppNotification {
  id: string;
  userId: string;
  type: AppNotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  read: boolean;
  createdAt: string;
  readAt?: string;
  actorUserId?: string;
  entityType?: 'order' | 'lesson' | 'post' | 'comment' | 'user' | 'system';
  entityId?: string;
}

export interface UserFollowRelation {
  followerId: string;
  followingId: string;
  createdAt: string;
  source?: 'manual' | 'suggestion' | 'imported';
}

export interface LessonFavorite {
  userId: string;
  lessonId: string;
  createdAt: string;
  source?: 'lesson_detail' | 'library' | 'teacher_profile' | 'unknown';
}

export interface Wallet {
  userId: string;
  balance: number;
}

export type WalletTransactionType =
  | 'sale'
  | 'withdrawal'
  | 'purchase'
  | 'bonus'
  | 'topup'
  | 'refund';

export type WalletTransactionStatus =
  | 'completed'
  | 'pending'
  | 'failed'
  | 'cancelled';

export interface WalletTransaction {
  id: string;
  userId: string;
  date: string;
  description: string;
  type: WalletTransactionType;
  amount: number;
  status: WalletTransactionStatus;
  contextTitle?: string;
  contextId?: string;
  contextType?: 'lesson' | 'order' | 'wallet' | 'system';
  target?: string;
  note?: string;
}

export type WithdrawPayoutTargetType = 'bank' | 'momo' | 'paypal';

export interface LinkedPayoutAccount {
  id: string;
  userId: string;
  targetType: WithdrawPayoutTargetType;
  providerName: string;
  accountIdentifier: string;
  accountOwnerName: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedPayoutAccountInput {
  targetType: WithdrawPayoutTargetType;
  providerName?: string;
  accountIdentifier: string;
  accountOwnerName?: string;
  setAsDefault?: boolean;
}

export interface WithdrawPayoutAccountInput {
  targetType: WithdrawPayoutTargetType;
  providerName: string;
  accountIdentifier: string;
  verifiedAccountOwnerName?: string;
  verificationStatus?: 'success' | 'error' | 'pending';
  linkedAccountId?: string;
  source?: 'linked' | 'manual';
}

export interface PayoutAccountVerificationInput {
  targetType: WithdrawPayoutTargetType;
  providerName?: string;
  accountIdentifier: string;
}

export interface PayoutAccountVerificationResult {
  status: 'success' | 'error';
  ownerName?: string;
  message: string;
  verifiedAt: string;
}

export interface WithdrawRequestInput {
  amount: number;
  payout: WithdrawPayoutAccountInput;
  note?: string;
}

export interface TopUpRequestInput {
  amountVnd: number;
  paymentMethod: TopUpPaymentMethod;
  note?: string;
}

export interface TopUpConversionPreview {
  amountVnd: number;
  conversionRateLabel: string;
  coins: number;
}

export interface TopUpPaymentSnapshot {
  status: 'success' | 'failed' | 'pending';
  message: string;
  amountVnd: number;
  coins: number;
  paymentMethod: TopUpPaymentMethod;
  paymentRef: string;
  transaction: WalletTransaction;
}
export type PaymentResultAccessState = 'unlocked' | 'locked' | 'processing';

export interface PaymentResultSnapshot {
  order: Order;
  lesson: Lesson | null;
  status: 'paid' | 'failed' | 'pending' | 'cancelled';
  orderStatus: OrderStatus;
  accessState: PaymentResultAccessState;
  paymentRef: string;
  message: string;
  statusHint: string;
  canRetry: boolean;
  nextActionLabel: string;
  processedAt: string;
}

export interface Order {
  id: string;
  userId: string;
  lessonId: string;
  lessonAuthorId: string;
  amount: number;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  createdAt: string;
  updatedAt?: string;
  paidAt?: string;
  cancelledAt?: string;
  failedAt?: string;
  paymentRef?: string;
  paymentMethod?: TopUpPaymentMethod | 'wallet' | 'promo' | 'unknown';
  entitlementGrantedAt?: string;
  entitlementSource?: 'payment_confirmed' | 'free_lesson' | 'manual' | 'unknown';
}

export interface TeacherPublicProfile {
  id: string;
  name: string;
  avatar?: string;
  subject?: string;
  experience?: string;
  location?: string;
  bio?: string;
  stats: {
    sharedLessons: number;
    totalDownloads: number;
    averageRating: number;
    followers: number;
    following: number;
  };
}

export interface AppSettings {
  theme: ThemeMode;
  language: Language;
}

export interface MarketplaceOverview {
  featured: Lesson[];
  popular: Lesson[];
  recommended: Lesson[];
  latest: Lesson[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
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

export interface AdminUserFilters {
  search: string;
  role: UserRole | 'all';
  status: UserStatus | 'all';
}

export interface AdminLessonModerationFilters {
  search: string;
  moderationStatus: LessonModerationStatus | 'all';
  lifecycleStatus: LessonStatus | 'all';
}

export interface AdminRecentActivityItem {
  id: string;
  type: 'user_joined' | 'lesson_submitted' | 'lesson_moderated' | 'order_paid' | 'report_flagged';
  title: string;
  subtitle?: string;
  createdAt: string;
}

export interface AdminDashboardSnapshot {
  stats: DashboardStats;
  recentActivity: AdminRecentActivityItem[];
}

/* ------------------------------------------------------------------ */
/*  Batch 2 Admin Types                                                */
/* ------------------------------------------------------------------ */

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';
export type ReportTargetType = 'post' | 'comment' | 'lesson' | 'user';

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  category: string;
  adminNote?: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCommunityModerationFilters {
  search: string;
  contentType: 'all' | 'post' | 'comment';
}

export interface AdminReportFilters {
  search: string;
  status: ReportStatus | 'all';
  targetType: ReportTargetType | 'all';
}

export interface AdminOrderFilters {
  search: string;
  status: OrderStatus | 'all';
}

export interface AdminOrderRow {
  id: string;
  userId: string;
  buyerName: string;
  lessonId: string;
  lessonTitle: string;
  lessonAuthorId: string;
  sellerName: string;
  amount: number;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  createdAt: string;
  updatedAt?: string;
  paidAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  entitlementGrantedAt?: string;
  entitlementSource?: Order['entitlementSource'];
  paymentMethod?: Order['paymentMethod'];
  paymentRef?: string;
}

export interface AdminCommunityModerationItem {
  id: string;
  contentType: 'post' | 'comment';
  authorId: string;
  authorName: string;
  title?: string;
  preview: string;
  postTitle?: string;
  likes: number;
  commentCount: number;
  createdAt: string;
}

export interface AdminReportRow {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: ReportTargetType;
  targetId: string;
  targetPreview: string;
  targetPath?: string;
  targetUnavailableReason?: string;
  reason: string;
  category: string;
  adminNote?: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  API Response + Envelope Contracts                                   */
/* ------------------------------------------------------------------ */

/** Standard API success response envelope for backend readiness. */
export interface ApiResponse<T> {
  data: T;
  meta?: ApiResponseMeta;
}

/** Standard API list/paginated response envelope. */
export interface ApiListResponse<T> {
  data: T[];
  meta: ApiPaginationMeta;
}

/** Shared meta properties attached to API responses. */
export interface ApiResponseMeta {
  requestId?: string;
  timestamp?: string;
}

/** Pagination metadata included in list responses. */
export interface ApiPaginationMeta extends ApiResponseMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Normalized API error shape. */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
  meta?: ApiResponseMeta;
}

/* ------------------------------------------------------------------ */
/*  Centralized Enum Constants (stable allow-lists for normalizers)     */
/* ------------------------------------------------------------------ */

export const USER_ROLES = ['guest', 'user', 'admin'] as const satisfies readonly UserRole[];

export const USER_STATUSES = ['active', 'suspended', 'locked'] as const satisfies readonly UserStatus[];

export const LESSON_STATUSES = ['draft', 'published', 'hidden'] as const satisfies readonly LessonStatus[];

export const LESSON_MODERATION_STATUSES = [
  'pending',
  'approved',
  'rejected',
] as const satisfies readonly LessonModerationStatus[];

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'failed',
  'cancelled',
] as const satisfies readonly OrderStatus[];

export const PAYMENT_STATUSES = [
  'success',
  'failed',
  'pending',
  'cancelled',
] as const satisfies readonly PaymentStatus[];

export const WALLET_TRANSACTION_TYPES = [
  'sale',
  'withdrawal',
  'purchase',
  'bonus',
  'topup',
  'refund',
] as const satisfies readonly WalletTransactionType[];

export const WALLET_TRANSACTION_STATUSES = [
  'completed',
  'pending',
  'failed',
  'cancelled',
] as const satisfies readonly WalletTransactionStatus[];

export const REPORT_STATUSES = [
  'pending',
  'reviewing',
  'resolved',
  'dismissed',
] as const satisfies readonly ReportStatus[];

export const REPORT_TARGET_TYPES = [
  'post',
  'comment',
  'lesson',
  'user',
] as const satisfies readonly ReportTargetType[];

export const NOTIFICATION_TYPES = [
  'system',
  'follow',
  'community',
  'order',
] as const satisfies readonly AppNotificationType[];

export const THEME_MODES = ['light', 'dark', 'system'] as const satisfies readonly ThemeMode[];

export const LANGUAGES = ['en', 'vi'] as const satisfies readonly Language[];

export const AUTH_PROVIDERS = ['google', 'apple'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const WALLET_CONTEXT_TYPES = [
  'lesson',
  'order',
  'wallet',
  'system',
] as const;
export type WalletContextType = (typeof WALLET_CONTEXT_TYPES)[number];

export const TOP_UP_PAYMENT_METHODS = [
  'bank',
  'vnpay',
  'momo',
] as const satisfies readonly TopUpPaymentMethod[];

export const WITHDRAW_TARGET_TYPES = [
  'bank',
  'momo',
  'paypal',
] as const satisfies readonly WithdrawPayoutTargetType[];
