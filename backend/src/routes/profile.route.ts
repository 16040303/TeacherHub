import { Router } from "express";
import {
  getTeacherPublicProfile,
  listTeacherLessons,
  listTeacherReviews,
  updateMyProfile,
} from "../controllers/profile.controller";
import { authenticate, optionalAuthenticate } from "../middlewares/auth.middleware";


export const profileRouter = Router();
export const teacherRouter = Router();

profileRouter.patch("/me", authenticate, updateMyProfile);

teacherRouter.get("/:id", getTeacherPublicProfile);
teacherRouter.get("/:id/lessons", optionalAuthenticate, listTeacherLessons);
teacherRouter.get("/:id/reviews", listTeacherReviews);
