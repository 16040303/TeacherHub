import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as reviewService from "../services/review.service";
import { handleControllerError } from "../utils/controller-error";
import { sendSuccess } from "../utils/response";
import { reviewIdParamSchema, updateReviewSchema } from "../validators/review.validator";

export const updateReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = reviewIdParamSchema.parse(req.params);
    const payload = updateReviewSchema.parse(req.body);
    const authReq = req as AuthRequest;

    const review = await reviewService.updateReview(id, authReq.user.userId, payload);

    sendSuccess(res, {
      message: "Review updated successfully",
      data: review,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const deleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = reviewIdParamSchema.parse(req.params);
    const authReq = req as AuthRequest;

    await reviewService.deleteReview(id, authReq.user.userId);

    sendSuccess(res, {
      message: "Review deleted successfully",
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};
