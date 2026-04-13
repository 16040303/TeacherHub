import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as lessonService from "../services/lesson.service";
import { handleControllerError } from "../utils/controller-error";
import { sendSuccess } from "../utils/response";
import {
  createLessonReviewSchema,
  createLessonSchema,
  lessonIdParamSchema,
  updateLessonSchema,
} from "../validators/lesson.validator";

const getOptionalAuthUserId = (req: Request): number | null => {
  const authReq = req as Partial<AuthRequest>;
  return authReq.user?.userId ?? null;
};

export const createLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = createLessonSchema.parse(req.body);
    const authReq = req as AuthRequest;
    const lesson = await lessonService.createLesson(payload, authReq.user.userId);

    sendSuccess(res, {
      statusCode: 201,
      message: "Lesson created successfully",
      data: lesson,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listLessons = async (_req: Request, res: Response): Promise<void> => {
  try {
    const lessons = await lessonService.listLessons();

    sendSuccess(res, {
      message: "Lessons retrieved successfully",
      data: lessons,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getLessonDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = lessonIdParamSchema.parse(req.params);
    const lesson = await lessonService.getLessonById(id);

    sendSuccess(res, {
      message: "Lesson retrieved successfully",
      data: lesson,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getLessonSnapshot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = lessonIdParamSchema.parse(req.params);
    const snapshot = await lessonService.getLessonDetailSnapshot(
      id,
      getOptionalAuthUserId(req)
    );

    sendSuccess(res, {
      message: "Lesson snapshot retrieved successfully",
      data: snapshot,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listLessonReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = lessonIdParamSchema.parse(req.params);
    const reviews = await lessonService.listLessonReviews(id);

    sendSuccess(res, {
      message: "Lesson reviews retrieved successfully",
      data: reviews,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const createLessonReview = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = lessonIdParamSchema.parse(req.params);
    const payload = createLessonReviewSchema.parse(req.body);
    const authReq = req as AuthRequest;

    const review = await lessonService.createOrUpdateLessonReview(
      id,
      authReq.user.userId,
      payload
    );

    sendSuccess(res, {
      statusCode: 201,
      message: "Lesson review submitted successfully",
      data: review,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const updateLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = lessonIdParamSchema.parse(req.params);
    const payload = updateLessonSchema.parse(req.body);
    const authReq = req as AuthRequest;

    const lesson = await lessonService.updateLesson(id, payload, authReq.user.userId);

    sendSuccess(res, {
      message: "Lesson updated successfully",
      data: lesson,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const deleteLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = lessonIdParamSchema.parse(req.params);
    const authReq = req as AuthRequest;

    await lessonService.deleteLesson(id, authReq.user.userId);

    sendSuccess(res, {
      message: "Lesson deleted successfully",
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};
