import {
  ModerationStatus,
  NotificationType,
  PostReactionType,
  Prisma,
  ReportStatus,
} from "@prisma/client";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import { createNotificationSafely } from "./notification.service";
import {
  CreateCommunityCommentInput,
  CreateCommunityPostInput,
  CreateCommunityReportInput,
  ListCommunityPostsQueryInput,
  UpdateCommunityCommentInput,
  UpdateCommunityPostInput,
} from "../validators/community.validator";

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface CommunityPostView {
  id: number;
  authorId: number;
  title: string;
  excerpt: string;
  content: string;
  image: string | null;
  imageUrl: string | null;
  category: string;
  tags: string[];
  likes: number;
  likedBy: number[];
  savedBy: number[];
  createdAt: Date;
  updatedAt: Date;
}

interface CommunityCommentView {
  id: number;
  postId: number;
  authorId: number;
  content: string;
  parentId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

type CommunityReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";

interface CommunityReportView {
  id: number;
  reporterId: number;
  targetType: "post" | "comment";
  targetId: number;
  reason: string;
  category: string;
  status: CommunityReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

const postInclude = {
  reactions: {
    select: {
      userId: true,
      type: true,
    },
  },
} satisfies Prisma.PostInclude;

type PostWithReactions = Prisma.PostGetPayload<{
  include: typeof postInclude;
}>;

const normalizeTags = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  tags.forEach((tag) => {
    const trimmed = tag.trim();
    if (trimmed.length === 0) {
      return;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    normalized.push(trimmed);
  });

  return normalized;
};

const serializeTags = (tags: string[]): string | null => {
  const normalized = normalizeTags(tags);
  if (normalized.length === 0) {
    return null;
  }

  return JSON.stringify(normalized);
};

const parseTags = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      return normalizeTags(
        parsed.filter((item): item is string => typeof item === "string")
      );
    }
  } catch {
    // Fallback to comma-separated format for legacy records.
  }

  return normalizeTags(raw.split(","));
};

const buildExcerpt = (content: string): string => {
  const trimmed = content.trim();

  if (trimmed.length <= 140) {
    return trimmed;
  }

  return `${trimmed.slice(0, 137)}...`;
};

const mapReportStatus = (status: ReportStatus): CommunityReportStatus => {
  switch (status) {
    case ReportStatus.IN_REVIEW:
      return "reviewing";
    case ReportStatus.RESOLVED:
      return "resolved";
    case ReportStatus.REJECTED:
      return "dismissed";
    case ReportStatus.OPEN:
    default:
      return "pending";
  }
};

const mapPost = (post: PostWithReactions): CommunityPostView => {
  const likedBy = post.reactions
    .filter((reaction) => reaction.type === PostReactionType.LIKE)
    .map((reaction) => reaction.userId);

  const savedBy = post.reactions
    .filter((reaction) => reaction.type === PostReactionType.SAVE)
    .map((reaction) => reaction.userId);

  return {
    id: post.id,
    authorId: post.authorId,
    title: post.title ?? "",
    excerpt: buildExcerpt(post.content),
    content: post.content,
    image: post.imageUrl ?? null,
    imageUrl: post.imageUrl ?? null,
    category: post.category,
    tags: parseTags(post.tags),
    likes: likedBy.length,
    likedBy,
    savedBy,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
};

const mapComment = (comment: {
  id: number;
  postId: number;
  authorId: number;
  content: string;
  parentId: number | null;
  createdAt: Date;
  updatedAt: Date;
}): CommunityCommentView => ({
  id: comment.id,
  postId: comment.postId,
  authorId: comment.authorId,
  content: comment.content,
  parentId: comment.parentId,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt,
});

const mapReport = (report: {
  id: number;
  reporterId: number;
  targetPostId: number | null;
  targetCommentId: number | null;
  reason: string;
  category: string;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}): CommunityReportView => {
  if (report.targetPostId !== null) {
    return {
      id: report.id,
      reporterId: report.reporterId,
      targetType: "post",
      targetId: report.targetPostId,
      reason: report.reason,
      category: report.category,
      status: mapReportStatus(report.status),
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }

  if (report.targetCommentId !== null) {
    return {
      id: report.id,
      reporterId: report.reporterId,
      targetType: "comment",
      targetId: report.targetCommentId,
      reason: report.reason,
      category: report.category,
      status: mapReportStatus(report.status),
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }

  throw new HttpError(409, "Report target is no longer available");
};

const assertPostExists = async (postId: number): Promise<void> => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      moderationStatus: true,
    },
  });

  if (!post || post.moderationStatus === ModerationStatus.REJECTED) {
    throw new HttpError(404, "Post not found");
  }
};

const assertPostOwnership = async (postId: number, userId: number): Promise<void> => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
    },
  });

  if (!post) {
    throw new HttpError(404, "Post not found");
  }

  if (post.authorId !== userId) {
    throw new HttpError(403, "You can only manage your own posts");
  }
};

const assertCommentOwnership = async (
  commentId: number,
  userId: number
): Promise<void> => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      authorId: true,
    },
  });

  if (!comment) {
    throw new HttpError(404, "Comment not found");
  }

  if (comment.authorId !== userId) {
    throw new HttpError(403, "You can only manage your own comments");
  }
};

export const listCommunityPosts = async (
  query: ListCommunityPostsQueryInput
): Promise<PaginatedResult<CommunityPostView>> => {
  const clauses: Prisma.PostWhereInput[] = [
    {
      moderationStatus: {
        not: ModerationStatus.REJECTED,
      },
    },
  ];

  const search = query.search?.trim();
  if (search) {
    clauses.push({
      OR: [
        { title: { contains: search } },
        { content: { contains: search } },
        { category: { contains: search } },
        { tags: { contains: search } },
      ],
    });
  }

  const category = query.category?.trim();
  if (category && category.toLowerCase() !== "all") {
    clauses.push({
      category,
    });
  }

  const where: Prisma.PostWhereInput = {
    AND: clauses,
  };

  const page = query.page;
  const pageSize = query.pageSize;

  const [total, posts] = await prisma.$transaction([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: postInclude,
    }),
  ]);

  return {
    data: posts.map(mapPost),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
};

export const getCommunityPostById = async (
  postId: number
): Promise<CommunityPostView> => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: postInclude,
  });

  if (!post || post.moderationStatus === ModerationStatus.REJECTED) {
    throw new HttpError(404, "Post not found");
  }

  return mapPost(post);
};

export const createCommunityPost = async (
  userId: number,
  payload: CreateCommunityPostInput
): Promise<CommunityPostView> => {
  const post = await prisma.post.create({
    data: {
      authorId: userId,
      title: payload.title,
      content: payload.content,
      category: payload.category,
      tags: serializeTags(payload.tags),
      imageUrl: payload.imageUrl,
      moderationStatus: ModerationStatus.APPROVED,
    },
    include: postInclude,
  });

  return mapPost(post);
};

export const updateCommunityPost = async (
  postId: number,
  userId: number,
  payload: UpdateCommunityPostInput
): Promise<CommunityPostView> => {
  await assertPostOwnership(postId, userId);

  const data: Prisma.PostUpdateInput = {
    moderationStatus: ModerationStatus.APPROVED,
  };

  if (payload.title !== undefined) {
    data.title = payload.title;
  }

  if (payload.content !== undefined) {
    data.content = payload.content;
  }

  if (payload.category !== undefined) {
    data.category = payload.category;
  }

  if (payload.tags !== undefined) {
    data.tags = serializeTags(payload.tags);
  }

  if (payload.imageUrl !== undefined) {
    data.imageUrl = payload.imageUrl;
  }

  const post = await prisma.post.update({
    where: { id: postId },
    data,
    include: postInclude,
  });

  return mapPost(post);
};

export const deleteCommunityPost = async (
  postId: number,
  userId: number
): Promise<void> => {
  await assertPostOwnership(postId, userId);

  await prisma.post.delete({
    where: { id: postId },
  });
};

const togglePostReaction = async (
  postId: number,
  userId: number,
  type: PostReactionType
): Promise<CommunityPostView> => {
  await assertPostExists(postId);

  const existing = await prisma.postReaction.findUnique({
    where: {
      postId_userId_type: {
        postId,
        userId,
        type,
      },
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    await prisma.postReaction.delete({
      where: {
        postId_userId_type: {
          postId,
          userId,
          type,
        },
      },
    });
  } else {
    await prisma.postReaction.create({
      data: {
        postId,
        userId,
        type,
      },
    });
  }

  return getCommunityPostById(postId);
};

export const toggleCommunityPostLike = async (
  postId: number,
  userId: number
): Promise<CommunityPostView> => {
  return togglePostReaction(postId, userId, PostReactionType.LIKE);
};

export const toggleCommunityPostSave = async (
  postId: number,
  userId: number
): Promise<CommunityPostView> => {
  return togglePostReaction(postId, userId, PostReactionType.SAVE);
};

export const listCommunityComments = async (
  postId: number
): Promise<CommunityCommentView[]> => {
  await assertPostExists(postId);

  const comments = await prisma.comment.findMany({
    where: {
      postId,
      moderationStatus: {
        not: ModerationStatus.REJECTED,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      postId: true,
      authorId: true,
      content: true,
      parentId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return comments.map(mapComment);
};

export const listCommunityCommentCounts = async (
  postIds: number[]
): Promise<Record<string, number>> => {
  const uniquePostIds = Array.from(new Set(postIds));

  const counts: Record<string, number> = {};
  uniquePostIds.forEach((postId) => {
    counts[String(postId)] = 0;
  });

  if (uniquePostIds.length === 0) {
    return counts;
  }

  const grouped = await prisma.comment.groupBy({
    by: ["postId"],
    where: {
      postId: {
        in: uniquePostIds,
      },
      moderationStatus: {
        not: ModerationStatus.REJECTED,
      },
    },
    _count: {
      _all: true,
    },
  });

  grouped.forEach((item) => {
    counts[String(item.postId)] = item._count._all;
  });

  return counts;
};

export const createCommunityComment = async (
  postId: number,
  userId: number,
  payload: CreateCommunityCommentInput
): Promise<CommunityCommentView> => {
  await assertPostExists(postId);

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
    },
  });

  if (!post) {
    throw new HttpError(404, "Post not found");
  }

  let parentAuthorId: number | null = null;

  if (payload.parentId !== undefined) {
    const parent = await prisma.comment.findFirst({
      where: {
        id: payload.parentId,
        postId,
      },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!parent) {
      throw new HttpError(404, "Reply target was not found");
    }

    parentAuthorId = parent.authorId;
  }

  const comment = await prisma.comment.create({
    data: {
      postId,
      authorId: userId,
      content: payload.content,
      parentId: payload.parentId ?? null,
      moderationStatus: ModerationStatus.APPROVED,
    },
    select: {
      id: true,
      postId: true,
      authorId: true,
      content: true,
      parentId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const notificationTargets = new Set<number>();

  if (post.authorId !== userId) {
    notificationTargets.add(post.authorId);
  }

  if (parentAuthorId !== null && parentAuthorId !== userId) {
    notificationTargets.add(parentAuthorId);
  }

  await Promise.all(
    Array.from(notificationTargets).map((targetUserId) => {
      const isReplyTarget = parentAuthorId !== null && targetUserId === parentAuthorId;

      return createNotificationSafely({
        userId: targetUserId,
        actorId: userId,
        type: NotificationType.COMMENT,
        title: isReplyTarget ? "New reply to your comment" : "New comment on your post",
        content: isReplyTarget
          ? "Someone replied to your community comment."
          : "Someone commented on your community post.",
        actionUrl: `/community/${postId}`,
        actionLabel: "View discussion",
        entityType: "comment",
        entityId: comment.id,
        metadata: {
          source: isReplyTarget ? "reply" : "comment",
          postId,
          parentId: payload.parentId ?? null,
        },
      });
    })
  );

  return mapComment(comment);
};

export const updateCommunityComment = async (
  commentId: number,
  userId: number,
  payload: UpdateCommunityCommentInput
): Promise<CommunityCommentView> => {
  await assertCommentOwnership(commentId, userId);

  const comment = await prisma.comment.update({
    where: { id: commentId },
    data: {
      content: payload.content,
      moderationStatus: ModerationStatus.APPROVED,
    },
    select: {
      id: true,
      postId: true,
      authorId: true,
      content: true,
      parentId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return mapComment(comment);
};

export const deleteCommunityComment = async (
  commentId: number,
  userId: number
): Promise<void> => {
  await assertCommentOwnership(commentId, userId);

  await prisma.comment.delete({
    where: {
      id: commentId,
    },
  });
};

export const listTrendingTopics = async (): Promise<Array<{ tag: string; count: number }>> => {
  const posts = await prisma.post.findMany({
    where: {
      moderationStatus: {
        not: ModerationStatus.REJECTED,
      },
    },
    select: {
      tags: true,
    },
  });

  const topicMap = new Map<string, number>();

  posts.forEach((post) => {
    parseTags(post.tags).forEach((tag) => {
      const normalized = tag.trim().toLowerCase();
      if (!normalized) {
        return;
      }

      topicMap.set(normalized, (topicMap.get(normalized) ?? 0) + 1);
    });
  });

  return Array.from(topicMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.tag.localeCompare(right.tag);
    })
    .slice(0, 8);
};

export const createCommunityReport = async (
  reporterId: number,
  payload: CreateCommunityReportInput
): Promise<CommunityReportView> => {
  if (payload.targetType === "post") {
    const targetPost = await prisma.post.findUnique({
      where: { id: payload.targetId },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!targetPost) {
      throw new HttpError(404, "The content you are reporting no longer exists");
    }

    if (targetPost.authorId === reporterId) {
      throw new HttpError(403, "You cannot report your own content");
    }

    const duplicateOpenReport = await prisma.report.findFirst({
      where: {
        reporterId,
        targetPostId: payload.targetId,
        status: {
          in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW],
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicateOpenReport) {
      throw new HttpError(409, "You already have an open report for this content");
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        targetPostId: payload.targetId,
        reason: payload.reason,
        category: payload.category,
        status: ReportStatus.OPEN,
      },
      select: {
        id: true,
        reporterId: true,
        targetPostId: true,
        targetCommentId: true,
        reason: true,
        category: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return mapReport(report);
  }

  const targetComment = await prisma.comment.findUnique({
    where: { id: payload.targetId },
    select: {
      id: true,
      authorId: true,
    },
  });

  if (!targetComment) {
    throw new HttpError(404, "The content you are reporting no longer exists");
  }

  if (targetComment.authorId === reporterId) {
    throw new HttpError(403, "You cannot report your own content");
  }

  const duplicateOpenReport = await prisma.report.findFirst({
    where: {
      reporterId,
      targetCommentId: payload.targetId,
      status: {
        in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW],
      },
    },
    select: {
      id: true,
    },
  });

  if (duplicateOpenReport) {
    throw new HttpError(409, "You already have an open report for this content");
  }

  const report = await prisma.report.create({
    data: {
      reporterId,
      targetCommentId: payload.targetId,
      reason: payload.reason,
      category: payload.category,
      status: ReportStatus.OPEN,
    },
    select: {
      id: true,
      reporterId: true,
      targetPostId: true,
      targetCommentId: true,
      reason: true,
      category: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return mapReport(report);
};
