import { UserRole } from "@prisma/client";
import { Router } from "express";
import {
  getAdminDashboardSnapshot,
  getAdminDashboardStats,
  getAdminLessonForModeration,
  getAdminUser,
  listAdminCommunityForModeration,
  listAdminLessonsForModeration,
  listAdminOrders,
  listAdminRecentTransactions,
  listAdminReports,
  listAdminUsers,
  moderateAdminLesson,
  removeAdminCommunityContent,
  updateAdminReport,
  updateAdminUser,
} from "../controllers/admin.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const adminRouter = Router();

adminRouter.use(authenticate);
adminRouter.use(authorize(UserRole.ADMIN));

adminRouter.get("/dashboard", getAdminDashboardSnapshot);
adminRouter.get("/dashboard/stats", getAdminDashboardStats);
adminRouter.get("/users", listAdminUsers);
adminRouter.get("/users/:id", getAdminUser);
adminRouter.patch("/users/:id", updateAdminUser);
adminRouter.get("/lessons", listAdminLessonsForModeration);
adminRouter.get("/lessons/:id", getAdminLessonForModeration);
adminRouter.patch("/lessons/:id/moderate", moderateAdminLesson);
adminRouter.get("/community", listAdminCommunityForModeration);
adminRouter.delete("/community/:contentType/:id", removeAdminCommunityContent);
adminRouter.get("/reports", listAdminReports);
adminRouter.patch("/reports/:id", updateAdminReport);
adminRouter.get("/orders", listAdminOrders);
adminRouter.get("/transactions", listAdminRecentTransactions);

export default adminRouter;
