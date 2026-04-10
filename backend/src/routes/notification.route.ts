import { Router } from "express";
import {
  listMyNotifications,
  markAllMyNotificationsAsRead,
  markMyNotificationAsRead,
} from "../controllers/notification.controller";
import { authenticate } from "../middlewares/auth.middleware";

const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get("/", listMyNotifications);
notificationRouter.patch("/read-all", markAllMyNotificationsAsRead);
notificationRouter.patch("/:id/read", markMyNotificationAsRead);

export default notificationRouter;
