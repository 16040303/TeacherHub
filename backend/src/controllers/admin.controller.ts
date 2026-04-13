import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as adminService from "../services/admin.service";
import { handleControllerError } from "../utils/controller-error";
import { HttpError } from "../utils/http-error";
import { sendSuccess } from "../utils/response";
import {
  adminReportIdParamSchema,
  adminUserIdParamSchema,
  dashboardSnapshotQuerySchema,
  lessonIdParamSchema,
  listAdminOrdersQuerySchema,
  listAdminReportsQuerySchema,
  listAdminUsersQuerySchema,
  listCommunityModerationQuerySchema,
  listLessonsForModerationQuerySchema,
  listRecentTransactionsQuerySchema,
  moderateLessonSchema,
  removeCommunityContentParamSchema,
  updateAdminReportSchema,
  updateAdminUserSchema,
} from "../validators/admin.validator";

const getAdminUserId = (req: Request): number => {
  return (req as AuthRequest).user.userId;
};

export const getAdminDashboardSnapshot = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = dashboardSnapshotQuerySchema.parse(req.query);
    const snapshot = await adminService.getAdminDashboardSnapshot(query);

    sendSuccess(res, {
      message: "Admin dashboard snapshot retrieved successfully",
      data: snapshot,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getAdminDashboardStats = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const stats = await adminService.getDashboardStats();

    sendSuccess(res, {
      message: "Admin dashboard stats retrieved successfully",
      data: stats,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listAdminUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = listAdminUsersQuerySchema.parse(req.query);
    const users = await adminService.listUsersForAdmin(query);

    sendSuccess(res, {
      message: "Admin users retrieved successfully",
      data: users,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getAdminUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = adminUserIdParamSchema.parse(req.params);
    const user = await adminService.getUserForAdmin(id);

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    sendSuccess(res, {
      message: "Admin user retrieved successfully",
      data: user,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const updateAdminUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = adminUserIdParamSchema.parse(req.params);
    const payload = updateAdminUserSchema.parse(req.body);
    const user = await adminService.updateUserAsAdmin(id, payload);

    sendSuccess(res, {
      message: "Admin user updated successfully",
      data: user,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listAdminLessonsForModeration = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = listLessonsForModerationQuerySchema.parse(req.query);
    const lessons = await adminService.listLessonsForModeration(query);

    sendSuccess(res, {
      message: "Admin lesson moderation list retrieved successfully",
      data: lessons,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getAdminLessonForModeration = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = lessonIdParamSchema.parse(req.params);
    const lesson = await adminService.getLessonForModeration(id);

    if (!lesson) {
      throw new HttpError(404, "Lesson not found");
    }

    sendSuccess(res, {
      message: "Admin lesson moderation detail retrieved successfully",
      data: lesson,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const moderateAdminLesson = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = lessonIdParamSchema.parse(req.params);
    const payload = moderateLessonSchema.parse(req.body);
    const updated = await adminService.moderateLessonAsAdmin(
      id,
      payload,
      getAdminUserId(req)
    );

    sendSuccess(res, {
      message: "Lesson moderation updated successfully",
      data: updated,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listAdminRecentTransactions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = listRecentTransactionsQuerySchema.parse(req.query);
    const transactions = await adminService.listRecentTransactions(query);

    sendSuccess(res, {
      message: "Recent transactions retrieved successfully",
      data: transactions,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listAdminCommunityForModeration = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = listCommunityModerationQuerySchema.parse(req.query);
    const items = await adminService.listCommunityForModeration(query);

    sendSuccess(res, {
      message: "Community moderation content retrieved successfully",
      data: items,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const removeAdminCommunityContent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id, contentType } = removeCommunityContentParamSchema.parse(req.params);
    await adminService.removeCommunityContent(id, contentType);

    sendSuccess(res, {
      message: "Community content removed successfully",
      data: null,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listAdminReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = listAdminReportsQuerySchema.parse(req.query);
    const reports = await adminService.listReportsForAdmin(query);

    sendSuccess(res, {
      message: "Admin reports retrieved successfully",
      data: reports,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const updateAdminReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = adminReportIdParamSchema.parse(req.params);
    const payload = updateAdminReportSchema.parse(req.body);
    const report = await adminService.updateReportAsAdmin(
      id,
      payload,
      getAdminUserId(req)
    );

    sendSuccess(res, {
      message: "Admin report updated successfully",
      data: report,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listAdminOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = listAdminOrdersQuerySchema.parse(req.query);
    const orders = await adminService.listOrdersForAdmin(query);

    sendSuccess(res, {
      message: "Admin orders retrieved successfully",
      data: orders,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};
