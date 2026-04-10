import { NotificationType } from "@prisma/client";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import { createNotificationSafely } from "./notification.service";

interface FollowCountsView {
  followers: number;
  following: number;
}

const findUserSummary = async (
  userId: number
): Promise<{ id: number; fullName: string } | null> => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
    },
  });
};

const assertUserExists = async (userId: number): Promise<void> => {
  const user = await findUserSummary(userId);

  if (!user) {
    throw new HttpError(404, "User not found");
  }
};

export const listFollowingIds = async (userId: number): Promise<number[]> => {
  await assertUserExists(userId);

  const following = await prisma.follow.findMany({
    where: {
      followerId: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      followingId: true,
    },
  });

  return following.map((item) => item.followingId);
};

export const listFollowerIds = async (userId: number): Promise<number[]> => {
  await assertUserExists(userId);

  const followers = await prisma.follow.findMany({
    where: {
      followingId: userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      followerId: true,
    },
  });

  return followers.map((item) => item.followerId);
};

export const getFollowerCount = async (userId: number): Promise<number> => {
  await assertUserExists(userId);

  return prisma.follow.count({
    where: {
      followingId: userId,
    },
  });
};

export const getFollowingCount = async (userId: number): Promise<number> => {
  await assertUserExists(userId);

  return prisma.follow.count({
    where: {
      followerId: userId,
    },
  });
};

export const getFollowCounts = async (userId: number): Promise<FollowCountsView> => {
  await assertUserExists(userId);

  const [followers, following] = await prisma.$transaction([
    prisma.follow.count({
      where: {
        followingId: userId,
      },
    }),
    prisma.follow.count({
      where: {
        followerId: userId,
      },
    }),
  ]);

  return {
    followers,
    following,
  };
};

export const isFollowingUser = async (
  followerId: number,
  followingId: number
): Promise<boolean> => {
  if (followerId === followingId) {
    return false;
  }

  const relation = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(relation);
};

export const followUser = async (
  followerId: number,
  followingId: number
): Promise<void> => {
  if (followerId === followingId) {
    throw new HttpError(400, "You cannot follow yourself");
  }

  const [follower, following] = await Promise.all([
    findUserSummary(followerId),
    findUserSummary(followingId),
  ]);

  if (!follower || !following) {
    throw new HttpError(404, "User not found");
  }

  const existing = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId,
        followingId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return;
  }

  await prisma.follow.create({
    data: {
      followerId,
      followingId,
    },
  });

  await createNotificationSafely({
    userId: followingId,
    actorId: followerId,
    type: NotificationType.FOLLOW,
    title: "New follower",
    content: `${follower.fullName} started following you.`,
    actionUrl: `/teacher/${followerId}`,
    actionLabel: "View profile",
    entityType: "user",
    entityId: followerId,
    metadata: {
      source: "follow",
    },
  });
};

export const unfollowUser = async (
  followerId: number,
  followingId: number
): Promise<void> => {
  if (followerId === followingId) {
    throw new HttpError(400, "You cannot unfollow yourself");
  }

  await prisma.follow.deleteMany({
    where: {
      followerId,
      followingId,
    },
  });
};
