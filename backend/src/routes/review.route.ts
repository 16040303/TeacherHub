import { Router } from "express";
import { deleteReview, updateReview } from "../controllers/review.controller";
import { authenticate } from "../middlewares/auth.middleware";

const reviewRouter = Router();

reviewRouter.use(authenticate);

reviewRouter.patch("/:id", updateReview);
reviewRouter.delete("/:id", deleteReview);

export default reviewRouter;
