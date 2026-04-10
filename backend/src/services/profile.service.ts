import { LessonLifecycleStatus, ModerationStatus, Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import {
  TeacherLessonsQueryInput,
  UpdateMyProfileInput,
} from "../validators/profile.validator";

type SocialLinkItem = {
  platform: string;
  url: string;
};

interface TeacherStatsView {
  sharedLessons: number;
  totalDownloads: number;
  averageRating: number;
  followers: number;
  following: number;
}

interface TeacherPublicProfileView {
  id: number;
  name: string;
  avatar: string | null;
  subject: string | null;
  experience: string | null;
  location: string | null;
  bio: string | null;
  stats: TeacherStatsView;
}

interface TeacherLessonView {
  id: number;
  authorId: number;
  title: string;
  description: string | null;
  subject: string | null;
  gradeLevel: string | null;
  downloads: number;
  rating: number;
  reviewCount: number;
  thumbnail: string | null;
  price: number;
  status: "draft" | "published" | "hidden";
  createdAt: Date;
  updatedAt: Date;
}

interface TeacherReviewItemView {
  review: {
    id: number;
    lessonId: number;
    authorId: number;
    rating: number;
    comment: string;
    createdAt: Date;
    isVerifiedBuyer: boolean;
  };
  lessonTitle: string;
  reviewer: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    status: string;
    avatarUrl: string | null;
    bio: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

interface MyProfileView {
  id: number;
  fullName: string;
  email: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  bio: string | null;
  headline: string | null;
  expertise: string | null;
  yearsExperience: number | null;
  location: string | null;
  socialLinks: SocialLinkItem[];
  createdAt: Date;
  updatedAt: Date;
}

const lessonLifecycleToView = (
  status: LessonLifecycleStatus
): "draft" | "published" | "hidden" => {
  switch (status) {
    case LessonLifecycleStatus.PUBLISHED:
      return "published";
    case LessonLifecycleStatus.ARCHIVED:
      return "hidden";
    case LessonLifecycleStatus.DRAFT:
    default:
      return "draft";
  }
};

const parseSocialLinks = (value: string | null): SocialLinkItem[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is SocialLinkItem => {
        if (!item || typeof item !== "object") {
          return false;
        }

        const typed = item as Record<string, unknown>;
        return (
          typeof typed.platform === "string" &&
          typed.platform.trim().length > 0 &&
          typeof typed.url === "string" &&
          typed.url.trim().length > 0
        );
      })
      .map((item) => ({
        platform: item.platform.trim(),
        url: item.url.trim(),
      }));
  } catch {
    return [];
  }
};

const toExperienceLabel = (yearsExperience: number | null): string | null => {
  if (yearsExperience === null || yearsExperience === undefined) {
    return null;
  }

  if (yearsExperience <= 0) {
    return "Less than 1 year";
  }

  if (yearsExperience === 1) {
    return "1 year";
  }

  return `${yearsExperience} years`;
};

const mapMyProfileView = (
  user: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    status: string;
    avatarUrl: string | null;
    bio: string | null;
    createdAt: Date;
    updatedAt: Date;
    teacherProfile: {
      headline: string | null;
      expertise: string | null;
      yearsExperience: number | null;
      location: string | null;
      socialLinks: string | null;
    } | null;
  }
): MyProfileView => {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role.toLowerCase(),
    status: user.status.toLowerCase(),
    avatarUrl: user.avatarUrl,
    bio: user.teacherProfile?.headline ? user.bio : user.bio,
    headline: user.teacherProfile?.headline ?? null,
    expertise: user.teacherProfile?.expertise ?? null,
    yearsExperience: user.teacherProfile?.yearsExperience ?? null,
    location: user.teacherProfile?.location ?? null,
    socialLinks: parseSocialLinks(user.teacherProfile?.socialLinks ?? null),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const updateMyProfile = async (
  userId: number,
  payload: UpdateMyProfileInput
): Promise<MyProfileView> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
      updatedAt: true,
      teacherProfile: {
        select: {
          headline: true,
          expertise: true,
          yearsExperience: true,
          location: true,
          socialLinks: true,
        },
      },
    },
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  const teacherProfilePatch: Prisma.TeacherProfileUncheckedUpdateInput = {};
  let shouldPatchTeacherProfile = false;

  if (payload.headline !== undefined) {
    teacherProfilePatch.headline = payload.headline;
    shouldPatchTeacherProfile = true;
  }

  if (payload.expertise !== undefined) {
    teacherProfilePatch.expertise = payload.expertise;
    shouldPatchTeacherProfile = true;
  }

  if (payload.yearsExperience !== undefined) {
    teacherProfilePatch.yearsExperience = payload.yearsExperience;
    shouldPatchTeacherProfile = true;
  }

  if (payload.location !== undefined) {
    teacherProfilePatch.location = payload.location;
    shouldPatchTeacherProfile = true;
  }

  if (payload.socialLinks !== undefined) {
    teacherProfilePatch.socialLinks = JSON.stringify(payload.socialLinks);
    shouldPatchTeacherProfile = true;
  }

  const userPatch: Prisma.UserUpdateInput = {};

  if (payload.fullName !== undefined) {
    userPatch.fullName = payload.fullName;
  }

  if (payload.avatarUrl !== undefined) {
    userPatch.avatarUrl = payload.avatarUrl;
    if (!shouldPatchTeacherProfile) {
      teacherProfilePatch.avatarUrl = payload.avatarUrl;
      shouldPatchTeacherProfile = true;
    } else {
      teacherProfilePatch.avatarUrl = payload.avatarUrl;
    }
  }

  if (payload.bio !== undefined) {
    userPatch.bio = payload.bio;
    teacherProfilePatch.about = payload.bio;
    shouldPatchTeacherProfile = true;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userPatch).length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: userPatch,
      });
    }

    if (shouldPatchTeacherProfile) {
      await tx.teacherProfile.upsert({
        where: { userId },
        update: teacherProfilePatch,
        create: {
          userId,
          headline:
            payload.headline ?? user.teacherProfile?.headline ?? null,
          expertise:
            payload.expertise ?? user.teacherProfile?.expertise ?? null,
          yearsExperience:
            payload.yearsExperience ??
            user.teacherProfile?.yearsExperience ??
            null,
          location:
            payload.location ?? user.teacherProfile?.location ?? null,
          socialLinks:
            payload.socialLinks !== undefined
              ? JSON.stringify(payload.socialLinks)
              : user.teacherProfile?.socialLinks ?? null,
          avatarUrl: payload.avatarUrl ?? user.avatarUrl,
          about: payload.bio ?? user.bio ?? null,
          moderationStatus: ModerationStatus.APPROVED,
        },
      });
    }
  });

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
      updatedAt: true,
      teacherProfile: {
        select: {
          headline: true,
          expertise: true,
          yearsExperience: true,
          location: true,
          socialLinks: true,
        },
      },
    },
  });

  if (!updated) {
    throw new HttpError(500, "Failed to update profile");
  }

  return mapMyProfileView(updated);
};

export const getTeacherPublicProfile = async (
  teacherId: number
): Promise<TeacherPublicProfileView> => {
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      bio: true,
      teacherProfile: {
        select: {
          avatarUrl: true,
          headline: true,
          location: true,
          yearsExperience: true,
        },
      },
      _count: {
        select: {
          followers: true,
          following: true,
        },
      },
      lessons: {
        where: {
          status: LessonLifecycleStatus.PUBLISHED,
          isPublished: true,
        },
        select: {
          id: true,
          reviews: {
            select: {
              rating: true,
            },
          },
          orders: {
            where: {
              status: "PAID",
            },
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!teacher) {
    throw new HttpError(404, "Teacher not found");
  }

  const sharedLessons = teacher.lessons.length;
  const totalDownloads = teacher.lessons.reduce((sum, lesson) => {
    return sum + lesson.orders.length;
  }, 0);

  const ratings = teacher.lessons.flatMap((lesson) =>
    lesson.reviews.map((review) => review.rating)
  );

  const averageRating =
    ratings.length === 0
      ? 0
      : Number(
          (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1)
        );

  return {
    id: teacher.id,
    name: teacher.fullName,
    avatar: teacher.teacherProfile?.avatarUrl ?? teacher.avatarUrl,
    subject: teacher.teacherProfile?.headline ?? null,
    experience: toExperienceLabel(teacher.teacherProfile?.yearsExperience ?? null),
    location: teacher.teacherProfile?.location ?? null,
    bio: teacher.bio,
    stats: {
      sharedLessons,
      totalDownloads,
      averageRating,
      followers: teacher._count.followers,
      following: teacher._count.following,
    },
  };
};

export const listTeacherLessons = async (
  teacherId: number,
  viewerId: number | null,
  query: TeacherLessonsQueryInput
): Promise<TeacherLessonView[]> => {
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { id: true },
  });

  if (!teacher) {
    throw new HttpError(404, "Teacher not found");
  }

  const isOwner = viewerId === teacherId;
  const includeDraft = isOwner && query.includeDraft;

  const lessons = await prisma.lesson.findMany({
    where: {
      authorId: teacherId,
      ...(includeDraft
        ? {}
        : {
            status: LessonLifecycleStatus.PUBLISHED,
            isPublished: true,
          }),
    },
    select: {
      id: true,
      authorId: true,
      title: true,
      description: true,
      subject: true,
      gradeLevel: true,
      price: true,
      status: true,
      isPublished: true,
      thumbnailUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          reviews: true,
          orders: {
            where: {
              status: "PAID",
            },
          },
        },
      },
      reviews: {
        select: {
          rating: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return lessons.map((lesson) => {
    const ratingAverage =
      lesson.reviews.length === 0
        ? 0
        : Number(
            (
              lesson.reviews.reduce((sum, review) => sum + review.rating, 0) /
              lesson.reviews.length
            ).toFixed(1)
          );

    return {
      id: lesson.id,
      authorId: lesson.authorId,
      title: lesson.title,
      description: lesson.description,
      subject: lesson.subject,
      gradeLevel: lesson.gradeLevel,
      downloads: lesson._count.orders,
      rating: ratingAverage,
      reviewCount: lesson._count.reviews,
      thumbnail: lesson.thumbnailUrl,
      price: Number(lesson.price),
      status: lessonLifecycleToView(lesson.status),
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    };
  });
};

export const listTeacherReviews = async (
  teacherId: number
): Promise<TeacherReviewItemView[]> => {
  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { id: true },
  });

  if (!teacher) {
    throw new HttpError(404, "Teacher not found");
  }

  const reviews = await prisma.review.findMany({
    where: {
      lesson: {
        authorId: teacherId,
        status: LessonLifecycleStatus.PUBLISHED,
        isPublished: true,
      },
    },
    select: {
      id: true,
      lessonId: true,
      reviewerId: true,
      rating: true,
      comment: true,
      createdAt: true,
      reviewer: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          status: true,
          avatarUrl: true,
          bio: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      lesson: {
        select: {
          id: true,
          title: true,
          price: true,
          authorId: true,
          orders: {
            where: {
              status: "PAID",
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

  return reviews
    .filter(
      (review): review is typeof review & { lessonId: number; lesson: { id: number; title: string; authorId: number; price: Prisma.Decimal; orders: { buyerId: number }[] } } =>
        review.lessonId !== null && review.lesson !== null
    )
    .map((review) => {
      const isVerifiedBuyer =
        review.lesson.authorId === review.reviewerId ||
        Number(review.lesson.price) <= 0 ||
        review.lesson.orders.some((order) => order.buyerId === review.reviewerId);

      return {
        review: {
          id: review.id,
          lessonId: review.lessonId,
          authorId: review.reviewerId,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          isVerifiedBuyer,
        },
        lessonTitle: review.lesson.title,
        reviewer: review.reviewer
          ? {
              id: review.reviewer.id,
              fullName: review.reviewer.fullName,
              email: review.reviewer.email,
              role: review.reviewer.role.toLowerCase(),
              status: review.reviewer.status.toLowerCase(),
              avatarUrl: review.reviewer.avatarUrl,
              bio: review.reviewer.bio,
              createdAt: review.reviewer.createdAt,
              updatedAt: review.reviewer.updatedAt,
            }
          : null,
      };
    });
};
