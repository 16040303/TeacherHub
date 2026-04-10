import { getDatabase, updateDatabase, withLatency } from '../mock/server/database';
import { AppNotification, AppNotificationType, NOTIFICATION_TYPES } from '../types';
import { generateId } from '../utils/id';
import { toSafeDate, toSafeEnum, toSafeId, toOptionalString, toTrimmedString } from '../utils/normalizers';

export interface CreateNotificationInput {
  userId: string;
  type: AppNotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  read?: boolean;
  readAt?: string;
  actorUserId?: string;
  entityType?: AppNotification['entityType'];
  entityId?: string;
}

const toTimestamp = (value: string): number => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const normalizeOptional = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeNotificationType = (value: unknown): AppNotificationType =>
  toSafeEnum(value, NOTIFICATION_TYPES, 'system');

const normalizeNotificationEntityType = (value: unknown): AppNotification['entityType'] => {
  const normalized = toTrimmedString(value);

  if (
    normalized === 'order' ||
    normalized === 'lesson' ||
    normalized === 'post' ||
    normalized === 'comment' ||
    normalized === 'user' ||
    normalized === 'system'
  ) {
    return normalized;
  }

  return undefined;
};

const normalizeNotification = (notification: AppNotification): AppNotification => ({
  id: toSafeId(notification.id, 'notif-unknown'),
  userId: toSafeId(notification.userId, 'unknown-user'),
  type: normalizeNotificationType(notification.type),
  title: toTrimmedString(notification.title) || 'Notification',
  message: toTrimmedString(notification.message) || 'No details available.',
  actionUrl: toOptionalString(notification.actionUrl),
  actionLabel: toOptionalString(notification.actionLabel),
  read: Boolean(notification.read),
  readAt: notification.read ? toSafeDate(notification.readAt ?? notification.createdAt) : undefined,
  actorUserId: toOptionalString(notification.actorUserId),
  entityType: normalizeNotificationEntityType(notification.entityType),
  entityId: toOptionalString(notification.entityId),
  createdAt: toSafeDate(notification.createdAt),
});

export const listNotificationsByUser = async (userId: string): Promise<AppNotification[]> => {
  const safeUserId = toSafeId(userId, '');

  const notifications = getDatabase()
    .notifications.map((item) => normalizeNotification(item))
    .filter((item) => item.userId === safeUserId)
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));

  return withLatency(notifications, 130);
};

export const getUnreadNotificationsCount = async (userId: string): Promise<number> => {
  const safeUserId = toSafeId(userId, '');

  const count = getDatabase()
    .notifications
    .map((item) => normalizeNotification(item))
    .filter((item) => item.userId === safeUserId && !item.read).length;

  return withLatency(count, 90);
};

export const markNotificationAsRead = async (userId: string, notificationId: string): Promise<AppNotification> => {
  let updated: AppNotification | null = null;
  const safeUserId = toSafeId(userId, '');
  const safeNotificationId = toSafeId(notificationId, '');

  updateDatabase((draft) => {
    const notification = draft.notifications.find(
      (item) => toSafeId(item.id, '') === safeNotificationId && toSafeId(item.userId, '') === safeUserId,
    );
    if (!notification) {
      return;
    }

    notification.read = true;
    notification.readAt = toSafeDate(notification.readAt ?? new Date().toISOString());
    updated = notification;
  });

  if (!updated) {
    throw new Error('Notification not found');
  }

  return withLatency(normalizeNotification(updated), 80);
};

export const markAllNotificationsAsRead = async (userId: string): Promise<number> => {
  let updatedCount = 0;
  const safeUserId = toSafeId(userId, '');

  updateDatabase((draft) => {
    draft.notifications.forEach((notification) => {
      if (toSafeId(notification.userId, '') !== safeUserId || notification.read) {
        return;
      }

      notification.read = true;
      notification.readAt = toSafeDate(notification.readAt ?? new Date().toISOString());
      updatedCount += 1;
    });
  });

  return withLatency(updatedCount, 100);
};

export const createNotification = async (input: CreateNotificationInput): Promise<AppNotification> => {
  const userId = toSafeId(input.userId, '');
  const title = toTrimmedString(input.title);
  const message = toTrimmedString(input.message);

  if (!title || !message) {
    throw new Error('Notification title and message are required');
  }

  const userExists = getDatabase().users.some((user) => user.id === userId);
  if (!userExists) {
    throw new Error('Notification target user not found');
  }

  let created: AppNotification | null = null;

  updateDatabase((draft) => {
    const normalizedRead = Boolean(input.read ?? false);
    const createdAt = new Date().toISOString();
    const notification: AppNotification = {
      id: generateId('notif'),
      userId,
      type: normalizeNotificationType(input.type),
      title,
      message,
      actionUrl: normalizeOptional(input.actionUrl),
      actionLabel: normalizeOptional(input.actionLabel),
      read: normalizedRead,
      readAt: normalizedRead ? toSafeDate(input.readAt ?? createdAt) : undefined,
      actorUserId: toOptionalString(input.actorUserId),
      entityType: normalizeNotificationEntityType(input.entityType),
      entityId: toOptionalString(input.entityId),
      createdAt,
    };

    draft.notifications.push(notification);
    created = notification;
  });

  if (!created) {
    throw new Error('Unable to create notification');
  }

  return withLatency(normalizeNotification(created), 70);
};
