import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as lessonFavoriteService from "../services/lesson-favorite.service";
import { handleControllerError } from "../utils/controller-error";
import { lessonFavoriteLessonIdParamSchema } from "../validators/lesson-favorite.validator";

const getUserId = (req: Request): number => {
  return (req as AuthRequest).user.userId;
};

export const listMyFavoriteLessonIds = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const lessonIds = await lessonFavoriteService.listFavoriteLessonIds(getUserId(req));

    res.status(200).json({
      message: "Favorite lessons retrieved successfully",
      data: lessonIds,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const addMyLessonFavorite = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = lessonFavoriteLessonIdParamSchema.parse(req.params);
    const result = await lessonFavoriteService.addLessonFavorite(getUserId(req), id);

    res.status(200).json({
      message: "Lesson added to favorites",
      data: result,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const removeMyLessonFavorite = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = lessonFavoriteLessonIdParamSchema.parse(req.params);
    const result = await lessonFavoriteService.removeLessonFavorite(getUserId(req), id);

    res.status(200).json({
      message: "Lesson removed from favorites",
      data: result,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};
