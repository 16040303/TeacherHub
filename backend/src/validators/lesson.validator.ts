import { z } from "zod";

export const createLessonSchema = z.object({
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().min(10),
  price: z.coerce.number().min(0),
  fileUrl: z.string().trim().url(),
  subject: z.string().trim().min(1).max(100).optional(),
  gradeLevel: z.string().trim().min(1).max(50).optional(),
  isPublished: z.coerce.boolean().optional(),
  thumbnailUrl: z.string().trim().url().optional(),
});

export const updateLessonSchema = createLessonSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  {
    message: "At least one field is required to update lesson",
  }
);

export const lessonIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createLessonReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(3000),
});

export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type CreateLessonReviewInput = z.infer<typeof createLessonReviewSchema>;
