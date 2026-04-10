import {
  getAdminDashboardSnapshot,
  getDashboardStats,
  getLessonForModeration,
  getUserForAdmin,
  listCommunityForModeration,
  listLessonsForModeration,
  listOrdersForAdmin,
  listRecentTransactions,
  listReportsForAdmin,
  listUsersForAdmin,
  moderateLessonAsAdmin,
  removeCommunityContent,
  updateReportAsAdmin,
  updateUserAsAdmin,
} from '../repositories/adminRepository';

export const adminService = {
  /* Batch 1 */
  getAdminDashboardSnapshot,
  getDashboardStats,
  listUsersForAdmin,
  getUserForAdmin,
  updateUserAsAdmin,
  listLessonsForModeration,
  getLessonForModeration,
  moderateLessonAsAdmin,
  listRecentTransactions,
  /* Batch 2 */
  listCommunityForModeration,
  removeCommunityContent,
  listReportsForAdmin,
  updateReportAsAdmin,
  listOrdersForAdmin,
};
