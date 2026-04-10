import {
  DEFAULT_PAGE_SIZE,
  FILE_TYPES,
  GRADE_LEVELS,
  MAX_UPLOAD_FILE_MB,
  SUBJECTS,
} from '../app/config/constants';
import { LessonReviewPayload, UpsertLessonPayload } from '../mock/contracts';
import { getDatabase, updateDatabase, withLatency } from '../mock/server/database';
import {
  FileFormat,
  GradeLevel,
  Language,
  Lesson,
  LessonAccessState,
  LessonAttachment,
  LessonDetailSnapshot,
  LessonFilterMetadata,
  LessonFilters,
  LessonReview,
  LessonReviewPermission,
  LessonReviewView,
  LessonStatus,
  LessonSubject,
  MarketplaceOverview,
  PaginatedResult,
} from '../types';
import { generateId } from '../utils/id';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const lessonStatuses: LessonStatus[] = ['draft', 'published', 'hidden'];
const lessonSubjects: LessonSubject[] = SUBJECTS;
const lessonGradeLevels: GradeLevel[] = GRADE_LEVELS;
const lessonFormats: FileFormat[] = FILE_TYPES;
const lessonLanguages: Language[] = ['en', 'vi'];
const MAX_LESSON_PRICE = 50_000;
const MAX_ESTIMATED_MINUTES = 600;
const fileFormatExtensions: Record<FileFormat, string> = {
  PDF: 'pdf',
  Word: 'docx',
  PPT: 'pptx',
  Video: 'mp4',
  ZIP: 'zip',
};
const defaultMimeByFormat: Record<FileFormat, string> = {
  PDF: 'application/pdf',
  Word: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  PPT: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  Video: 'video/mp4',
  ZIP: 'application/zip',
};

const normalize = (value?: string): string => (value ?? '').trim().toLowerCase();

const toTimestamp = (value: string): number => {
  const date = new Date(value).getTime();
  return Number.isNaN(date) ? 0 : date;
};

const toNonNegativeInteger = (value: number, fallback = 0): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
};

const toSafePrice = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
};

const toSafeRating = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(5, Number(value.toFixed(1))));
};

const toSafeDate = (value: string, fallback: string): string => {
  const timestamp = toTimestamp(value);
  return timestamp > 0 ? value : fallback;
};

const toSafeEnumValue = <T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: T,
): T => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalizedValue = value.trim() as T;
  return allowedValues.includes(normalizedValue) ? normalizedValue : fallback;
};

const toSafeEstimatedMinutes = (value: unknown): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.min(MAX_ESTIMATED_MINUTES, Math.floor(parsed));
};

const sanitizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
};

const toSafeFileSize = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replaceAll(' ', '');
  if (!normalized) {
    return undefined;
  }

  const numericPart = normalized.endsWith('mb') ? normalized.slice(0, -2) : normalized;
  const sizeMb = Number(numericPart);
  if (!Number.isFinite(sizeMb) || sizeMb <= 0 || sizeMb > MAX_UPLOAD_FILE_MB) {
    return undefined;
  }

  return `${Number(sizeMb.toFixed(2))}MB`;
};

const isValidHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const toSafeOptionalHttpUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return isValidHttpUrl(trimmed) ? trimmed : undefined;
};

const toSafeThumbnail = (lesson: Lesson): string => {
  const candidate = lesson.thumbnail?.trim();
  if (candidate) {
    return candidate;
  }

  return `https://picsum.photos/seed/${encodeURIComponent(lesson.id || 'teacherhub')}/640/420`;
};

const toSafeStatus = (status: LessonStatus): LessonStatus =>
  lessonStatuses.includes(status) ? status : 'draft';

type UpsertAttachmentInput = NonNullable<UpsertLessonPayload['attachments']>[number];

interface NormalizedUpsertLessonPayload {
  title: string;
  description: string;
  subject: LessonSubject;
  gradeLevel: GradeLevel;
  format: FileFormat;
  price: number;
  status: LessonStatus;
  tags: string[];
  keyLearnings: string[];
  language: Language;
  estimatedMinutes?: number;
  duration?: string;
  fileSize: string;
  attachmentSummary: string;
  attachments: LessonAttachment[];
  pedagogicalGoals?: string;
  versionLabel?: string;
  updateNotes?: string;
  previewMediaUrl?: string;
  thumbnail?: string;
}

const toSafeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
};

const toSafeAttachmentFileName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim().replace(/[\\/:*?"<>|]+/g, ' ');
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, 160);
};

const toSafeAttachmentMimeType = (value: unknown, format: FileFormat): string => {
  if (typeof value !== 'string') {
    return defaultMimeByFormat[format];
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('/')) {
    return defaultMimeByFormat[format];
  }

  return trimmed.slice(0, 120);
};

const toSafeAttachmentSizeMb = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0 || value > MAX_UPLOAD_FILE_MB) {
      return undefined;
    }

    return Number(value.toFixed(2));
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replaceAll(' ', '');
  if (!normalized) {
    return undefined;
  }

  const numericPart = normalized.endsWith('mb') ? normalized.slice(0, -2) : normalized;
  const parsed = Number(numericPart);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_UPLOAD_FILE_MB) {
    return undefined;
  }

  return Number(parsed.toFixed(2));
};

const toSafeAttachmentSource = (
  value: unknown,
  normalizedUrl: string | undefined,
): 'local' | 'remote' => {
  if (value === 'local' || value === 'remote') {
    return value;
  }

  return normalizedUrl ? 'remote' : 'local';
};

const toFallbackAttachmentFileName = (
  attachmentSummary: string,
  format: FileFormat,
): string => {
  const fallbackBase =
    attachmentSummary
      .trim()
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'lesson-resource';

  if (/\.[a-z0-9]{2,5}$/i.test(fallbackBase)) {
    return fallbackBase;
  }

  return `${fallbackBase}.${fileFormatExtensions[format]}`;
};

const normalizeUpsertAttachments = (
  attachments: UpsertLessonPayload['attachments'],
  fallbackFormat: FileFormat,
  fallbackFileSize: string,
  fallbackAttachmentSummary: string,
): LessonAttachment[] => {
  const fallbackSizeMb = toSafeAttachmentSizeMb(fallbackFileSize);
  const fallbackUploadedAt = new Date().toISOString();

  const normalized = (Array.isArray(attachments) ? attachments : [])
    .map((attachment): LessonAttachment | null => {
      if (!attachment || typeof attachment !== 'object') {
        return null;
      }

      const typedAttachment = attachment as UpsertAttachmentInput;
      const format = toSafeEnumValue(typedAttachment.format, lessonFormats, fallbackFormat);
      const normalizedUrl = toSafeOptionalHttpUrl(typedAttachment.url);
      const fileName = toSafeAttachmentFileName(typedAttachment.fileName);
      const sizeMb =
        toSafeAttachmentSizeMb(typedAttachment.sizeMb) ?? fallbackSizeMb;

      if (!fileName || !sizeMb) {
        return null;
      }

      const id =
        typeof typedAttachment.id === 'string' && typedAttachment.id.trim()
          ? typedAttachment.id.trim()
          : generateId('attachment');

      return {
        id,
        fileName,
        mimeType: toSafeAttachmentMimeType(typedAttachment.mimeType, format),
        sizeMb,
        format,
        source: toSafeAttachmentSource(typedAttachment.source, normalizedUrl),
        storageKey: toSafeOptionalString(typedAttachment.storageKey),
        uploadToken: toSafeOptionalString(typedAttachment.uploadToken),
        checksum: toSafeOptionalString(typedAttachment.checksum),
        url: normalizedUrl,
        uploadedAt: toSafeDate(typedAttachment.uploadedAt || '', fallbackUploadedAt),
      };
    })
    .filter((attachment): attachment is LessonAttachment => Boolean(attachment));

  if (normalized.length > 0) {
    return normalized;
  }

  if (!fallbackSizeMb) {
    return [];
  }

  return [
    {
      id: generateId('attachment'),
      fileName: toFallbackAttachmentFileName(fallbackAttachmentSummary, fallbackFormat),
      mimeType: defaultMimeByFormat[fallbackFormat],
      sizeMb: fallbackSizeMb,
      format: fallbackFormat,
      source: 'local',
      uploadedAt: fallbackUploadedAt,
    },
  ];
};

const sanitizePersistedAttachments = (
  lesson: Lesson,
  fallbackFormat: FileFormat,
  fallbackFileSize: string | undefined,
  fallbackAttachmentSummary: string | undefined,
  fallbackUploadedAt: string,
): LessonAttachment[] => {
  const fallbackSizeMb = toSafeAttachmentSizeMb(fallbackFileSize);

  const normalized = (Array.isArray(lesson.attachments) ? lesson.attachments : [])
    .map((attachment, index): LessonAttachment | null => {
      const format = toSafeEnumValue(attachment.format, lessonFormats, fallbackFormat);
      const normalizedUrl = toSafeOptionalHttpUrl(attachment.url);
      const fileName =
        toSafeAttachmentFileName(attachment.fileName) ??
        toFallbackAttachmentFileName(
          fallbackAttachmentSummary || `lesson-resource-${index + 1}`,
          format,
        );
      const sizeMb = toSafeAttachmentSizeMb(attachment.sizeMb) ?? fallbackSizeMb;

      if (!sizeMb) {
        return null;
      }

      const id =
        typeof attachment.id === 'string' && attachment.id.trim()
          ? attachment.id.trim()
          : `${lesson.id || 'lesson'}-attachment-${index + 1}`;

      return {
        id,
        fileName,
        mimeType: toSafeAttachmentMimeType(attachment.mimeType, format),
        sizeMb,
        format,
        source: toSafeAttachmentSource(attachment.source, normalizedUrl),
        storageKey: toSafeOptionalString(attachment.storageKey),
        uploadToken: toSafeOptionalString(attachment.uploadToken),
        checksum: toSafeOptionalString(attachment.checksum),
        url: normalizedUrl,
        uploadedAt: toSafeDate(attachment.uploadedAt || '', fallbackUploadedAt),
      };
    })
    .filter((attachment): attachment is LessonAttachment => Boolean(attachment));

  if (normalized.length > 0) {
    return normalized;
  }

  if (!fallbackSizeMb) {
    return [];
  }

  return [
    {
      id: `${lesson.id || 'lesson'}-attachment-1`,
      fileName: toFallbackAttachmentFileName(
        fallbackAttachmentSummary || 'lesson-resource',
        fallbackFormat,
      ),
      mimeType: defaultMimeByFormat[fallbackFormat],
      sizeMb: fallbackSizeMb,
      format: fallbackFormat,
      source: 'local',
      uploadedAt: fallbackUploadedAt,
    },
  ];
};

const normalizeUpsertLessonPayload = (
  payload: UpsertLessonPayload,
): NormalizedUpsertLessonPayload => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid lesson payload. Please try again.');
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  if (!title) {
    throw new Error('Lesson title is required');
  }

  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  if (!description) {
    throw new Error('Lesson description is required');
  }

  const normalizedPrice = toSafePrice(Number(payload.price));
  if (normalizedPrice > MAX_LESSON_PRICE) {
    throw new Error(`Lesson price must be ${MAX_LESSON_PRICE} coins or less`);
  }

  const subject = toSafeEnumValue(payload.subject, lessonSubjects, SUBJECTS[0]);
  const gradeLevel = toSafeEnumValue(payload.gradeLevel, lessonGradeLevels, GRADE_LEVELS[0]);
  const format = toSafeEnumValue(payload.format, lessonFormats, FILE_TYPES[0]);
  const language = toSafeEnumValue(payload.language, lessonLanguages, 'en');
  const status = toSafeStatus(payload.status);

  const tags = sanitizeStringList(payload.tags);
  const normalizedTags = tags.length > 0 ? tags : [normalize(subject) || 'general'];
  const keyLearnings = sanitizeStringList(payload.keyLearnings);

  const fileSize = toSafeFileSize(payload.fileSize);
  if (!fileSize) {
    throw new Error(`File size metadata is required and must be ${MAX_UPLOAD_FILE_MB}MB or less`);
  }

  const attachmentSummary =
    typeof payload.attachmentSummary === 'string' ? payload.attachmentSummary.trim() : '';
  if (!attachmentSummary) {
    throw new Error('Attachment summary is required');
  }

  const attachments = normalizeUpsertAttachments(
    payload.attachments,
    format,
    fileSize,
    attachmentSummary,
  );
  if (attachments.length === 0) {
    throw new Error('At least one attachment metadata entry is required.');
  }

  const duration = typeof payload.duration === 'string' ? payload.duration.trim() : '';
  const pedagogicalGoals =
    typeof payload.pedagogicalGoals === 'string'
      ? payload.pedagogicalGoals.trim()
      : '';
  const versionLabel =
    typeof payload.versionLabel === 'string' ? payload.versionLabel.trim() : '';
  const updateNotes =
    typeof payload.updateNotes === 'string' ? payload.updateNotes.trim() : '';
  const thumbnail = typeof payload.thumbnail === 'string' ? payload.thumbnail.trim() : '';

  return {
    title,
    description,
    subject,
    gradeLevel,
    format,
    price: normalizedPrice,
    status,
    tags: normalizedTags,
    keyLearnings,
    language,
    estimatedMinutes: toSafeEstimatedMinutes(payload.estimatedMinutes),
    duration: duration || undefined,
    fileSize,
    attachmentSummary,
    attachments,
    pedagogicalGoals: pedagogicalGoals || undefined,
    versionLabel: versionLabel || undefined,
    updateNotes: updateNotes || undefined,
    previewMediaUrl: toSafeOptionalHttpUrl(payload.previewMediaUrl),
    thumbnail: thumbnail || undefined,
  };
};

const sanitizeLesson = (lesson: Lesson): Lesson => {
  const fallbackDate = new Date().toISOString();
  const createdAt = toSafeDate(lesson.createdAt, fallbackDate);
  const updatedAt = toSafeDate(lesson.updatedAt, createdAt);
  const format = toSafeEnumValue(lesson.format, lessonFormats, FILE_TYPES[0]);
  const fileSize = toSafeFileSize(lesson.fileSize);
  const attachmentSummary =
    typeof lesson.attachmentSummary === 'string'
      ? lesson.attachmentSummary.trim() || undefined
      : undefined;

  const attachments = sanitizePersistedAttachments(
    lesson,
    format,
    fileSize,
    attachmentSummary,
    createdAt,
  );

  return {
    ...lesson,
    status: toSafeStatus(lesson.status),
    subject: toSafeEnumValue(lesson.subject, lessonSubjects, SUBJECTS[0]),
    gradeLevel: toSafeEnumValue(lesson.gradeLevel, lessonGradeLevels, GRADE_LEVELS[0]),
    format,
    language: toSafeEnumValue(lesson.language, lessonLanguages, 'en'),
    title: lesson.title?.trim() || 'Untitled lesson',
    description:
      lesson.description?.trim() ||
      'No description provided yet. This lesson will be updated with detailed classroom guidance soon.',
    thumbnail: toSafeThumbnail(lesson),
    rating: toSafeRating(lesson.rating),
    reviewCount: toNonNegativeInteger(lesson.reviewCount),
    downloads: toNonNegativeInteger(lesson.downloads),
    price: toSafePrice(lesson.price),
    duration: typeof lesson.duration === 'string' ? lesson.duration.trim() || undefined : undefined,
    estimatedMinutes: toSafeEstimatedMinutes(lesson.estimatedMinutes),
    fileSize,
    attachmentSummary,
    attachments: attachments.length > 0 ? attachments : undefined,
    pedagogicalGoals:
      typeof lesson.pedagogicalGoals === 'string'
        ? lesson.pedagogicalGoals.trim() || undefined
        : undefined,
    versionLabel:
      typeof lesson.versionLabel === 'string' ? lesson.versionLabel.trim() || undefined : undefined,
    updateNotes:
      typeof lesson.updateNotes === 'string' ? lesson.updateNotes.trim() || undefined : undefined,
    previewMediaUrl: toSafeOptionalHttpUrl(lesson.previewMediaUrl),
    tags: Array.isArray(lesson.tags)
      ? lesson.tags.map((tag) => tag.trim()).filter(Boolean)
      : [],
    keyLearnings: Array.isArray(lesson.keyLearnings)
      ? lesson.keyLearnings.map((item) => item.trim()).filter(Boolean)
      : [],
    createdAt,
    updatedAt,
  };
};

const sanitizeLessons = (lessons: Lesson[]): Lesson[] => lessons.map(sanitizeLesson);

const sanitizeReview = (review: LessonReview): LessonReview => {
  const fallbackDate = new Date().toISOString();

  return {
    ...review,
    rating: toSafeRating(review.rating),
    comment: review.comment?.trim() || 'No written feedback provided.',
    createdAt: toSafeDate(review.createdAt, fallbackDate),
  };
};

const sanitizeReviews = (reviews: LessonReview[]): LessonReview[] => reviews.map(sanitizeReview);

interface LessonEntitlementState {
  accessState: LessonAccessState;
  canDownload: boolean;
  canPurchase: boolean;
  isOwnLesson: boolean;
  hasPurchased: boolean;
  isFreeLesson: boolean;
}

const resolveEntitlementState = (
  lesson: Lesson,
  viewerId: string | undefined,
  hasPaidOrder: boolean,
): LessonEntitlementState => {
  const isOwnLesson = Boolean(viewerId && viewerId === lesson.authorId);
  const isFreeLesson = lesson.price <= 0;

  const accessState: LessonAccessState = isOwnLesson
    ? 'owner'
    : hasPaidOrder
      ? 'purchased'
      : isFreeLesson && Boolean(viewerId)
        ? 'free_unlocked'
        : 'locked';

  return {
    accessState,
    canDownload: accessState !== 'locked',
    canPurchase: accessState === 'locked',
    isOwnLesson,
    hasPurchased: accessState !== 'locked',
    isFreeLesson,
  };
};

const resolveReviewPermission = (
  entitlement: LessonEntitlementState,
  viewerId?: string,
): LessonReviewPermission => {
  if (!viewerId) {
    return {
      canSubmit: false,
      reason: 'login_required',
      message: 'Please log in to submit a lesson review.',
    };
  }

  if (entitlement.isOwnLesson) {
    return {
      canSubmit: true,
      reason: 'owner',
      message: 'As the lesson author, you can leave an official update review.',
    };
  }

  if (entitlement.accessState === 'purchased') {
    return {
      canSubmit: true,
      reason: 'verified_buyer',
      message: 'Thanks for purchasing this lesson. Your review will be marked as verified.',
    };
  }

  if (entitlement.accessState === 'free_unlocked') {
    return {
      canSubmit: true,
      reason: 'free_lesson',
      message: 'You can review this free lesson after unlocking access.',
    };
  }

  return {
    canSubmit: false,
    reason: 'purchase_required',
    message: 'Purchase or unlock this lesson before submitting a review.',
  };
};

const paginate = <T>(
  source: T[],
  page: number,
  pageSize: number,
): PaginatedResult<T> => {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize =
    Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : DEFAULT_PAGE_SIZE;

  const total = source.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safePageSize;
  const end = start + safePageSize;

  return {
    data: source.slice(start, end),
    total,
    page: currentPage,
    pageSize: safePageSize,
    totalPages,
  };
};

const calculatePopularityScore = (lesson: Lesson): number => {
  return lesson.downloads * 1.2 + lesson.reviewCount * 12 + lesson.rating * 35;
};

interface RecommendationContext {
  preferredSubjects: Set<string>;
  preferredTags: Set<string>;
  followedAuthorIds: Set<string>;
}

const buildRecommendationContext = (viewerId?: string): RecommendationContext => {
  if (!viewerId) {
    return {
      preferredSubjects: new Set(),
      preferredTags: new Set(),
      followedAuthorIds: new Set(),
    };
  }

  const database = getDatabase();
  const currentUser = database.users.find((item) => item.id === viewerId);
  const preferredSubjects = new Set<string>();
  if (currentUser?.subject) {
    preferredSubjects.add(currentUser.subject);
  }

  const followedAuthorIds = new Set<string>(
    database.follows
      .filter((relation) => relation.followerId === viewerId)
      .map((relation) => relation.followingId),
  );

  const favoriteLessonIds = new Set<string>(
    database.lessonFavorites
      .filter((favorite) => favorite.userId === viewerId)
      .map((favorite) => favorite.lessonId),
  );

  const preferredTags = new Set<string>();
  sanitizeLessons(database.lessons)
    .filter((lesson) => favoriteLessonIds.has(lesson.id))
    .forEach((lesson) => {
      lesson.tags.forEach((tag) => preferredTags.add(normalize(tag)));
      preferredSubjects.add(lesson.subject);
    });

  return {
    preferredSubjects,
    preferredTags,
    followedAuthorIds,
  };
};

const calculateRecommendationScore = (
  lesson: Lesson,
  context: RecommendationContext,
): number => {
  let score = calculatePopularityScore(lesson);

  if (context.preferredSubjects.has(lesson.subject)) {
    score += 180;
  }

  if (context.followedAuthorIds.has(lesson.authorId)) {
    score += 140;
  }

  const tagMatches = lesson.tags.filter((tag) =>
    context.preferredTags.has(normalize(tag)),
  ).length;
  score += tagMatches * 55;

  const ageInDays = Math.max(0, (Date.now() - toTimestamp(lesson.createdAt)) / DAY_IN_MS);
  const freshnessBoost = Math.max(0, 45 - ageInDays * 1.4);
  score += freshnessBoost;

  return score;
};

const applyFilters = (lessons: Lesson[], filters: LessonFilters): Lesson[] => {
  const search = normalize(filters.search);
  const onlyPublished = filters.onlyPublished ?? true;
  const safeMinimumRating =
    Number.isFinite(filters.minimumRating) && (filters.minimumRating ?? 0) > 0
      ? Math.min(5, Math.max(0, Number(filters.minimumRating)))
      : 0;

  const requestedTags = Array.isArray(filters.tags)
    ? filters.tags.map((tag) => normalize(tag)).filter(Boolean)
    : [];

  let result = lessons.filter((lesson) =>
    onlyPublished ? lesson.status === 'published' : true,
  );

  if (search) {
    result = result.filter((lesson) => {
      const haystack = [
        lesson.title,
        lesson.description,
        lesson.subject,
        lesson.gradeLevel,
        lesson.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  if (filters.subject && filters.subject !== 'All') {
    result = result.filter((lesson) => lesson.subject === filters.subject);
  }

  if (filters.gradeLevel && filters.gradeLevel !== 'All') {
    result = result.filter((lesson) => lesson.gradeLevel === filters.gradeLevel);
  }

  if (requestedTags.length > 0) {
    result = result.filter((lesson) => {
      const lessonTags = lesson.tags.map((tag) => normalize(tag));
      return requestedTags.every((tag) => lessonTags.includes(tag));
    });
  }

  if (safeMinimumRating > 0) {
    result = result.filter((lesson) => lesson.rating >= safeMinimumRating);
  }

  if (filters.priceType === 'free') {
    result = result.filter((lesson) => lesson.price === 0);
  }

  if (filters.priceType === 'paid') {
    result = result.filter((lesson) => lesson.price > 0);
  }

  if (filters.priceType === 'under_100') {
    result = result.filter((lesson) => lesson.price > 0 && lesson.price < 100);
  }

  if (filters.priceType === 'between_100_200') {
    result = result.filter((lesson) => lesson.price >= 100 && lesson.price <= 200);
  }

  if (filters.priceType === 'above_200') {
    result = result.filter((lesson) => lesson.price > 200);
  }

  const sortBy = filters.sortBy ?? 'popular';
  result = [...result].sort((left, right) => {
    if (sortBy === 'newest') {
      return toTimestamp(right.createdAt) - toTimestamp(left.createdAt);
    }

    if (sortBy === 'rating') {
      if (right.rating === left.rating) {
        return right.reviewCount - left.reviewCount;
      }
      return right.rating - left.rating;
    }

    if (sortBy === 'price_asc') {
      return left.price - right.price;
    }

    if (sortBy === 'price_desc') {
      return right.price - left.price;
    }

    const popularityDifference =
      calculatePopularityScore(right) - calculatePopularityScore(left);
    if (popularityDifference === 0) {
      return toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
    }

    return popularityDifference;
  });

  return result;
};

const recalculateLessonRating = (
  lessonId: string,
  lessons: Lesson[],
  reviews: LessonReview[],
): void => {
  const lesson = lessons.find((item) => item.id === lessonId);
  if (!lesson) {
    return;
  }

  const relatedReviews = reviews.filter((review) => review.lessonId === lessonId);
  const rating =
    relatedReviews.length === 0
      ? 0
      : relatedReviews.reduce((total, review) => total + review.rating, 0) /
        relatedReviews.length;

  lesson.reviewCount = relatedReviews.length;
  lesson.rating = Number(rating.toFixed(1));
  lesson.updatedAt = new Date().toISOString();
};

export const getMarketplaceOverview = async (
  viewerId?: string,
): Promise<MarketplaceOverview> => {
  const lessons = sanitizeLessons(getDatabase().lessons).filter(
    (lesson) => lesson.status === 'published',
  );

  const recommendationContext = buildRecommendationContext(viewerId);

  const featured = [...lessons]
    .sort((left, right) => {
      if (right.rating === left.rating) {
        return right.reviewCount - left.reviewCount;
      }
      return right.rating - left.rating;
    })
    .slice(0, 6);

  const popular = [...lessons]
    .sort(
      (left, right) =>
        calculatePopularityScore(right) - calculatePopularityScore(left),
    )
    .slice(0, 6);

  const recommended = [...lessons]
    .sort(
      (left, right) =>
        calculateRecommendationScore(right, recommendationContext) -
        calculateRecommendationScore(left, recommendationContext),
    )
    .slice(0, 6);

  const latest = [...lessons]
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
    .slice(0, 6);

  return withLatency({ featured, popular, recommended, latest });
};

export const getLessonFilterMetadata = async (): Promise<LessonFilterMetadata> => {
  const lessons = sanitizeLessons(getDatabase().lessons).filter(
    (lesson) => lesson.status === 'published',
  );

  const subjects = Array.from(new Set(lessons.map((lesson) => lesson.subject))).sort(
    (left, right) => left.localeCompare(right),
  );

  const gradeLevels = Array.from(
    new Set(lessons.map((lesson) => lesson.gradeLevel)),
  ).sort((left, right) => left.localeCompare(right));

  const tags = Array.from(
    new Set(
      lessons.flatMap((lesson) =>
        lesson.tags.map((tag) => tag.trim()).filter(Boolean),
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return withLatency({
    subjects,
    gradeLevels,
    tags,
    ratingOptions: [4.5, 4, 3.5, 3],
  });
};

export const listLessons = async (
  filters: LessonFilters = {},
): Promise<PaginatedResult<Lesson>> => {
  const lessons = sanitizeLessons(getDatabase().lessons);
  const filtered = applyFilters(lessons, filters);
  const paginated = paginate(filtered, filters.page ?? 1, filters.pageSize ?? DEFAULT_PAGE_SIZE);
  return withLatency(paginated);
};

export const getLessonById = async (lessonId: string): Promise<Lesson | null> => {
  const lesson = sanitizeLessons(getDatabase().lessons).find((item) => item.id === lessonId) ?? null;
  return withLatency(lesson);
};

export const getRelatedLessons = async (
  lessonId: string,
  limit = 4,
  viewerId?: string,
): Promise<Lesson[]> => {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(12, Math.floor(limit)) : 4;
  const lessons = sanitizeLessons(getDatabase().lessons).filter(
    (item) => item.status === 'published',
  );

  const lesson = lessons.find((item) => item.id === lessonId);
  if (!lesson) {
    return withLatency([]);
  }

  const recommendationContext = buildRecommendationContext(viewerId);

  const related = lessons
    .filter((item) => item.id !== lesson.id)
    .map((item) => {
      let score = 0;
      if (item.subject === lesson.subject) {
        score += 180;
      }

      if (item.gradeLevel === lesson.gradeLevel) {
        score += 120;
      }

      const lessonTagSet = new Set(lesson.tags.map((tag) => normalize(tag)));
      const sharedTagCount = item.tags.filter((tag) => lessonTagSet.has(normalize(tag))).length;
      score += sharedTagCount * 75;

      score += calculateRecommendationScore(item, recommendationContext);
      return { item, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, safeLimit)
    .map((entry) => entry.item);

  return withLatency(related);
};

export const getLessonDetailSnapshot = async (
  lessonId: string,
  viewerId?: string,
): Promise<LessonDetailSnapshot | null> => {
  const database = getDatabase();
  const lesson = sanitizeLessons(database.lessons).find((item) => item.id === lessonId);
  if (!lesson || lesson.status !== 'published') {
    return withLatency(null);
  }

  const paidOrderUserIds = new Set<string>(
    database.orders
      .filter((order) => order.lessonId === lesson.id && order.status === 'paid')
      .map((order) => order.userId),
  );

  const hasPaidOrder = Boolean(viewerId && paidOrderUserIds.has(viewerId));
  const entitlement = resolveEntitlementState(lesson, viewerId, hasPaidOrder);
  const reviewPermission = resolveReviewPermission(entitlement, viewerId);

  const reviews: LessonReviewView[] = sanitizeReviews(
    database.lessonReviews
      .filter((review) => review.lessonId === lesson.id)
      .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt)),
  ).map((review) => ({
    ...review,
    isVerifiedBuyer:
      review.authorId === lesson.authorId || paidOrderUserIds.has(review.authorId),
  }));

  return withLatency({
    lesson,
    ...entitlement,
    reviewPermission,
    reviews,
  });
};

export const getLessonReviews = async (lessonId: string): Promise<LessonReview[]> => {
  const reviews = sanitizeReviews(
    getDatabase()
      .lessonReviews.filter((review) => review.lessonId === lessonId)
      .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt)),
  );

  return withLatency(reviews);
};

export const createLessonReview = async (
  userId: string,
  payload: LessonReviewPayload,
): Promise<LessonReview> => {
  const normalizedRating = Number(payload.rating);
  if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const normalizedComment = payload.comment.trim();
  if (!normalizedComment) {
    throw new Error('Review comment is required');
  }

  const database = getDatabase();
  const lesson = sanitizeLessons(database.lessons).find((item) => item.id === payload.lessonId);
  if (!lesson || lesson.status !== 'published') {
    throw new Error('Lesson not found');
  }

  const hasPaidOrder = database.orders.some(
    (order) =>
      order.userId === userId &&
      order.lessonId === payload.lessonId &&
      order.status === 'paid',
  );

  const entitlement = resolveEntitlementState(lesson, userId, hasPaidOrder);
  const reviewPermission = resolveReviewPermission(entitlement, userId);

  if (!reviewPermission.canSubmit) {
    throw new Error(reviewPermission.message);
  }

  let savedReview: LessonReview | null = null;

  updateDatabase((draft) => {
    const reviewIndex = draft.lessonReviews.findIndex(
      (review) =>
        review.lessonId === payload.lessonId && review.authorId === userId,
    );

    if (reviewIndex >= 0) {
      draft.lessonReviews[reviewIndex] = {
        ...draft.lessonReviews[reviewIndex],
        rating: toSafeRating(normalizedRating),
        comment: normalizedComment,
        createdAt: new Date().toISOString(),
      };
      savedReview = draft.lessonReviews[reviewIndex];
    } else {
      const created: LessonReview = {
        id: generateId('review'),
        lessonId: payload.lessonId,
        authorId: userId,
        rating: toSafeRating(normalizedRating),
        comment: normalizedComment,
        createdAt: new Date().toISOString(),
      };

      draft.lessonReviews.push(created);
      savedReview = created;
    }

    recalculateLessonRating(payload.lessonId, draft.lessons, draft.lessonReviews);
  });

  if (!savedReview) {
    throw new Error('Unable to save review');
  }

  return withLatency(sanitizeReview(savedReview));
};

export const listLessonsByAuthor = async (
  authorId: string,
  includeDraft = true,
): Promise<Lesson[]> => {
  const lessons = sanitizeLessons(getDatabase().lessons)
    .filter((lesson) => lesson.authorId === authorId)
    .filter((lesson) => (includeDraft ? true : lesson.status === 'published'))
    .sort((left, right) => toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt));

  return withLatency(lessons);
};

export const createLesson = async (
  authorId: string,
  payload: UpsertLessonPayload,
): Promise<Lesson> => {
  const normalizedPayload = normalizeUpsertLessonPayload(payload);

  let createdLesson: Lesson | null = null;

  updateDatabase((draft) => {
    const now = new Date().toISOString();
    const lesson: Lesson = {
      id: generateId('lesson'),
      authorId,
      title: normalizedPayload.title,
      description: normalizedPayload.description,
      subject: normalizedPayload.subject,
      gradeLevel: normalizedPayload.gradeLevel,
      format: normalizedPayload.format,
      downloads: 0,
      rating: 0,
      reviewCount: 0,
      thumbnail:
        normalizedPayload.thumbnail?.trim() ||
        `https://picsum.photos/seed/${encodeURIComponent(authorId)}-lesson/640/420`,
      price: normalizedPayload.price,
      duration: normalizedPayload.duration,
      estimatedMinutes: normalizedPayload.estimatedMinutes,
      language: normalizedPayload.language,
      fileSize: normalizedPayload.fileSize,
      attachmentSummary: normalizedPayload.attachmentSummary,
      attachments: normalizedPayload.attachments,
      pedagogicalGoals: normalizedPayload.pedagogicalGoals,
      keyLearnings: normalizedPayload.keyLearnings,
      status: normalizedPayload.status,
      versionLabel: normalizedPayload.versionLabel,
      updateNotes: normalizedPayload.updateNotes,
      previewMediaUrl: normalizedPayload.previewMediaUrl,
      createdAt: now,
      updatedAt: now,
      tags: normalizedPayload.tags,
    };

    draft.lessons.push(lesson);
    createdLesson = lesson;
  });

  if (!createdLesson) {
    throw new Error('Unable to create lesson');
  }

  return withLatency(sanitizeLesson(createdLesson));
};

export const updateLesson = async (
  lessonId: string,
  authorId: string,
  payload: UpsertLessonPayload,
): Promise<Lesson> => {
  const normalizedPayload = normalizeUpsertLessonPayload(payload);

  let updatedLesson: Lesson | null = null;

  updateDatabase((draft) => {
    const lesson = draft.lessons.find((item) => item.id === lessonId);
    if (!lesson) {
      return;
    }

    if (lesson.authorId !== authorId) {
      return;
    }

    lesson.title = normalizedPayload.title;
    lesson.description = normalizedPayload.description;
    lesson.subject = normalizedPayload.subject;
    lesson.gradeLevel = normalizedPayload.gradeLevel;
    lesson.format = normalizedPayload.format;
    lesson.price = normalizedPayload.price;
    lesson.thumbnail =
      normalizedPayload.thumbnail ||
      `https://picsum.photos/seed/${encodeURIComponent(lesson.id)}/640/420`;
    lesson.duration = normalizedPayload.duration;
    lesson.estimatedMinutes = normalizedPayload.estimatedMinutes;
    lesson.language = normalizedPayload.language;
    lesson.fileSize = normalizedPayload.fileSize;
    lesson.attachmentSummary = normalizedPayload.attachmentSummary;
    lesson.attachments = normalizedPayload.attachments;
    lesson.pedagogicalGoals = normalizedPayload.pedagogicalGoals;
    lesson.keyLearnings = normalizedPayload.keyLearnings;
    lesson.tags = normalizedPayload.tags;
    lesson.status = normalizedPayload.status;
    lesson.versionLabel = normalizedPayload.versionLabel;
    lesson.updateNotes = normalizedPayload.updateNotes;
    lesson.previewMediaUrl = normalizedPayload.previewMediaUrl;
    lesson.updatedAt = new Date().toISOString();

    updatedLesson = lesson;
  });

  if (!updatedLesson) {
    throw new Error('Lesson not found or you do not have permission to edit it');
  }

  return withLatency(sanitizeLesson(updatedLesson));
};

export const deleteLesson = async (
  lessonId: string,
  authorId: string,
): Promise<void> => {
  let removed = false;

  updateDatabase((draft) => {
    const index = draft.lessons.findIndex((lesson) => lesson.id === lessonId);
    if (index < 0) {
      return;
    }

    if (draft.lessons[index].authorId !== authorId) {
      return;
    }

    draft.lessons.splice(index, 1);
    draft.lessonReviews = draft.lessonReviews.filter(
      (review) => review.lessonId !== lessonId,
    );
    removed = true;
  });

  if (!removed) {
    throw new Error('Lesson not found or you do not have permission to delete it');
  }

  await withLatency(true, 160);
};

export const setLessonStatus = async (
  lessonId: string,
  authorId: string,
  status: LessonStatus,
): Promise<Lesson> => {
  let updatedLesson: Lesson | null = null;

  updateDatabase((draft) => {
    const lesson = draft.lessons.find((item) => item.id === lessonId);
    if (!lesson || lesson.authorId !== authorId) {
      return;
    }

    lesson.status = toSafeStatus(status);
    lesson.updatedAt = new Date().toISOString();
    updatedLesson = lesson;
  });

  if (!updatedLesson) {
    throw new Error('Unable to update lesson status');
  }

  return withLatency(sanitizeLesson(updatedLesson), 140);
};

export const incrementLessonDownload = async (lessonId: string): Promise<void> => {
  updateDatabase((draft) => {
    const lesson = draft.lessons.find((item) => item.id === lessonId);
    if (!lesson) {
      return;
    }

    lesson.downloads = toNonNegativeInteger(lesson.downloads + 1);
    lesson.updatedAt = new Date().toISOString();
  });

  await withLatency(true, 80);
};

export const updateLessonReview = async (
  reviewId: string,
  userId: string,
  payload: { rating: number; comment: string },
): Promise<LessonReview> => {
  const normalizedRating = Number(payload.rating);
  if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const normalizedComment = payload.comment.trim();
  if (!normalizedComment) {
    throw new Error('Review comment is required');
  }

  let updatedReview: LessonReview | null = null;

  updateDatabase((draft) => {
    const review = draft.lessonReviews.find((r) => r.id === reviewId);
    if (!review) return;

    if (review.authorId !== userId) return;

    review.rating = toSafeRating(normalizedRating);
    review.comment = normalizedComment;
    review.createdAt = new Date().toISOString();

    recalculateLessonRating(review.lessonId, draft.lessons, draft.lessonReviews);
    updatedReview = review;
  });

  if (!updatedReview) {
    throw new Error('Review not found or you do not have permission to edit it');
  }

  return withLatency(sanitizeReview(updatedReview));
};

export const deleteLessonReview = async (
  reviewId: string,
  userId: string,
): Promise<void> => {
  let removed = false;

  updateDatabase((draft) => {
    const index = draft.lessonReviews.findIndex((r) => r.id === reviewId);
    if (index < 0) return;

    if (draft.lessonReviews[index].authorId !== userId) return;

    const lessonId = draft.lessonReviews[index].lessonId;
    draft.lessonReviews.splice(index, 1);
    recalculateLessonRating(lessonId, draft.lessons, draft.lessonReviews);
    removed = true;
  });

  if (!removed) {
    throw new Error('Review not found or you do not have permission to delete it');
  }

  await withLatency(true, 140);
};

export const createLessonReport = async (
  userId: string,
  payload: { targetType: 'lesson' | 'review'; targetId: string; reason: string; category: string },
): Promise<void> => {
  const database = getDatabase();

  if (payload.targetType === 'lesson') {
    const lesson = database.lessons.find((l) => l.id === payload.targetId);
    if (!lesson) throw new Error('Lesson not found');
    if (lesson.authorId === userId) throw new Error('You cannot report your own lesson');
  } else {
    const review = database.lessonReviews.find((r) => r.id === payload.targetId);
    if (!review) throw new Error('Review not found');
    if (review.authorId === userId) throw new Error('You cannot report your own review');
  }

  const existingReport = database.reports.find(
    (r) => r.reporterId === userId && r.targetId === payload.targetId && r.status === 'pending',
  );
  if (existingReport) throw new Error('You have already reported this content');

  updateDatabase((draft) => {
    draft.reports.push({
      id: generateId('report'),
      reporterId: userId,
      targetType: payload.targetType === 'lesson' ? 'lesson' : 'post',
      targetId: payload.targetId,
      reason: payload.reason,
      category: payload.category,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  await withLatency(true, 120);
};
