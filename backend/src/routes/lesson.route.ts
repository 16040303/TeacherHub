import { NextFunction, Request, Response, Router } from "express";
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
import { authenticate } from "../middlewares/auth.middleware";

const lessonRouter = Router();

const optionalAuthenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  authenticate(req, res, next);
};

lessonRouter.get("/", listLessons);
lessonRouter.get("/:id", getLessonDetail);
lessonRouter.get("/:id/snapshot", optionalAuthenticate, getLessonSnapshot);
lessonRouter.get("/:id/reviews", listLessonReviews);
lessonRouter.post("/:id/reviews", authenticate, createLessonReview);
lessonRouter.post("/", authenticate, createLesson);
lessonRouter.patch("/:id", authenticate, updateLesson);
lessonRouter.delete("/:id", authenticate, deleteLesson);

export default lessonRouter;
