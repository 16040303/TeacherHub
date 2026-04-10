import { getDatabase, updateDatabase, withLatency } from '../mock/server/database';
import { UserFollowRelation } from '../types';
import { toSafeDate, toSafeId, toOptionalString } from '../utils/normalizers';
import { createNotification } from './notificationsRepository';

const relationComparator = (left: UserFollowRelation, right: UserFollowRelation): number => {
  const leftTime = new Date(left.createdAt).getTime();
  const rightTime = new Date(right.createdAt).getTime();
  return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
};

const normalizeRelation = (relation: UserFollowRelation): UserFollowRelation => ({
  followerId: toSafeId(relation.followerId, 'unknown-user'),
  followingId: toSafeId(relation.followingId, 'unknown-user'),
  createdAt: toSafeDate(relation.createdAt),
  source: (() => {
    const normalizedSource = toOptionalString(relation.source);
    if (
      normalizedSource === 'manual' ||
      normalizedSource === 'suggestion' ||
      normalizedSource === 'imported'
    ) {
      return normalizedSource;
    }

    return undefined;
  })(),
});

const existsUser = (userId: string): boolean =>
  getDatabase().users.some((user) => toSafeId(user.id, '') === toSafeId(userId, ''));

export const listFollowingIds = async (userId: string): Promise<string[]> => {
  const safeUserId = toSafeId(userId, '');

  const ids = getDatabase()
    .follows
    .map((item) => normalizeRelation(item))
    .filter((item) => item.followerId === safeUserId)
    .sort(relationComparator)
    .map((item) => item.followingId);

  return withLatency(Array.from(new Set(ids)), 90);
};

export const listFollowerIds = async (userId: string): Promise<string[]> => {
  const safeUserId = toSafeId(userId, '');

  const ids = getDatabase()
    .follows
    .map((item) => normalizeRelation(item))
    .filter((item) => item.followingId === safeUserId)
    .sort(relationComparator)
    .map((item) => item.followerId);

  return withLatency(Array.from(new Set(ids)), 90);
};

export const getFollowerCount = async (userId: string): Promise<number> => {
  const safeUserId = toSafeId(userId, '');
  const count = getDatabase().follows
    .map((item) => normalizeRelation(item))
    .filter((item) => item.followingId === safeUserId).length;
  return withLatency(count, 80);
};

export const getFollowingCount = async (userId: string): Promise<number> => {
  const safeUserId = toSafeId(userId, '');
  const count = getDatabase().follows
    .map((item) => normalizeRelation(item))
    .filter((item) => item.followerId === safeUserId).length;
  return withLatency(count, 80);
};

export const isFollowingUser = async (followerId: string, followingId: string): Promise<boolean> => {
  const safeFollowerId = toSafeId(followerId, '');
  const safeFollowingId = toSafeId(followingId, '');

  const following = getDatabase().follows
    .map((item) => normalizeRelation(item))
    .some((item) => item.followerId === safeFollowerId && item.followingId === safeFollowingId);

  return withLatency(following, 80);
};

export const followUser = async (followerId: string, followingId: string): Promise<void> => {
  const safeFollowerId = toSafeId(followerId, '');
  const safeFollowingId = toSafeId(followingId, '');

  if (!safeFollowerId || !safeFollowingId) {
    throw new Error('Follower and target users are required');
  }

  if (safeFollowerId === safeFollowingId) {
    throw new Error('You cannot follow yourself');
  }

  if (!existsUser(safeFollowerId) || !existsUser(safeFollowingId)) {
    throw new Error('User not found');
  }

  let created = false;

  updateDatabase((draft) => {
    const existing = draft.follows
      .map((item) => normalizeRelation(item))
      .some((item) => item.followerId === safeFollowerId && item.followingId === safeFollowingId);

    if (existing) {
      return;
    }

    draft.follows.push({
      followerId: safeFollowerId,
      followingId: safeFollowingId,
      createdAt: new Date().toISOString(),
      source: 'manual',
    });

    created = true;
  });

  if (created) {
    const follower = getDatabase().users.find((user) => toSafeId(user.id, '') === safeFollowerId);
    await createNotification({
      userId: safeFollowingId,
      type: 'follow',
      title: 'New follower',
      message: `${follower?.name ?? 'A teacher'} started following you.`,
      actionUrl: '/community',
      actionLabel: 'Open community',
      actorUserId: safeFollowerId,
      entityType: 'user',
      entityId: safeFollowerId,
    });
  } else {
    await withLatency(true, 60);
  }
};

export const unfollowUser = async (followerId: string, followingId: string): Promise<void> => {
  const safeFollowerId = toSafeId(followerId, '');
  const safeFollowingId = toSafeId(followingId, '');

  updateDatabase((draft) => {
    draft.follows = draft.follows.filter((item) => {
      const normalized = normalizeRelation(item);
      return !(normalized.followerId === safeFollowerId && normalized.followingId === safeFollowingId);
    });
  });

  await withLatency(true, 70);
};
