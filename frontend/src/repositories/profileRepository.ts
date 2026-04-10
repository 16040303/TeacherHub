import { ProfileUpdatePayload } from '../mock/contracts';
import { getDatabase, withLatency } from '../mock/server/database';
import { Lesson, LessonReview, TeacherPublicProfile, User } from '../types';
import { apiRequest } from '../services/apiClient';
import { parseApiError } from '../utils/api-error';
import {
  mapBackendRole,
  mapBackendUser,
  mapBackendUserId,
  mapBackendUserStatus,
} from '../utils/mappers';
import {
  toNonNegativeInt,
  toSafeDate,
  toSafeId,
  toSafeNumber,
  toSafePrice,
  toSafeRating,
  toTimestamp,
  toTrimmedString,
} from '../utils/normalizers';

export type SafeUser = Omit<User, 'password'>;

interface BackendProfileResponse {
  id: number;
  fullName: string;
  email: string;
  role: string;
  status: string;
  avatarUrl?: string | null;
  bio?: string | null;
  headline?: string | null;
  expertise?: string | null;
  yearsExperience?: number | null;
  location?: string | null;
  socialLinks?: Array<{ platform: string; url: string }>;
  createdAt: string;
  updatedAt: string;
}

interface BackendTeacherProfileResponse {
  id: number;
  name: string;
  avatar?: string | null;
  subject?: string | null;
  experience?: string | null;
  location?: string | null;
  bio?: string | null;
  stats: {
    sharedLessons: number;
    totalDownloads: number;
    averageRating: number;
    followers: number;
    following: number;
  };
}

interface BackendTeacherLessonResponse {
  id: number;
  authorId: number;
  title: string;
  description?: string | null;
  subject?: string | null;
  gradeLevel?: string | null;
  downloads: number;
  rating: number;
  reviewCount: number;
  thumbnail?: string | null;
  price: number;
  status: 'draft' | 'published' | 'hidden';
  createdAt: string;
  updatedAt: string;
}

interface BackendTeacherReviewResponse {
  review: {
    id: number;
    lessonId: number;
    authorId: number;
    rating: number;
    comment: string;
    createdAt: string;
    isVerifiedBuyer: boolean;
  };
  lessonTitle: string;
  reviewer: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    status: string;
    avatarUrl?: string | null;
    bio?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface TeacherReviewItem {
  review: LessonReview & { isVerifiedBuyer?: boolean };
  lessonTitle: string;
  reviewer: SafeUser | null;
}

const sanitizeUser = (user: User): SafeUser => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

const normalizeAvatarInput = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    // handled by error below
  }

  throw new Error('Avatar must be a valid image URL or image data URL');
};

const compareByUpdated = (left: Lesson, right: Lesson): number =>
  toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);

const toSafeUserFromProfile = (profile: BackendProfileResponse): SafeUser => {
  const mapped = mapBackendUser({
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    role: profile.role as 'TEACHER' | 'STUDENT' | 'ADMIN',
    status: profile.status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING',
    avatarUrl: profile.avatarUrl ?? null,
    bio: profile.bio ?? null,
    createdAt: profile.createdAt,
  });

  return {
    ...mapped,
    subject: toTrimmedString(profile.expertise) || undefined,
    experience:
      typeof profile.yearsExperience === 'number'
        ? profile.yearsExperience <= 0
          ? 'Less than 1 year'
          : profile.yearsExperience === 1
          ? '1 year'
          : `${profile.yearsExperience} years`
        : undefined,
    location: toTrimmedString(profile.location) || undefined,
    bio: toTrimmedString(profile.bio) || undefined,
    createdAt: toSafeDate(profile.createdAt),
  };
};

const toTeacherPublicProfile = (
  dto: BackendTeacherProfileResponse,
): TeacherPublicProfile => ({
  id: mapBackendUserId(dto.id),
  name: toTrimmedString(dto.name) || 'TeacherHub Educator',
  avatar: toTrimmedString(dto.avatar) || undefined,
  subject: toTrimmedString(dto.subject) || undefined,
  experience: toTrimmedString(dto.experience) || undefined,
  location: toTrimmedString(dto.location) || undefined,
  bio: toTrimmedString(dto.bio) || undefined,
  stats: {
    sharedLessons: toNonNegativeInt(dto.stats.sharedLessons),
    totalDownloads: toNonNegativeInt(dto.stats.totalDownloads),
    averageRating: toSafeRating(dto.stats.averageRating),
    followers: toNonNegativeInt(dto.stats.followers),
    following: toNonNegativeInt(dto.stats.following),
  },
});

/** When lessons still come from mock (`u-sarah`, …) but teacher profile hits the real API (numeric ids only). */
const teacherPublicProfileFromSafeUser = (user: SafeUser): TeacherPublicProfile => ({
  id: user.id,
  name: user.name?.trim() || 'TeacherHub Educator',
  avatar: user.avatar,
  subject: user.subject,
  experience: user.experience,
  location: user.location,
  bio: user.bio,
  stats: {
    sharedLessons: 0,
    totalDownloads: 0,
    averageRating: 0,
    followers: 0,
    following: 0,
  },
});

const toLesson = (dto: BackendTeacherLessonResponse): Lesson => {
  const nowIso = new Date().toISOString();

  return {
    id: toSafeId(dto.id, ''),
    authorId: mapBackendUserId(dto.authorId),
    title: toTrimmedString(dto.title) || 'Untitled lesson',
    description: toTrimmedString(dto.description),
    subject: (toTrimmedString(dto.subject) || 'Math') as Lesson['subject'],
    gradeLevel: (toTrimmedString(dto.gradeLevel) || 'High School') as Lesson['gradeLevel'],
    format: 'PDF',
    downloads: toNonNegativeInt(dto.downloads),
    rating: toSafeRating(dto.rating),
    reviewCount: toNonNegativeInt(dto.reviewCount),
    thumbnail:
      toTrimmedString(dto.thumbnail) ||
      `https://picsum.photos/seed/${encodeURIComponent(String(dto.id))}/640/420`,
    price: toSafePrice(dto.price),
    status: dto.status,
    createdAt: toSafeDate(dto.createdAt, nowIso),
    updatedAt: toSafeDate(dto.updatedAt, nowIso),
    tags: [],
  };
};

const toSafeReviewer = (
  reviewer: BackendTeacherReviewResponse['reviewer'],
): SafeUser | null => {
  if (!reviewer) {
    return null;
  }

  return {
    id: mapBackendUserId(reviewer.id),
    name: toTrimmedString(reviewer.fullName) || 'TeacherHub User',
    email: reviewer.email,
    role: mapBackendRole(reviewer.role),
    backendRole:
      reviewer.role === 'TEACHER' || reviewer.role === 'STUDENT' || reviewer.role === 'ADMIN'
        ? reviewer.role
        : undefined,
    status: mapBackendUserStatus(reviewer.status),
    avatar: toTrimmedString(reviewer.avatarUrl) || undefined,
    bio: toTrimmedString(reviewer.bio) || undefined,
    language: 'en',
    createdAt: toSafeDate(reviewer.createdAt),
  };
};

const toTeacherReviewItem = (dto: BackendTeacherReviewResponse): TeacherReviewItem => ({
  review: {
    id: toSafeId(dto.review.id, ''),
    lessonId: toSafeId(dto.review.lessonId, ''),
    authorId: toSafeId(dto.review.authorId, ''),
    rating: toSafeRating(dto.review.rating),
    comment: toTrimmedString(dto.review.comment),
    createdAt: toSafeDate(dto.review.createdAt),
    isVerifiedBuyer: Boolean(dto.review.isVerifiedBuyer),
  },
  lessonTitle: toTrimmedString(dto.lessonTitle) || 'Unknown lesson',
  reviewer: toSafeReviewer(dto.reviewer),
});

const isFallbackEligibleError = (error: unknown): boolean => {
  const parsed = parseApiError(error);
  return (
    parsed.statusCode === 404 ||
    /failed to fetch|networkerror|network error|request failed/i.test(parsed.message)
  );
};

const fallbackPublicUsersFromMock = async (): Promise<SafeUser[]> => {
  const users = getDatabase().users.map(sanitizeUser);
  return withLatency(users, 120);
};

const fallbackPublicUserByIdFromMock = async (
  userId: string,
): Promise<SafeUser | null> => {
  const user = getDatabase().users.find((item) => item.id === userId);
  return withLatency(user ? sanitizeUser(user) : null, 120);
};

export const listPublicUsers = async (): Promise<SafeUser[]> => {
  // Dedicated backend endpoint is not exposed yet; use safe compatibility fallback.
  return fallbackPublicUsersFromMock();
};

export const getPublicUserById = async (userId: string): Promise<SafeUser | null> => {
  // Dedicated backend endpoint is not exposed yet; use safe compatibility fallback.
  return fallbackPublicUserByIdFromMock(userId);
};

export const getCurrentUserProfile = async (
  _userId: string,
): Promise<SafeUser | null> => {
  try {
    const profile = await apiRequest<BackendProfileResponse>('/api/profile/me');
    return toSafeUserFromProfile(profile);
  } catch (error) {
    if (isFallbackEligibleError(error)) {
      return null;
    }

    throw parseApiError(error);
  }
};

export const updateCurrentUserProfile = async (
  _userId: string,
  payload: ProfileUpdatePayload,
): Promise<SafeUser> => {
  const hasAvatarUpdate =
    Object.prototype.hasOwnProperty.call(payload, 'avatar') && typeof payload.avatar === 'string';
  const normalizedAvatar = hasAvatarUpdate ? normalizeAvatarInput(payload.avatar) : undefined;

  const yearsExperience = Number.parseInt(toTrimmedString(payload.experience).replace(/[^0-9]/g, ''), 10);
  const safeYearsExperience = Number.isFinite(yearsExperience) ? Math.max(0, Math.min(80, yearsExperience)) : undefined;

  const body = {
    fullName: toTrimmedString(payload.name) || undefined,
    expertise: toTrimmedString(payload.subject) || undefined,
    yearsExperience: safeYearsExperience,
    location: toTrimmedString(payload.location) || undefined,
    bio: toTrimmedString(payload.bio) || undefined,
    ...(hasAvatarUpdate ? { avatarUrl: normalizedAvatar } : {}),
  };

  try {
    const updated = await apiRequest<BackendProfileResponse>('/api/profile/me', {
      method: 'PATCH',
      body,
    });

    return toSafeUserFromProfile(updated);
  } catch (error) {
    throw parseApiError(error);
  }
};

export const getTeacherPublicProfile = async (
  teacherId: string,
): Promise<TeacherPublicProfile | null> => {
  try {
    const profile = await apiRequest<BackendTeacherProfileResponse>(`/api/teachers/${teacherId}`, {
      includeAuth: false,
    });

    if (!profile) {
      return null;
    }

    return toTeacherPublicProfile(profile);
  } catch (error) {
    const parsed = parseApiError(error);
    const mockTeacher = await fallbackPublicUserByIdFromMock(teacherId);
    if (mockTeacher) {
      return teacherPublicProfileFromSafeUser(mockTeacher);
    }
    if (parsed.statusCode === 404) {
      return null;
    }

    throw parsed;
  }
};

export const listTeacherLessons = async (
  teacherId: string,
  includeDraft = false,
): Promise<Lesson[]> => {
  try {
    const lessons = await apiRequest<BackendTeacherLessonResponse[]>(
      `/api/teachers/${teacherId}/lessons?includeDraft=${includeDraft ? 'true' : 'false'}`,
      {
        includeAuth: includeDraft,
      },
    );

    return lessons.map(toLesson).sort(compareByUpdated);
  } catch (error) {
    throw parseApiError(error);
  }
};

export const listTeacherReviews = async (
  teacherId: string,
): Promise<TeacherReviewItem[]> => {
  try {
    const rows = await apiRequest<BackendTeacherReviewResponse[]>(`/api/teachers/${teacherId}/reviews`, {
      includeAuth: false,
    });

    return rows.map(toTeacherReviewItem);
  } catch (error) {
    throw parseApiError(error);
  }
};
