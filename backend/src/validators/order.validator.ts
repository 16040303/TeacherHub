import { PaymentStatus } from "@prisma/client";
import { z } from "zod";

const paymentStatusInputSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum(["pending", "paid", "failed", "cancelled"]))
  .transform((value): PaymentStatus => value.toUpperCase() as PaymentStatus);

const paymentMethodInputSchema = z
  .string()
  .trim()
  .min(1, "payment method is required")
  .max(64, "payment method is too long")
  .transform((value) => value.toUpperCase());

const paymentReferenceInputSchema = z
  .string()
  .trim()
  .min(1, "payment reference cannot be empty")
  .max(191, "payment reference is too long")
  .optional();

export const createOrderSchema = z.object({
  lessonId: z.coerce.number().int().positive(),
});

export const orderIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const entitlementLessonParamSchema = z.object({
  lessonId: z.coerce.number().int().positive(),
});

export const processOrderPaymentSchema = z.object({
  status: paymentStatusInputSchema,
  method: paymentMethodInputSchema,
  reference: paymentReferenceInputSchema,
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ProcessOrderPaymentInput = z.infer<typeof processOrderPaymentSchema>;
