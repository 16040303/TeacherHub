import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as profileService from "../services/profile.service";
import { handleControllerError } from "../utils/controller-error";
import { sendSuccess } from "../utils/response";
import {
  teacherIdParamSchema,
  teacherLessonsQuerySchema,
  updateMyProfileSchema,
} from "../validators/profile.validator";

const getOptionalAuthUserId = (req: Request): number | null => {
  const authReq = req as Partial<AuthRequest>;
  return authReq.user?.userId ?? null;
};

export const updateMyProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = updateMyProfileSchema.parse(req.body);
    const authReq = req as AuthRequest;

    const profile = await profileService.updateMyProfile(authReq.user.userId, payload);

    sendSuccess(res, {
      message: "Profile updated successfully",
      data: profile,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getTeacherPublicProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = teacherIdParamSchema.parse(req.params);
    const teacher = await profileService.getTeacherPublicProfile(id);

    sendSuccess(res, {
      message: "Teacher profile retrieved successfully",
      data: teacher,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listTeacherLessons = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = teacherIdParamSchema.parse(req.params);
    const query = teacherLessonsQuerySchema.parse(req.query);

    const lessons = await profileService.listTeacherLessons(
      id,
      getOptionalAuthUserId(req),
      query
    );

    sendSuccess(res, {
      message: "Teacher lessons retrieved successfully",
      data: lessons,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listTeacherReviews = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = teacherIdParamSchema.parse(req.params);
    const reviews = await profileService.listTeacherReviews(id);

    sendSuccess(res, {
      message: "Teacher reviews retrieved successfully",
      data: reviews,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};
