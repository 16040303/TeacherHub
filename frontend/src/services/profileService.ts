import {
  getCurrentUserProfile,
  getPublicUserById,
  getTeacherPublicProfile,
  listPublicUsers,
  listTeacherLessons,
  listTeacherReviews,
  updateCurrentUserProfile,
} from '../repositories/profileRepository';

export const profileService = {
  listPublicUsers,
  getPublicUserById,
  getCurrentUserProfile,
  updateCurrentUserProfile,
  getTeacherPublicProfile,
  listTeacherLessons,
  listTeacherReviews,
};
