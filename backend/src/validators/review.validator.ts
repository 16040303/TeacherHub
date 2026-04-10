import { z } from "zod";

export const reviewIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateReviewSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    comment: z.string().trim().min(1).max(3000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one review field must be provided",
  });

export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
