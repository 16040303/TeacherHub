import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return value === "" ? null : value;
  });

const socialLinkSchema = z.object({
  platform: z.string().trim().min(1).max(50),
  url: z.string().trim().url().max(1000),
});

export const updateMyProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(255).optional(),
    avatarUrl: z.string().trim().url().max(1000).optional(),
    bio: z.string().trim().max(3000).optional(),
    headline: optionalTrimmedString,
    expertise: optionalTrimmedString,
    yearsExperience: z.coerce.number().int().min(0).max(80).optional(),
    location: optionalTrimmedString,
    socialLinks: z.array(socialLinkSchema).max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field must be provided",
  });

export const teacherIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const teacherLessonsQuerySchema = z.object({
  includeDraft: z.coerce.boolean().optional().default(false),
});

export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;
export type TeacherLessonsQueryInput = z.infer<typeof teacherLessonsQuerySchema>;
