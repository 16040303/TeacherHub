import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import * as communityService from "../services/community.service";
import { handleControllerError } from "../utils/controller-error";
import { sendSuccess } from "../utils/response";
import {
  commentIdParamSchema,
  communityCommentCountsQuerySchema,
  createCommunityCommentSchema,
  createCommunityPostSchema,
  createCommunityReportSchema,
  listCommunityPostsQuerySchema,
  postIdParamSchema,
  updateCommunityCommentSchema,
  updateCommunityPostSchema,
} from "../validators/community.validator";

export const listCommunityPosts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = listCommunityPostsQuerySchema.parse(req.query);
    const posts = await communityService.listCommunityPosts(query);

    sendSuccess(res, {
      message: "Community posts retrieved successfully",
      data: posts,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const getCommunityPostDetail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = postIdParamSchema.parse(req.params);
    const post = await communityService.getCommunityPostById(id);

    sendSuccess(res, {
      message: "Community post retrieved successfully",
      data: post,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const createCommunityPost = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const payload = createCommunityPostSchema.parse(req.body);
    const authReq = req as AuthRequest;

    const post = await communityService.createCommunityPost(
      authReq.user.userId,
      payload
    );

    sendSuccess(res, {
      statusCode: 201,
      message: "Community post created successfully",
      data: post,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const updateCommunityPost = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = postIdParamSchema.parse(req.params);
    const payload = updateCommunityPostSchema.parse(req.body);
    const authReq = req as AuthRequest;

    const post = await communityService.updateCommunityPost(
      id,
      authReq.user.userId,
      payload
    );

    sendSuccess(res, {
      message: "Community post updated successfully",
      data: post,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const deleteCommunityPost = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = postIdParamSchema.parse(req.params);
    const authReq = req as AuthRequest;

    await communityService.deleteCommunityPost(id, authReq.user.userId);

    sendSuccess(res, {
      message: "Community post deleted successfully",
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const toggleCommunityPostLike = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = postIdParamSchema.parse(req.params);
    const authReq = req as AuthRequest;

    const post = await communityService.toggleCommunityPostLike(
      id,
      authReq.user.userId
    );

    sendSuccess(res, {
      message: "Community post like status updated successfully",
      data: post,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const toggleCommunityPostSave = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = postIdParamSchema.parse(req.params);
    const authReq = req as AuthRequest;

    const post = await communityService.toggleCommunityPostSave(
      id,
      authReq.user.userId
    );

    sendSuccess(res, {
      message: "Community post save status updated successfully",
      data: post,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listCommunityComments = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = postIdParamSchema.parse(req.params);
    const comments = await communityService.listCommunityComments(id);

    sendSuccess(res, {
      message: "Community comments retrieved successfully",
      data: comments,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const createCommunityComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = postIdParamSchema.parse(req.params);
    const payload = createCommunityCommentSchema.parse(req.body);
    const authReq = req as AuthRequest;

    const comment = await communityService.createCommunityComment(
      id,
      authReq.user.userId,
      payload
    );

    sendSuccess(res, {
      statusCode: 201,
      message: "Community comment created successfully",
      data: comment,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listCommunityCommentCounts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const query = communityCommentCountsQuerySchema.parse(req.query);
    const counts = await communityService.listCommunityCommentCounts(query.postIds);

    sendSuccess(res, {
      message: "Community comment counts retrieved successfully",
      data: counts,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const updateCommunityComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = commentIdParamSchema.parse(req.params);
    const payload = updateCommunityCommentSchema.parse(req.body);
    const authReq = req as AuthRequest;

    const comment = await communityService.updateCommunityComment(
      id,
      authReq.user.userId,
      payload
    );

    sendSuccess(res, {
      message: "Community comment updated successfully",
      data: comment,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const deleteCommunityComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = commentIdParamSchema.parse(req.params);
    const authReq = req as AuthRequest;

    await communityService.deleteCommunityComment(id, authReq.user.userId);

    sendSuccess(res, {
      message: "Community comment deleted successfully",
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const listTrendingTopics = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const topics = await communityService.listTrendingTopics();

    sendSuccess(res, {
      message: "Trending topics retrieved successfully",
      data: topics,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const createCommunityReport = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const payload = createCommunityReportSchema.parse(req.body);
    const authReq = req as AuthRequest;

    const report = await communityService.createCommunityReport(
      authReq.user.userId,
      payload
    );

    sendSuccess(res, {
      statusCode: 201,
      message: "Report submitted successfully",
      data: report,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};
