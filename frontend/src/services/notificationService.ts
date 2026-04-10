import {
  createNotification,
  getUnreadNotificationsCount,
  listNotificationsByUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../repositories/notificationsRepository';

export const notificationService = {
  listNotificationsByUser,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
};
