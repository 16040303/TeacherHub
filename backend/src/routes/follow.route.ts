import { Router } from "express";
import {
  followUser,
  getFollowCounts,
  getFollowStatus,
  listFollowerIds,
  listFollowingIds,
  unfollowUser,
} from "../controllers/follow.controller";
import { authenticate } from "../middlewares/auth.middleware";

const followRouter = Router();

followRouter.get("/:userId/following", listFollowingIds);
followRouter.get("/:userId/followers", listFollowerIds);
followRouter.get("/:userId/counts", getFollowCounts);

followRouter.get("/:userId/status", authenticate, getFollowStatus);
followRouter.post("/:userId", authenticate, followUser);
followRouter.delete("/:userId", authenticate, unfollowUser);

export default followRouter;
