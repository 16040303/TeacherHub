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

const adminUserRoleSchema = z.enum(["admin", "user", "guest"]);
const adminUserStatusSchema = z.enum(["active", "suspended", "locked"]);
const lessonModerationStatusSchema = z.enum(["pending", "approved", "rejected"]);
const lessonLifecycleStatusSchema = z.enum(["draft", "published", "hidden"]);
const reportStatusSchema = z.enum(["pending", "reviewing", "resolved", "dismissed"]);
const reportTargetTypeSchema = z.enum(["post", "comment", "lesson", "user"]);
const moderationActionSchema = z.enum(["approve", "reject", "hide", "unhide"]);
const communityContentTypeSchema = z.enum(["post", "comment"]);
const orderStatusSchema = z.enum(["pending", "paid", "failed", "cancelled"]);

export const dashboardSnapshotQuerySchema = z.object({
  activityLimit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export const listRecentTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(10),
});

export const listAdminUsersQuerySchema = z.object({
  search: optionalTrimmedText,
  role: z
    .enum(["all", ...adminUserRoleSchema.options] as const)
    .optional()
    .default("all"),
  status: z
    .enum(["all", ...adminUserStatusSchema.options] as const)
    .optional()
    .default("all"),
});

export const adminUserIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateAdminUserSchema = z
  .object({
    role: adminUserRoleSchema.optional(),
    status: adminUserStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one user field is required",
  });

export const listLessonsForModerationQuerySchema = z.object({
  search: optionalTrimmedText,
  moderationStatus: z
    .enum(["all", ...lessonModerationStatusSchema.options] as const)
    .optional()
    .default("all"),
  lifecycleStatus: z
    .enum(["all", ...lessonLifecycleStatusSchema.options] as const)
    .optional()
    .default("all"),
});

export const lessonIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const moderateLessonSchema = z.object({
  action: moderationActionSchema,
  note: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().max(3000).optional()
  ),
  adminId: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().max(64).optional()
  ),
});

export const listCommunityModerationQuerySchema = z.object({
  search: optionalTrimmedText,
  contentType: z
    .enum(["all", ...communityContentTypeSchema.options] as const)
    .optional()
    .default("all"),
});

export const removeCommunityContentParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  contentType: communityContentTypeSchema,
});

export const listAdminReportsQuerySchema = z.object({
  search: optionalTrimmedText,
  status: z
    .enum(["all", ...reportStatusSchema.options] as const)
    .optional()
    .default("all"),
  targetType: z
    .enum(["all", ...reportTargetTypeSchema.options] as const)
    .optional()
    .default("all"),
});

export const adminReportIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateAdminReportSchema = z.object({
  status: reportStatusSchema,
  adminNote: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().max(3000).optional()
  ),
});

export const listAdminOrdersQuerySchema = z.object({
  search: optionalTrimmedText,
  status: z
    .enum(["all", ...orderStatusSchema.options] as const)
    .optional()
    .default("all"),
});

export type DashboardSnapshotQueryInput = z.infer<
  typeof dashboardSnapshotQuerySchema
>;

export type ListRecentTransactionsQueryInput = z.infer<
  typeof listRecentTransactionsQuerySchema
>;

export type ListAdminUsersQueryInput = z.infer<typeof listAdminUsersQuerySchema>;

export type UpdateAdminUserInput = z.infer<typeof updateAdminUserSchema>;

export type ListLessonsForModerationQueryInput = z.infer<
  typeof listLessonsForModerationQuerySchema
>;

export type ModerateLessonInput = z.infer<typeof moderateLessonSchema>;

export type ListCommunityModerationQueryInput = z.infer<
  typeof listCommunityModerationQuerySchema
>;

export type RemoveCommunityContentParamInput = z.infer<
  typeof removeCommunityContentParamSchema
>;

export type ListAdminReportsQueryInput = z.infer<
  typeof listAdminReportsQuerySchema
>;

export type UpdateAdminReportInput = z.infer<typeof updateAdminReportSchema>;

export type ListAdminOrdersQueryInput = z.infer<typeof listAdminOrdersQuerySchema>;
