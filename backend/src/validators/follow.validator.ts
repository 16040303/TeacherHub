import { z } from "zod";

export const followUserIdParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
});
