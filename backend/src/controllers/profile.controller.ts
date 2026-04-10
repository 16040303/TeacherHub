import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as profileService from "../services/profile.service";
import { handleControllerError } from "../utils/controller-error";
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

    res.status(200).json({
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

    res.status(200).json({
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

    res.status(200).json({
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

    res.status(200).json({
      message: "Teacher reviews retrieved successfully",
      data: reviews,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};
