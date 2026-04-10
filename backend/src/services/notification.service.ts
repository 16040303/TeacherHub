import { NotificationType, Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";

type AppNotificationType = "system" | "follow" | "community" | "order";
type AppNotificationEntityType = "order" | "lesson" | "post" | "comment" | "user" | "system";

export interface NotificationView {
  id: number;
  userId: number;
  type: AppNotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
  actorUserId?: number;
  entityType?: AppNotificationEntityType;
  entityId?: number;
}

export interface CreateNotificationInput {
  userId: number;
  actorId?: number;
  type: NotificationType;
  title: string;
  content: string;
  actionUrl?: string;
  actionLabel?: string;
  entityType?: AppNotificationEntityType;
  entityId?: number;
  metadata?: Prisma.InputJsonValue;
}

const notificationSelect = {
  id: true,
  userId: true,
  actorId: true,
  type: true,
  title: true,
  content: true,
  actionUrl: true,
  actionLabel: true,
  entityType: true,
  entityId: true,
  isRead: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

const toNotificationType = (type: NotificationType): AppNotificationType => {
  switch (type) {
    case NotificationType.FOLLOW:
      return "follow";
    case NotificationType.COMMENT:
    case NotificationType.REPORT:
      return "community";
    case NotificationType.ORDER:
    case NotificationType.PAYMENT:
      return "order";
    case NotificationType.LESSON:
    case NotificationType.REVIEW:
    case NotificationType.SYSTEM:
    default:
      return "system";
  }
};

const toEntityType = (value: string | null): AppNotificationEntityType | undefined => {
  if (
    value === "order" ||
    value === "lesson" ||
    value === "post" ||
    value === "comment" ||
    value === "user" ||
    value === "system"
  ) {
    return value;
  }

  return undefined;
};

const mapNotification = (notification: NotificationRecord): NotificationView => ({
  id: notification.id,
  userId: notification.userId,
  type: toNotificationType(notification.type),
  title: notification.title,
  message: notification.content ?? "",
  actionUrl: notification.actionUrl ?? undefined,
  actionLabel: notification.actionLabel ?? undefined,
  read: notification.isRead,
  createdAt: notification.createdAt,
  readAt: notification.readAt ?? undefined,
  actorUserId: notification.actorId ?? undefined,
  entityType: toEntityType(notification.entityType),
  entityId: notification.entityId ?? undefined,
});

export const listNotifications = async (userId: number): Promise<NotificationView[]> => {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: notificationSelect,
  });

  return notifications.map(mapNotification);
};

export const markNotificationAsRead = async (
  userId: number,
  notificationId: number
): Promise<NotificationView> => {
  const existing = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
    select: notificationSelect,
  });

  if (!existing) {
    throw new HttpError(404, "Notification not found");
  }

  if (existing.isRead) {
    return mapNotification(existing);
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: existing.readAt ?? new Date(),
    },
    select: notificationSelect,
  });

  return mapNotification(updated);
};

export const markAllNotificationsAsRead = async (userId: number): Promise<number> => {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return result.count;
};

export const createNotification = async (input: CreateNotificationInput): Promise<void> => {
  if (input.actorId && input.actorId === input.userId) {
    return;
  }

  const title = input.title.trim();
  const content = input.content.trim();

  if (!title || !content) {
    return;
  }

  await prisma.notification.create({
    data: {
      userId: input.userId,
      actorId: input.actorId ?? null,
      type: input.type,
      title,
      content,
      actionUrl: input.actionUrl,
      actionLabel: input.actionLabel,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  });
};

export const createNotificationSafely = async (
  input: CreateNotificationInput
): Promise<void> => {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};
