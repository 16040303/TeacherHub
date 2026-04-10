import { Router } from "express";
import {
  createCommunityComment,
  createCommunityPost,
  createCommunityReport,
  deleteCommunityComment,
  deleteCommunityPost,
  getCommunityPostDetail,
  listCommunityCommentCounts,
  listCommunityComments,
  listCommunityPosts,
  listTrendingTopics,
  toggleCommunityPostLike,
  toggleCommunityPostSave,
  updateCommunityComment,
  updateCommunityPost,
} from "../controllers/community.controller";
import { authenticate } from "../middlewares/auth.middleware";

const communityRouter = Router();

communityRouter.get("/posts", listCommunityPosts);
communityRouter.get("/posts/:id", getCommunityPostDetail);
communityRouter.post("/posts", authenticate, createCommunityPost);
communityRouter.patch("/posts/:id", authenticate, updateCommunityPost);
communityRouter.delete("/posts/:id", authenticate, deleteCommunityPost);
communityRouter.post("/posts/:id/like", authenticate, toggleCommunityPostLike);
communityRouter.post("/posts/:id/save", authenticate, toggleCommunityPostSave);

communityRouter.get("/posts/:id/comments", listCommunityComments);
communityRouter.post("/posts/:id/comments", authenticate, createCommunityComment);
communityRouter.patch("/comments/:id", authenticate, updateCommunityComment);
communityRouter.delete("/comments/:id", authenticate, deleteCommunityComment);
communityRouter.get("/comments/counts", listCommunityCommentCounts);

communityRouter.get("/topics/trending", listTrendingTopics);
communityRouter.post("/reports", authenticate, createCommunityReport);

export default communityRouter;
