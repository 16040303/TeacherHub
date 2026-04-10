import { getDatabase, updateDatabase, withLatency } from '../mock/server/database';
import { LessonFavorite } from '../types';
import { toSafeDate, toSafeId, toOptionalString } from '../utils/normalizers';

const compareByCreatedAt = (left: LessonFavorite, right: LessonFavorite): number => {
  const leftTime = new Date(left.createdAt).getTime();
  const rightTime = new Date(right.createdAt).getTime();
  return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
};

const normalizeFavorite = (favorite: LessonFavorite): LessonFavorite => ({
  userId: toSafeId(favorite.userId, 'unknown-user'),
  lessonId: toSafeId(favorite.lessonId, 'unknown-lesson'),
  createdAt: toSafeDate(favorite.createdAt),
  source: (() => {
    const value = toOptionalString(favorite.source);
    if (
      value === 'lesson_detail' ||
      value === 'library' ||
      value === 'teacher_profile' ||
      value === 'unknown'
    ) {
      return value;
    }

    return undefined;
  })(),
});

export const listFavoriteLessonIds = async (userId: string): Promise<string[]> => {
  const safeUserId = toSafeId(userId, '');

  const ids = getDatabase()
    .lessonFavorites
    .map((item) => normalizeFavorite(item))
    .filter((item) => item.userId === safeUserId)
    .sort(compareByCreatedAt)
    .map((item) => item.lessonId);

  return withLatency(Array.from(new Set(ids)), 90);
};

export const isLessonFavorited = async (userId: string, lessonId: string): Promise<boolean> => {
  const safeUserId = toSafeId(userId, '');
  const safeLessonId = toSafeId(lessonId, '');

  const favorited = getDatabase().lessonFavorites
    .map((item) => normalizeFavorite(item))
    .some((item) => item.userId === safeUserId && item.lessonId === safeLessonId);

  return withLatency(favorited, 80);
};

export const toggleLessonFavorite = async (userId: string, lessonId: string): Promise<boolean> => {
  const safeUserId = toSafeId(userId, '');
  const safeLessonId = toSafeId(lessonId, '');

  if (!safeUserId || !safeLessonId) {
    throw new Error('User and lesson are required');
  }

  const lessonExists = getDatabase().lessons.some((lesson) => toSafeId(lesson.id, '') === safeLessonId);
  if (!lessonExists) {
    throw new Error('Lesson not found');
  }

  let favorited = false;

  updateDatabase((draft) => {
    const index = draft.lessonFavorites.findIndex((item) => {
      const normalized = normalizeFavorite(item);
      return normalized.userId === safeUserId && normalized.lessonId === safeLessonId;
    });

    if (index >= 0) {
      draft.lessonFavorites.splice(index, 1);
      favorited = false;
      return;
    }

    draft.lessonFavorites.push({
      userId: safeUserId,
      lessonId: safeLessonId,
      createdAt: new Date().toISOString(),
      source: 'lesson_detail',
    });
    favorited = true;
  });

  return withLatency(favorited, 80);
};
