import { UserRole } from "@prisma/client";
import { z } from "zod";

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(120, "Full name must be at most 120 characters"),
  email: z
    .string()
    .trim()
    .email("A valid email is required")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(64, "Password must be at most 64 characters"),
  role: z
    .nativeEnum(UserRole)
    .optional()
    .refine((role) => role !== UserRole.ADMIN, "Admin role cannot be self-assigned"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("A valid email is required")
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
