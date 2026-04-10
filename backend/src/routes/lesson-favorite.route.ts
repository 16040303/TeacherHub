import { Router } from "express";
import {
  addMyLessonFavorite,
  listMyFavoriteLessonIds,
  removeMyLessonFavorite,
} from "../controllers/lesson-favorite.controller";
import { authenticate } from "../middlewares/auth.middleware";

const lessonFavoriteRouter = Router();

lessonFavoriteRouter.use(authenticate);

lessonFavoriteRouter.get("/favorites", listMyFavoriteLessonIds);
lessonFavoriteRouter.post("/:id/favorite", addMyLessonFavorite);
lessonFavoriteRouter.delete("/:id/favorite", removeMyLessonFavorite);

export default lessonFavoriteRouter;
