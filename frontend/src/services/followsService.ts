import {
  followUser,
  getFollowerCount,
  getFollowingCount,
  isFollowingUser,
  listFollowerIds,
  listFollowingIds,
  unfollowUser,
} from '../repositories/followsRepository';

export const followsService = {
  listFollowingIds,
  listFollowerIds,
  getFollowerCount,
  getFollowingCount,
  isFollowingUser,
  followUser,
  unfollowUser,
};
