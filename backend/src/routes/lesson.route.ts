import { Router } from "express";
import {
  createLesson,
  createLessonReview,
  deleteLesson,
  getLessonDetail,
  getLessonSnapshot,
  listLessonReviews,
  listLessons,
  updateLesson,
} from "../controllers/lesson.controller";
import { authenticate, optionalAuthenticate } from "../middlewares/auth.middleware";

const lessonRouter = Router();

lessonRouter.get("/", listLessons);
lessonRouter.get("/:id", getLessonDetail);
lessonRouter.get("/:id/snapshot", optionalAuthenticate, getLessonSnapshot);
lessonRouter.get("/:id/reviews", listLessonReviews);
lessonRouter.post("/:id/reviews", authenticate, createLessonReview);
lessonRouter.post("/", authenticate, createLesson);
lessonRouter.patch("/:id", authenticate, updateLesson);
lessonRouter.delete("/:id", authenticate, deleteLesson);

export default lessonRouter;
