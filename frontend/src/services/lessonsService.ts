import {
  createLesson,
  createLessonReport,
  createLessonReview,
  deleteLesson,
  deleteLessonReview,
  getLessonById,
  getLessonDetailSnapshot,
  getLessonFilterMetadata,
  getLessonReviews,
  getMarketplaceOverview,
  getRelatedLessons,
  incrementLessonDownload,
  listLessons,
  listLessonsByAuthor,
  setLessonStatus,
  updateLesson,
  updateLessonReview,
} from '../repositories/lessonsRepository';

export const lessonsService = {
  getMarketplaceOverview,
  getLessonFilterMetadata,
  listLessons,
  getLessonById,
  getLessonDetailSnapshot,
  getRelatedLessons,
  getLessonReviews,
  createLessonReview,
  updateLessonReview,
  deleteLessonReview,
  createLessonReport,
  listLessonsByAuthor,
  createLesson,
  updateLesson,
  deleteLesson,
  setLessonStatus,
  incrementLessonDownload,
};

/* Re-export contract payloads so pages never import from mock/contracts. */
export type { UpsertLessonPayload } from '../mock/contracts';

