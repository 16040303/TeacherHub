import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as followService from "../services/follow.service";
import { handleControllerError } from "../utils/controller-error";
import { followUserIdParamSchema } from "../validators/follow.validator";

export const listFollowingIds = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = followUserIdParamSchema.parse(req.params);
    const followingIds = await followService.listFollowingIds(userId);

    res.status(200).json({
      message: "Following list retrieved successfully",
      data: followingIds,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listFollowerIds = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = followUserIdParamSchema.parse(req.params);
    const followerIds = await followService.listFollowerIds(userId);

    res.status(200).json({
      message: "Follower list retrieved successfully",
      data: followerIds,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getFollowCounts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = followUserIdParamSchema.parse(req.params);
    const counts = await followService.getFollowCounts(userId);

    res.status(200).json({
      message: "Follow counts retrieved successfully",
      data: counts,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getFollowStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = followUserIdParamSchema.parse(req.params);
    const authReq = req as AuthRequest;

    const isFollowing = await followService.isFollowingUser(
      authReq.user.userId,
      userId
    );

    res.status(200).json({
      message: "Follow relation status retrieved successfully",
      data: {
        isFollowing,
      },
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const followUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = followUserIdParamSchema.parse(req.params);
    const authReq = req as AuthRequest;

    await followService.followUser(authReq.user.userId, userId);

    res.status(200).json({
      message: "User followed successfully",
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const unfollowUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = followUserIdParamSchema.parse(req.params);
    const authReq = req as AuthRequest;

    await followService.unfollowUser(authReq.user.userId, userId);

    res.status(200).json({
      message: "User unfollowed successfully",
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};
