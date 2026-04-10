import { LessonLifecycleStatus } from "@prisma/client";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";

interface LessonFavoriteMutationResult {
  lessonId: number;
  favorited: boolean;
}

const assertLessonCanBeFavorited = async (
  lessonId: number,
  userId: number
): Promise<void> => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      authorId: true,
      isPublished: true,
      status: true,
    },
  });

  if (!lesson) {
    throw new HttpError(404, "Lesson not found");
  }

  const isPublished =
    lesson.isPublished && lesson.status === LessonLifecycleStatus.PUBLISHED;

  if (!isPublished && lesson.authorId !== userId) {
    throw new HttpError(404, "Lesson not found");
  }
};

export const listFavoriteLessonIds = async (userId: number): Promise<number[]> => {
  const favorites = await prisma.lessonFavorite.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      lessonId: true,
    },
  });

  return favorites.map((favorite) => favorite.lessonId);
};

export const addLessonFavorite = async (
  userId: number,
  lessonId: number
): Promise<LessonFavoriteMutationResult> => {
  await assertLessonCanBeFavorited(lessonId, userId);

  await prisma.lessonFavorite.upsert({
    where: {
      userId_lessonId: {
        userId,
        lessonId,
      },
    },
    update: {
      source: "lesson_detail",
    },
    create: {
      userId,
      lessonId,
      source: "lesson_detail",
    },
  });

  return {
    lessonId,
    favorited: true,
  };
};

export const removeLessonFavorite = async (
  userId: number,
  lessonId: number
): Promise<LessonFavoriteMutationResult> => {
  await prisma.lessonFavorite.deleteMany({
    where: {
      userId,
      lessonId,
    },
  });

  return {
    lessonId,
    favorited: false,
  };
};
