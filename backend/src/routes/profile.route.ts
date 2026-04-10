import { Router } from "express";
import {
  getTeacherPublicProfile,
  listTeacherLessons,
  listTeacherReviews,
  updateMyProfile,
} from "../controllers/profile.controller";
import { authenticate } from "../middlewares/auth.middleware";

const optionalAuthenticate = (req: Parameters<typeof authenticate>[0], res: Parameters<typeof authenticate>[1], next: Parameters<typeof authenticate>[2]): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  authenticate(req, res, next);
};

export const profileRouter = Router();
export const teacherRouter = Router();

profileRouter.patch("/me", authenticate, updateMyProfile);

teacherRouter.get("/:id", getTeacherPublicProfile);
teacherRouter.get("/:id/lessons", optionalAuthenticate, listTeacherLessons);
teacherRouter.get("/:id/reviews", listTeacherReviews);
