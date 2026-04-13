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
    .min(8, "Password must be at least 8 characters")
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

export const googleLoginSchema = z.object({
  idToken: z.string().trim().min(1, "Google ID token is required"),
});

export const verifyEmailSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, "Verification token is required"),
});

export const resendVerificationSchema = z.object({
  email: z
    .string()
    .trim()
    .email("A valid email is required")
    .transform((value) => value.toLowerCase()),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1, "Refresh token is required"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().trim().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("A valid email is required")
    .transform((value) => value.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, "Reset token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(64, "Password must be at most 64 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
