import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as notificationService from "../services/notification.service";
import { handleControllerError } from "../utils/controller-error";
import { sendSuccess } from "../utils/response";
import { notificationIdParamSchema } from "../validators/notification.validator";

const getUserId = (req: Request): number => {
  return (req as AuthRequest).user.userId;
};

export const listMyNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const notifications = await notificationService.listNotifications(getUserId(req));

    sendSuccess(res, {
      message: "Notifications retrieved successfully",
      data: notifications,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const markMyNotificationAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = notificationIdParamSchema.parse(req.params);
    const notification = await notificationService.markNotificationAsRead(
      getUserId(req),
      id
    );

    sendSuccess(res, {
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const markAllMyNotificationsAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const updatedCount = await notificationService.markAllNotificationsAsRead(
      getUserId(req)
    );

    sendSuccess(res, {
      message: "Notifications marked as read",
      data: updatedCount,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};
