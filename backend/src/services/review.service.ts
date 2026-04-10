import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import { UpdateReviewInput } from "../validators/review.validator";

interface ReviewView {
  id: number;
  lessonId: number;
  authorId: number;
  rating: number;
  comment: string;
  createdAt: Date;
}

const mapReview = (review: {
  id: number;
  reviewerId: number;
  lessonId: number | null;
  rating: number;
  comment: string;
  createdAt: Date;
}): ReviewView => {
  if (review.lessonId === null) {
    throw new HttpError(409, "Review is not linked to a lesson");
  }

  return {
    id: review.id,
    lessonId: review.lessonId,
    authorId: review.reviewerId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  };
};

const assertReviewOwnership = async (reviewId: number, userId: number): Promise<void> => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      reviewerId: true,
    },
  });

  if (!review) {
    throw new HttpError(404, "Review not found");
  }

  if (review.reviewerId !== userId) {
    throw new HttpError(403, "You can only manage your own reviews");
  }
};

export const updateReview = async (
  reviewId: number,
  userId: number,
  payload: UpdateReviewInput
): Promise<ReviewView> => {
  await assertReviewOwnership(reviewId, userId);

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: {
      ...(payload.rating !== undefined ? { rating: payload.rating } : {}),
      ...(payload.comment !== undefined ? { comment: payload.comment } : {}),
    },
    select: {
      id: true,
      reviewerId: true,
      lessonId: true,
      rating: true,
      comment: true,
      createdAt: true,
    },
  });

  return mapReview(updated);
};

export const deleteReview = async (reviewId: number, userId: number): Promise<void> => {
  await assertReviewOwnership(reviewId, userId);

  await prisma.review.delete({
    where: { id: reviewId },
  });
};
