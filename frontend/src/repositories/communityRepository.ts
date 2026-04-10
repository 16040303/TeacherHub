import { DEFAULT_PAGE_SIZE } from '../app/config/constants';
import {
  CommunityCommentPayload,
  CommunityPostPayload,
  CommunityReportPayload,
} from '../mock/contracts';
import { getDatabase, updateDatabase, withLatency } from '../mock/server/database';
import { CommunityComment, CommunityPost, PaginatedResult, Report } from '../types';
import { generateId } from '../utils/id';

export interface CommunityFeedQuery {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

const toTimestamp = (value: string): number => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const normalize = (value?: string): string => (value ?? '').trim().toLowerCase();

const ensureStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const normalizeCommunityPost = (post: CommunityPost): CommunityPost => {
  const tags = ensureStringArray(post.tags);
  const likedBy = ensureStringArray(post.likedBy);
  const savedBy = ensureStringArray(post.savedBy);

  return {
    ...post,
    tags,
    likedBy,
    savedBy,
    likes: likedBy.length,
  };
};

const buildExcerpt = (content: string): string => {
  const trimmed = content.trim();
  if (trimmed.length <= 140) {
    return trimmed;
  }

  return `${trimmed.slice(0, 137)}...`;
};

const paginate = <T>(source: T[], page: number, pageSize: number): PaginatedResult<T> => {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : DEFAULT_PAGE_SIZE;

  const total = source.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safePageSize;
  const end = start + safePageSize;

  return {
    data: source.slice(start, end),
    total,
    page: currentPage,
    pageSize: safePageSize,
    totalPages,
  };
};

const collectCommentThreadIds = (comments: CommunityComment[], rootCommentId: string): Set<string> => {
  const ids = new Set<string>();
  const queue: string[] = [rootCommentId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (ids.has(current)) {
      continue;
    }

    ids.add(current);

    comments.forEach((comment) => {
      if (comment.parentId === current && !ids.has(comment.id)) {
        queue.push(comment.id);
      }
    });
  }

  return ids;
};

export const listCommunityPosts = async (query: CommunityFeedQuery = {}): Promise<PaginatedResult<CommunityPost>> => {
  const search = normalize(query.search);
  const category = normalize(query.category);

  let posts = [...getDatabase().communityPosts]
    .map((post) => normalizeCommunityPost(post))
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));

  if (search) {
    posts = posts.filter((post) => {
      const haystack = [post.title, post.excerpt, post.content, post.tags.join(' '), post.category].join(' ').toLowerCase();

      return haystack.includes(search);
    });
  }

  if (category && category !== 'all') {
    posts = posts.filter((post) => normalize(post.category) === category);
  }

  return withLatency(paginate(posts, query.page ?? 1, query.pageSize ?? DEFAULT_PAGE_SIZE));
};

export const getCommunityPostById = async (postId: string): Promise<CommunityPost | null> => {
  const post = getDatabase().communityPosts.find((item) => item.id === postId) ?? null;
  return withLatency(post ? normalizeCommunityPost(post) : null);
};

export const createCommunityPost = async (authorId: string, payload: CommunityPostPayload): Promise<CommunityPost> => {
  if (!payload.title.trim()) {
    throw new Error('Post title is required');
  }

  if (!payload.content.trim()) {
    throw new Error('Post content is required');
  }

  let createdPost: CommunityPost | null = null;

  updateDatabase((draft) => {
    const post: CommunityPost = {
      id: generateId('post'),
      authorId,
      title: payload.title.trim(),
      excerpt: buildExcerpt(payload.content),
      content: payload.content.trim(),
      image: payload.image?.trim() || undefined,
      category: payload.category.trim() || 'General',
      tags: payload.tags.map((tag) => tag.trim()).filter(Boolean),
      likes: 0,
      likedBy: [],
      savedBy: [],
      createdAt: new Date().toISOString(),
    };

    draft.communityPosts.push(post);
    createdPost = post;
  });

  if (!createdPost) {
    throw new Error('Unable to create post');
  }

  return withLatency(normalizeCommunityPost(createdPost));
};

export const updateCommunityPost = async (
  postId: string,
  actorId: string,
  payload: CommunityPostPayload,
): Promise<CommunityPost> => {
  if (!payload.title.trim()) {
    throw new Error('Post title is required');
  }

  if (!payload.content.trim()) {
    throw new Error('Post content is required');
  }

  const safeActorId = actorId.trim();
  if (!safeActorId) {
    throw new Error('You must be logged in to edit this post');
  }

  let updatedPost: CommunityPost | null = null;
  let forbidden = false;

  updateDatabase((draft) => {
    const post = draft.communityPosts.find((item) => item.id === postId);
    if (!post) {
      return;
    }

    if (post.authorId !== safeActorId) {
      forbidden = true;
      return;
    }

    post.title = payload.title.trim();
    post.content = payload.content.trim();
    post.excerpt = buildExcerpt(post.content);
    post.image = payload.image?.trim() || undefined;
    post.category = payload.category.trim() || 'General';
    post.tags = payload.tags.map((tag) => tag.trim()).filter(Boolean);

    updatedPost = normalizeCommunityPost(post);
  });

  if (forbidden) {
    throw new Error('You can only edit your own posts');
  }

  if (!updatedPost) {
    throw new Error('Post not found');
  }

  return withLatency(updatedPost, 110);
};

export const toggleCommunityPostLike = async (postId: string, userId: string): Promise<CommunityPost> => {
  let updatedPost: CommunityPost | null = null;

  updateDatabase((draft) => {
    const post = draft.communityPosts.find((item) => item.id === postId);
    if (!post) {
      return;
    }

    post.likedBy = ensureStringArray(post.likedBy);
    post.savedBy = ensureStringArray(post.savedBy);

    const hasLiked = post.likedBy.includes(userId);
    if (hasLiked) {
      post.likedBy = post.likedBy.filter((id) => id !== userId);
    } else {
      post.likedBy.push(userId);
    }

    post.likes = post.likedBy.length;
    updatedPost = normalizeCommunityPost(post);
  });

  if (!updatedPost) {
    throw new Error('Post not found');
  }

  return withLatency(updatedPost, 100);
};

export const toggleCommunityPostSave = async (postId: string, userId: string): Promise<CommunityPost> => {
  let updatedPost: CommunityPost | null = null;

  updateDatabase((draft) => {
    const post = draft.communityPosts.find((item) => item.id === postId);
    if (!post) {
      return;
    }

    post.likedBy = ensureStringArray(post.likedBy);
    post.savedBy = ensureStringArray(post.savedBy);

    const hasSaved = post.savedBy.includes(userId);
    if (hasSaved) {
      post.savedBy = post.savedBy.filter((id) => id !== userId);
    } else {
      post.savedBy.push(userId);
    }

    updatedPost = normalizeCommunityPost(post);
  });

  if (!updatedPost) {
    throw new Error('Post not found');
  }

  return withLatency(updatedPost, 100);
};

export const listCommunityComments = async (postId: string): Promise<CommunityComment[]> => {
  const comments = getDatabase()
    .communityComments.filter((comment) => comment.postId === postId)
    .sort((left, right) => toTimestamp(left.createdAt) - toTimestamp(right.createdAt));

  return withLatency(comments);
};

export const listCommunityCommentCounts = async (postIds: string[]): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  const requested = new Set(postIds.filter(Boolean));

  if (requested.size === 0) {
    return withLatency(counts, 80);
  }

  getDatabase().communityComments.forEach((comment) => {
    if (!requested.has(comment.postId)) {
      return;
    }

    counts[comment.postId] = (counts[comment.postId] ?? 0) + 1;
  });

  return withLatency(counts, 90);
};

export const createCommunityComment = async (authorId: string, payload: CommunityCommentPayload): Promise<CommunityComment> => {
  if (!payload.content.trim()) {
    throw new Error('Comment content is required');
  }

  const postExists = getDatabase().communityPosts.some((post) => post.id === payload.postId);
  if (!postExists) {
    throw new Error('Post not found');
  }

  if (payload.parentId) {
    const parentExists = getDatabase().communityComments.some(
      (comment) => comment.id === payload.parentId && comment.postId === payload.postId,
    );
    if (!parentExists) {
      throw new Error('Reply target was not found');
    }
  }

  let createdComment: CommunityComment | null = null;

  updateDatabase((draft) => {
    const comment: CommunityComment = {
      id: generateId('comment'),
      postId: payload.postId,
      authorId,
      content: payload.content.trim(),
      parentId: payload.parentId,
      createdAt: new Date().toISOString(),
    };

    draft.communityComments.push(comment);
    createdComment = comment;
  });

  if (!createdComment) {
    throw new Error('Unable to create comment');
  }

  return withLatency(createdComment, 100);
};

export const deleteCommunityComment = async (commentId: string, actorId: string): Promise<void> => {
  const safeActorId = actorId.trim();
  if (!safeActorId) {
    throw new Error('You must be logged in to delete comments');
  }

  let removed = false;
  let forbidden = false;

  updateDatabase((draft) => {
    const comment = draft.communityComments.find((item) => item.id === commentId);
    if (!comment) {
      return;
    }

    if (comment.authorId !== safeActorId) {
      forbidden = true;
      return;
    }

    const idsToRemove = collectCommentThreadIds(draft.communityComments, comment.id);
    draft.communityComments = draft.communityComments.filter((item) => !idsToRemove.has(item.id));
    removed = true;
  });

  if (forbidden) {
    throw new Error('You can only delete your own comments');
  }

  if (!removed) {
    throw new Error('Comment not found');
  }

  await withLatency(true, 110);
};

export const listTrendingTopics = async (): Promise<Array<{ tag: string; count: number }>> => {
  const map = new Map<string, number>();

  getDatabase().communityPosts.forEach((post) => {
    ensureStringArray(post.tags).forEach((tag) => {
      const normalizedTag = tag.trim().toLowerCase();
      if (!normalizedTag) {
        return;
      }

      map.set(normalizedTag, (map.get(normalizedTag) ?? 0) + 1);
    });
  });

  const topics = Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  return withLatency(topics, 120);
};

export const createCommunityReport = async (
  reporterId: string,
  payload: CommunityReportPayload,
): Promise<Report> => {
  const safeReporterId = reporterId.trim();
  if (!safeReporterId) {
    throw new Error('You must be logged in to submit a report');
  }

  const targetId = payload.targetId.trim();
  const reason = payload.reason.trim();
  const category = payload.category.trim() || 'Other';

  if (!targetId) {
    throw new Error('Report target is required');
  }

  if (!reason) {
    throw new Error('Please provide a reason for your report');
  }

  let createdReport: Report | null = null;
  let targetMissing = false;
  let duplicateOpenReport = false;
  let selfReport = false;

  updateDatabase((draft) => {
    if (payload.targetType === 'post') {
      const targetPost = draft.communityPosts.find((post) => post.id === targetId);
      if (!targetPost) {
        targetMissing = true;
        return;
      }

      if (targetPost.authorId === safeReporterId) {
        selfReport = true;
        return;
      }
    }

    if (payload.targetType === 'comment') {
      const targetComment = draft.communityComments.find((comment) => comment.id === targetId);
      if (!targetComment) {
        targetMissing = true;
        return;
      }

      if (targetComment.authorId === safeReporterId) {
        selfReport = true;
        return;
      }
    }

    const existingOpenReport = draft.reports.find(
      (report) =>
        report.reporterId === safeReporterId &&
        report.targetType === payload.targetType &&
        report.targetId === targetId &&
        (report.status === 'pending' || report.status === 'reviewing'),
    );

    if (existingOpenReport) {
      duplicateOpenReport = true;
      return;
    }

    const now = new Date().toISOString();
    const report: Report = {
      id: generateId('rpt'),
      reporterId: safeReporterId,
      targetType: payload.targetType,
      targetId,
      reason,
      category,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    draft.reports.push(report);
    createdReport = report;
  });

  if (targetMissing) {
    throw new Error('The content you are reporting no longer exists');
  }

  if (selfReport) {
    throw new Error('You cannot report your own content');
  }

  if (duplicateOpenReport) {
    throw new Error('You already have an open report for this content');
  }

  if (!createdReport) {
    throw new Error('Unable to submit report');
  }

  return withLatency(createdReport, 120);
};

export const deleteCommunityPost = async (postId: string, actorId?: string): Promise<void> => {
  const safeActorId = actorId?.trim();

  let removed = false;
  let forbidden = false;

  updateDatabase((draft) => {
    const index = draft.communityPosts.findIndex((post) => post.id === postId);
    if (index < 0) {
      return;
    }

    if (safeActorId && draft.communityPosts[index].authorId !== safeActorId) {
      forbidden = true;
      return;
    }

    draft.communityPosts.splice(index, 1);
    draft.communityComments = draft.communityComments.filter((comment) => comment.postId !== postId);
    removed = true;
  });

  if (forbidden) {
    throw new Error('You can only delete your own posts');
  }

  if (!removed) {
    throw new Error('Post not found');
  }

  await withLatency(true, 120);
};
