import {
  isLessonFavorited,
  listFavoriteLessonIds,
  toggleLessonFavorite,
} from '../repositories/lessonFavoritesRepository';

export const lessonFavoritesService = {
  listFavoriteLessonIds,
  isLessonFavorited,
  toggleLessonFavorite,
};
