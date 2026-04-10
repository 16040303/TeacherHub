import { z } from "zod";

const optionalTrimmedText = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(500).optional()
);

const optionalImageUrl = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().url().max(2000).optional()
);

const postTagsSchema = z.array(z.string().trim().min(1).max(50)).max(20);

export const listCommunityPostsQuerySchema = z.object({
  search: optionalTrimmedText,
  category: optionalTrimmedText,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export const postIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createCommunityPostSchema = z.object({
  title: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1).max(10000),
  category: z.string().trim().min(1).max(100).optional().default("General"),
  tags: postTagsSchema.optional().default([]),
  imageUrl: optionalImageUrl,
});

export const updateCommunityPostSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    content: z.string().trim().min(1).max(10000).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    tags: postTagsSchema.optional(),
    imageUrl: optionalImageUrl,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one post field is required",
  });

export const createCommunityCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  parentId: z.coerce.number().int().positive().optional(),
});

export const updateCommunityCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export const commentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const communityCommentCountsQuerySchema = z.object({
  postIds: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        return value
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      }

      if (Array.isArray(value)) {
        return value;
      }

      return [];
    },
    z.array(z.coerce.number().int().positive()).max(200)
  ),
});

export const createCommunityReportSchema = z.object({
  targetType: z.enum(["post", "comment"]),
  targetId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(3).max(3000),
  category: z.string().trim().min(1).max(100).optional().default("Other"),
});

export type ListCommunityPostsQueryInput = z.infer<typeof listCommunityPostsQuerySchema>;
export type CreateCommunityPostInput = z.infer<typeof createCommunityPostSchema>;
export type UpdateCommunityPostInput = z.infer<typeof updateCommunityPostSchema>;
export type CreateCommunityCommentInput = z.infer<typeof createCommunityCommentSchema>;
export type UpdateCommunityCommentInput = z.infer<typeof updateCommunityCommentSchema>;
export type CreateCommunityReportInput = z.infer<typeof createCommunityReportSchema>;
