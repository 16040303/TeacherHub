import { LessonLifecycleStatus, OrderStatus, Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import {
  CreateLessonInput,
  CreateLessonReviewInput,
  UpdateLessonInput,
} from "../validators/lesson.validator";

type LessonReviewEligibilityReason =
  | "owner"
  | "verified_buyer"
  | "free_lesson"
  | "purchase_required"
  | "login_required";

interface LessonReviewPermission {
  canSubmit: boolean;
  reason: LessonReviewEligibilityReason;
  message: string;
}

interface LessonReviewView {
  id: number;
  lessonId: number;
  authorId: number;
  rating: number;
  comment: string;
  createdAt: Date;
  isVerifiedBuyer: boolean;
}

interface LessonDetailSnapshot {
  lesson: ReturnType<typeof mapLesson>;
  accessState: "owner" | "purchased" | "free_unlocked" | "locked";
  canDownload: boolean;
  canPurchase: boolean;
  isOwnLesson: boolean;
  hasPurchased: boolean;
  isFreeLesson: boolean;
  reviewPermission: LessonReviewPermission;
  reviews: LessonReviewView[];
}

const lessonAuthorSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

const lessonInclude = {
  author: {
    select: lessonAuthorSelect,
  },
} satisfies Prisma.LessonInclude;

type LessonWithAuthor = Prisma.LessonGetPayload<{
  include: typeof lessonInclude;
}>;

const mapLesson = (lesson: LessonWithAuthor) => ({
  id: lesson.id,
  title: lesson.title,
  description: lesson.description,
  price: Number(lesson.price),
  fileUrl: lesson.fileUrl,
  subject: lesson.subject,
  gradeLevel: lesson.gradeLevel,
  isPublished: lesson.isPublished,
  status:
    lesson.status === LessonLifecycleStatus.PUBLISHED
      ? "published"
      : lesson.status === LessonLifecycleStatus.ARCHIVED
        ? "hidden"
        : "draft",
  thumbnailUrl: lesson.thumbnailUrl,
  authorId: lesson.authorId,
  author: {
    ...lesson.author,
    role: lesson.author.role.toLowerCase(),
  },
  createdAt: lesson.createdAt,
  updatedAt: lesson.updatedAt,
});

const sanitizeUpdatePayload = (payload: UpdateLessonInput): Prisma.LessonUpdateInput => {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries);
};

const assertOwnership = async (lessonId: number, userId: number): Promise<void> => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, authorId: true },
  });

  if (!lesson) {
    throw new HttpError(404, "Lesson not found");
  }

  if (lesson.authorId !== userId) {
    throw new HttpError(403, "You can only manage your own lessons");
  }
};

const isLessonPublished = (lesson: { status: LessonLifecycleStatus; isPublished: boolean }): boolean => {
  return lesson.isPublished && lesson.status === LessonLifecycleStatus.PUBLISHED;
};

const toReviewPermission = (
  viewerId: number | null,
  lesson: { authorId: number; price: Prisma.Decimal },
  hasPaidOrder: boolean
): LessonReviewPermission => {
  if (!viewerId) {
    return {
      canSubmit: false,
      reason: "login_required",
      message: "Please sign in to submit a lesson review.",
    };
  }

  if (viewerId === lesson.authorId) {
    return {
      canSubmit: true,
      reason: "owner",
      message: "As the lesson author, you can leave an internal quality review.",
    };
  }

  if (Number(lesson.price) <= 0) {
    return {
      canSubmit: true,
      reason: "free_lesson",
      message: "This free lesson is unlocked, so you can share your review.",
    };
  }

  if (hasPaidOrder) {
    return {
      canSubmit: true,
      reason: "verified_buyer",
      message: "You purchased this lesson. Your review will be marked as verified.",
    };
  }

  return {
    canSubmit: false,
    reason: "purchase_required",
    message: "Purchase this lesson before submitting a review.",
  };
};

const mapReviewView = (review: {
  id: number;
  reviewerId: number;
  lessonId: number | null;
  rating: number;
  comment: string;
  createdAt: Date;
  lesson: {
    authorId: number;
    price: Prisma.Decimal;
    orders: {
      buyerId: number;
    }[];
  } | null;
}): LessonReviewView => {
  if (!review.lessonId || !review.lesson) {
    throw new HttpError(409, "Review is not linked to a lesson");
  }

  const isVerifiedBuyer =
    review.reviewerId === review.lesson.authorId ||
    Number(review.lesson.price) <= 0 ||
    review.lesson.orders.some((order) => order.buyerId === review.reviewerId);

  return {
    id: review.id,
    lessonId: review.lessonId,
    authorId: review.reviewerId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    isVerifiedBuyer,
  };
};

export const createLesson = async (payload: CreateLessonInput, userId: number) => {
  const lesson = await prisma.lesson.create({
    data: {
      title: payload.title,
      description: payload.description,
      price: payload.price,
      fileUrl: payload.fileUrl,
      subject: payload.subject,
      gradeLevel: payload.gradeLevel,
      isPublished: payload.isPublished ?? false,
      status: payload.isPublished ? LessonLifecycleStatus.PUBLISHED : LessonLifecycleStatus.DRAFT,
      thumbnailUrl: payload.thumbnailUrl,
      authorId: userId,
    },
    include: lessonInclude,
  });

  return mapLesson(lesson);
};

export const listLessons = async () => {
  const lessons = await prisma.lesson.findMany({
    where: {
      isPublished: true,
      status: LessonLifecycleStatus.PUBLISHED,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: lessonInclude,
  });

  return lessons.map(mapLesson);
};

export const getLessonById = async (lessonId: number) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: lessonInclude,
  });

  if (!lesson) {
    throw new HttpError(404, "Lesson not found");
  }

  if (!isLessonPublished(lesson)) {
    throw new HttpError(404, "Lesson not found");
  }

  return mapLesson(lesson);
};

export const updateLesson = async (
  lessonId: number,
  payload: UpdateLessonInput,
  userId: number
) => {
  await assertOwnership(lessonId, userId);

  const lesson = await prisma.lesson.update({
    where: { id: lessonId },
    data: sanitizeUpdatePayload(payload),
    include: lessonInclude,
  });

  return mapLesson(lesson);
};

export const deleteLesson = async (lessonId: number, userId: number): Promise<void> => {
  await assertOwnership(lessonId, userId);

  await prisma.lesson.delete({
    where: { id: lessonId },
  });
};

export const listLessonReviews = async (lessonId: number): Promise<LessonReviewView[]> => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      status: true,
      isPublished: true,
    },
  });

  if (!lesson || !isLessonPublished(lesson)) {
    throw new HttpError(404, "Lesson not found");
  }

  const reviews = await prisma.review.findMany({
    where: {
      lessonId,
    },
    select: {
      id: true,
      reviewerId: true,
      lessonId: true,
      rating: true,
      comment: true,
      createdAt: true,
      lesson: {
        select: {
          authorId: true,
          price: true,
          orders: {
            where: {
              status: OrderStatus.PAID,
            },
            select: {
              buyerId: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return reviews.map(mapReviewView);
};

export const createOrUpdateLessonReview = async (
  lessonId: number,
  userId: number,
  payload: CreateLessonReviewInput
): Promise<LessonReviewView> => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      authorId: true,
      price: true,
      status: true,
      isPublished: true,
    },
  });

  if (!lesson || !isLessonPublished(lesson)) {
    throw new HttpError(404, "Lesson not found");
  }

  const paidOrder = await prisma.order.findFirst({
    where: {
      buyerId: userId,
      lessonId,
      status: OrderStatus.PAID,
    },
    select: {
      id: true,
    },
  });

  const permission = toReviewPermission(userId, lesson, Boolean(paidOrder));

  if (!permission.canSubmit) {
    throw new HttpError(403, permission.message);
  }

  const review = await prisma.review.upsert({
    where: {
      reviewerId_lessonId: {
        reviewerId: userId,
        lessonId,
      },
    },
    update: {
      rating: payload.rating,
      comment: payload.comment,
      teacherId: lesson.authorId,
    },
    create: {
      reviewerId: userId,
      lessonId,
      teacherId: lesson.authorId,
      rating: payload.rating,
      comment: payload.comment,
    },
    select: {
      id: true,
      reviewerId: true,
      lessonId: true,
      rating: true,
      comment: true,
      createdAt: true,
      lesson: {
        select: {
          authorId: true,
          price: true,
          orders: {
            where: {
              status: OrderStatus.PAID,
            },
            select: {
              buyerId: true,
            },
          },
        },
      },
    },
  });

  return mapReviewView(review);
};

export const getLessonDetailSnapshot = async (
  lessonId: number,
  viewerId: number | null
): Promise<LessonDetailSnapshot> => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: lessonInclude,
  });

  if (!lesson || !isLessonPublished(lesson)) {
    throw new HttpError(404, "Lesson not found");
  }

  const isOwnLesson = viewerId !== null && viewerId === lesson.authorId;
  const isFreeLesson = Number(lesson.price) <= 0;

  const paidOrder = viewerId
    ? await prisma.order.findFirst({
        where: {
          buyerId: viewerId,
          lessonId,
          status: OrderStatus.PAID,
        },
        select: {
          id: true,
        },
      })
    : null;

  const hasPurchased = Boolean(paidOrder);
  const canDownload = isOwnLesson || isFreeLesson || hasPurchased;
  const canPurchase = !isOwnLesson && !isFreeLesson && !hasPurchased;

  const reviews = await listLessonReviews(lessonId);

  return {
    lesson: mapLesson(lesson),
    accessState: isOwnLesson
      ? "owner"
      : canDownload
        ? isFreeLesson
          ? "free_unlocked"
          : "purchased"
        : "locked",
    canDownload,
    canPurchase,
    isOwnLesson,
    hasPurchased,
    isFreeLesson,
    reviewPermission: toReviewPermission(viewerId, lesson, hasPurchased),
    reviews,
  };
};
