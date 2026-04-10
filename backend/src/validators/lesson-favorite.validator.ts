import { z } from "zod";

export const lessonFavoriteLessonIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
