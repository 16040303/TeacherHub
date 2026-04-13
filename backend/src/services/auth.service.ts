import crypto from "crypto";
import {
  AuthAuditEvent,
  AuthProvider,
  RefreshTokenRevocationReason,
  UserRole,
} from "@prisma/client";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import prisma from "../config/prisma";
import { env } from "../config/env";
import {
  AuthRequestContext,
  logAuthAuditEvent,
  normalizeAuthRequestContext,
} from "./auth-audit.service";
import { HttpError } from "../utils/http-error";
import {
  getTokenExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import {
  sendResetPasswordEmail,
  sendVerificationEmail,
} from "../utils/mailer";
import {
  ForgotPasswordInput,
  GoogleLoginInput,
  LoginInput,
  LogoutInput,
  RefreshTokenInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "../validators/auth.validator";

export interface SafeUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  expiresAt: string;
  user: SafeUser;
}

export interface MessageResponse {
  message: string;
}

type AuthUserRecord = {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: "Invalid email or password",
  EMAIL_NOT_VERIFIED: "Please verify your email before logging in",
  INVALID_OR_EXPIRED_VERIFICATION_TOKEN: "Invalid or expired verification token",
  INVALID_OR_EXPIRED_REFRESH_TOKEN: "Invalid or expired refresh token",
  INVALID_OR_EXPIRED_RESET_TOKEN: "Invalid or expired reset token",
  INVALID_GOOGLE_ID_TOKEN: "Invalid Google ID token",
  GOOGLE_EMAIL_REQUIRED: "Google account email is not available",
  GOOGLE_EMAIL_NOT_VERIFIED: "Google account email must be verified",
  FORGOT_PASSWORD_GENERIC:
    "If an account with this email exists, a password reset link has been sent.",
  LOGOUT_SUCCESS: "Logged out successfully",
} as const;

const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 1;

const toSafeUser = (user: AuthUserRecord): SafeUser => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const resolveRegistrationRole = (role?: UserRole): UserRole => {
  if (!role) {
    return UserRole.TEACHER;
  }

  if (role === UserRole.ADMIN) {
    throw new HttpError(403, "Admin role cannot be self-assigned");
  }

  return role;
};

const generateTimedToken = (
  expiryHours: number
): { raw: string; hashed: string; expiresAt: Date } => {
  const raw = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
  return { raw, hashed, expiresAt };
};

const generateVerificationToken = (): {
  raw: string;
  hashed: string;
  expiresAt: Date;
} => generateTimedToken(VERIFICATION_TOKEN_EXPIRY_HOURS);

const generateResetPasswordToken = (): {
  raw: string;
  hashed: string;
  expiresAt: Date;
} => generateTimedToken(PASSWORD_RESET_TOKEN_EXPIRY_HOURS);

const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const hashRefreshToken = (refreshToken: string): string => {
  // Persist only a one-way digest of refresh tokens (never raw token material).
  return hashToken(refreshToken);
};

const googleOAuthClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

interface GoogleIdentityProfile {
  providerAccountId: string;
  email: string;
  fullName: string;
}

const deriveNameFromEmailLocalPart = (email: string): string => {
  const localPart = email.split("@")[0]?.trim() ?? "";
  if (!localPart) {
    return "Google User";
  }

  const normalized = localPart.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Google User";
  }

  return normalized
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
    .slice(0, 120);
};

const resolveGoogleDisplayName = (name: string | undefined, email: string): string => {
  const normalized = typeof name === "string" ? name.trim() : "";
  return normalized || deriveNameFromEmailLocalPart(email);
};

const verifyGoogleIdToken = async (idToken: string): Promise<GoogleIdentityProfile> => {
  let payload:
    | {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
      }
    | undefined;

  try {
    const ticket = await googleOAuthClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, AUTH_ERROR_MESSAGES.INVALID_GOOGLE_ID_TOKEN);
  }

  const providerAccountId = payload?.sub?.trim();
  if (!providerAccountId) {
    throw new HttpError(401, AUTH_ERROR_MESSAGES.INVALID_GOOGLE_ID_TOKEN);
  }

  const email = payload?.email?.trim().toLowerCase();
  if (!email) {
    throw new HttpError(400, AUTH_ERROR_MESSAGES.GOOGLE_EMAIL_REQUIRED);
  }

  if (!payload?.email_verified) {
    throw new HttpError(403, AUTH_ERROR_MESSAGES.GOOGLE_EMAIL_NOT_VERIFIED);
  }

  return {
    providerAccountId,
    email,
    fullName: resolveGoogleDisplayName(payload?.name, email),
  };
};

interface IssueAuthSessionResult {
  authResponse: AuthResponse;
  refreshTokenRecordId: number;
}

const issueAuthSession = async (
  safeUser: SafeUser,
  context?: AuthRequestContext
): Promise<IssueAuthSessionResult> => {
  const payload = {
    userId: safeUser.id,
    email: safeUser.email,
    role: safeUser.role,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const normalizedContext = normalizeAuthRequestContext(context);
  const issuedAt = new Date();

  const createdRefreshToken = await prisma.refreshToken.create({
    data: {
      userId: safeUser.id,
      token: hashRefreshToken(refreshToken),
      expiresAt: getTokenExpiryDate(refreshToken),
      deviceId: normalizedContext.deviceId,
      userAgent: normalizedContext.userAgent,
      ipAddress: normalizedContext.ipAddress,
      lastUsedAt: issuedAt,
    },
    select: {
      id: true,
    },
  });

  return {
    authResponse: {
      token: accessToken,
      refreshToken,
      expiresAt: getTokenExpiryDate(accessToken).toISOString(),
      user: safeUser,
    },
    refreshTokenRecordId: createdRefreshToken.id,
  };
};

const findSafeUserById = async (userId: number): Promise<SafeUser | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || !user.isEmailVerified) {
    return null;
  }

  return toSafeUser(user);
};

export const register = async (
  payload: RegisterInput,
  context?: AuthRequestContext
): Promise<MessageResponse> => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true },
  });

  if (existingUser) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.REGISTER,
      success: false,
      userId: existingUser.id,
      message: "Registration blocked: email is already registered",
      metadata: {
        email: payload.email,
      },
      context,
    });

    throw new HttpError(409, "Email is already registered");
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);
  const { raw, hashed, expiresAt } = generateVerificationToken();

  const createdUser = await prisma.user.create({
    data: {
      fullName: payload.fullName,
      email: payload.email,
      password: hashedPassword,
      role: resolveRegistrationRole(payload.role),
      isEmailVerified: false,
      emailVerificationToken: hashed,
      emailVerificationExp: expiresAt,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  });

  await sendVerificationEmail(createdUser.email, createdUser.fullName, raw);

  await logAuthAuditEvent({
    event: AuthAuditEvent.REGISTER,
    success: true,
    userId: createdUser.id,
    message: "Registration successful; verification email sent",
    metadata: {
      email: createdUser.email,
    },
    context,
  });

  return {
    message:
      "Registration successful. Please check your email to verify your account.",
  };
};

export const verifyEmail = async (
  payload: VerifyEmailInput,
  context?: AuthRequestContext
): Promise<MessageResponse> => {
  const hashed = hashToken(payload.token);

  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: hashed },
    select: {
      id: true,
      isEmailVerified: true,
      emailVerificationExp: true,
    },
  });

  if (!user) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.VERIFY_EMAIL_FAILED,
      success: false,
      message: "Email verification failed: token not found",
      context,
    });

    throw new HttpError(400, AUTH_ERROR_MESSAGES.INVALID_OR_EXPIRED_VERIFICATION_TOKEN);
  }

  if (user.isEmailVerified) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.VERIFY_EMAIL_SUCCESS,
      success: true,
      userId: user.id,
      message: "Email already verified",
      context,
    });

    return { message: "Email is already verified. You can log in." };
  }

  if (user.emailVerificationExp && user.emailVerificationExp < new Date()) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.VERIFY_EMAIL_FAILED,
      success: false,
      userId: user.id,
      message: "Email verification failed: token expired",
      context,
    });

    throw new HttpError(400, AUTH_ERROR_MESSAGES.INVALID_OR_EXPIRED_VERIFICATION_TOKEN);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExp: null,
    },
  });

  await logAuthAuditEvent({
    event: AuthAuditEvent.VERIFY_EMAIL_SUCCESS,
    success: true,
    userId: user.id,
    message: "Email verified successfully",
    context,
  });

  return { message: "Email verified successfully. You can now log in." };
};

export const googleLogin = async (
  payload: GoogleLoginInput,
  context?: AuthRequestContext
): Promise<AuthResponse> => {
  let resolvedEmail: string | null = null;
  let resolvedUserId: number | null = null;

  try {
    const googleProfile = await verifyGoogleIdToken(payload.idToken);
    resolvedEmail = googleProfile.email;

    const safeUser = await prisma.$transaction(async (tx) => {
      const existingIdentity = await tx.authIdentity.findUnique({
        where: {
          provider_providerAccountId: {
            provider: AuthProvider.GOOGLE,
            providerAccountId: googleProfile.providerAccountId,
          },
        },
        select: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (existingIdentity?.user) {
        return toSafeUser(existingIdentity.user);
      }

      const existingUser = await tx.user.findUnique({
        where: { email: googleProfile.email },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          status: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (existingUser) {
        const linkedUser = existingUser.isEmailVerified
          ? existingUser
          : await tx.user.update({
              where: { id: existingUser.id },
              data: {
                isEmailVerified: true,
                emailVerifiedAt: new Date(),
                emailVerificationToken: null,
                emailVerificationExp: null,
              },
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            });

        await tx.authIdentity.upsert({
          where: {
            provider_providerAccountId: {
              provider: AuthProvider.GOOGLE,
              providerAccountId: googleProfile.providerAccountId,
            },
          },
          update: {
            providerEmail: googleProfile.email,
          },
          create: {
            userId: linkedUser.id,
            provider: AuthProvider.GOOGLE,
            providerAccountId: googleProfile.providerAccountId,
            providerEmail: googleProfile.email,
          },
        });

        return toSafeUser(linkedUser);
      }

      const createdUser = await tx.user.create({
        data: {
          fullName: googleProfile.fullName,
          email: googleProfile.email,
          password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
          role: UserRole.TEACHER,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          emailVerificationToken: null,
          emailVerificationExp: null,
          passwordResetToken: null,
          passwordResetExp: null,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.authIdentity.create({
        data: {
          userId: createdUser.id,
          provider: AuthProvider.GOOGLE,
          providerAccountId: googleProfile.providerAccountId,
          providerEmail: googleProfile.email,
        },
      });

      return toSafeUser(createdUser);
    });

    resolvedUserId = safeUser.id;

    const issuedSession = await issueAuthSession(safeUser, context);

    await logAuthAuditEvent({
      event: AuthAuditEvent.LOGIN_SUCCESS,
      success: true,
      userId: safeUser.id,
      refreshTokenId: issuedSession.refreshTokenRecordId,
      message: "Google login successful",
      metadata: {
        provider: AuthProvider.GOOGLE,
        email: resolvedEmail,
      },
      context,
    });

    return issuedSession.authResponse;
  } catch (error) {
    console.error('[Google Login] Backend verifyGoogleIdToken failed:', {
      error: error instanceof Error ? error.message : String(error),
      statusCode: error instanceof HttpError ? error.statusCode : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });

    await logAuthAuditEvent({
      event: AuthAuditEvent.LOGIN_FAILED,
      success: false,
      userId: resolvedUserId,
      message:
        error instanceof Error
          ? `Google login failed: ${error.message}`
          : "Google login failed",
      metadata: {
        provider: AuthProvider.GOOGLE,
        email: resolvedEmail,
      },
      context,
    });

    throw error;
  }
};

export const login = async (
  payload: LoginInput,
  context?: AuthRequestContext
): Promise<AuthResponse> => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      password: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.LOGIN_FAILED,
      success: false,
      message: "Login failed: invalid credentials",
      metadata: {
        email: payload.email,
      },
      context,
    });

    throw new HttpError(401, AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
  }

  const isPasswordValid = await bcrypt.compare(payload.password, user.password);

  if (!isPasswordValid) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.LOGIN_FAILED,
      success: false,
      userId: user.id,
      message: "Login failed: invalid credentials",
      context,
    });

    throw new HttpError(401, AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
  }

  if (!user.isEmailVerified) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.LOGIN_FAILED,
      success: false,
      userId: user.id,
      message: "Login failed: email not verified",
      context,
    });

    throw new HttpError(403, AUTH_ERROR_MESSAGES.EMAIL_NOT_VERIFIED);
  }

  const safeUser = toSafeUser({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });

  const issuedSession = await issueAuthSession(safeUser, context);

  await logAuthAuditEvent({
    event: AuthAuditEvent.LOGIN_SUCCESS,
    success: true,
    userId: safeUser.id,
    refreshTokenId: issuedSession.refreshTokenRecordId,
    message: "Login successful",
    context,
  });

  return issuedSession.authResponse;
};

export const refreshToken = async (
  payload: RefreshTokenInput,
  context?: AuthRequestContext
): Promise<AuthResponse> => {
  const tokenHash = hashRefreshToken(payload.refreshToken);
  let refreshPayload: { userId: number };

  try {
    refreshPayload = verifyRefreshToken(payload.refreshToken);
  } catch {
    await logAuthAuditEvent({
      event: AuthAuditEvent.REFRESH_FAILED,
      success: false,
      message: "Refresh failed: refresh token verification failed",
      context,
    });

    throw new HttpError(401, AUTH_ERROR_MESSAGES.INVALID_OR_EXPIRED_REFRESH_TOKEN);
  }

  const tokenRecord = await prisma.refreshToken.findFirst({
    where: {
      token: tokenHash,
      userId: refreshPayload.userId,
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      replacedByTokenId: true,
      deviceId: true,
      userAgent: true,
      ipAddress: true,
    },
  });

  if (!tokenRecord) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.REFRESH_FAILED,
      success: false,
      userId: refreshPayload.userId,
      message: "Refresh failed: token not found",
      context,
    });

    throw new HttpError(401, AUTH_ERROR_MESSAGES.INVALID_OR_EXPIRED_REFRESH_TOKEN);
  }

  if (tokenRecord.revokedAt) {
    if (tokenRecord.replacedByTokenId) {
      const revokedAt = new Date();

      await prisma.refreshToken.updateMany({
        where: {
          userId: tokenRecord.userId,
          revokedAt: null,
        },
        data: {
          revokedAt,
          revocationReason: RefreshTokenRevocationReason.REUSE_DETECTED,
          lastUsedAt: revokedAt,
        },
      });

      await logAuthAuditEvent({
        event: AuthAuditEvent.REFRESH_REUSE_DETECTED,
        success: false,
        userId: tokenRecord.userId,
        refreshTokenId: tokenRecord.id,
        message: "Refresh reuse detected on rotated token",
        context,
      });
    } else {
      await logAuthAuditEvent({
        event: AuthAuditEvent.REFRESH_FAILED,
        success: false,
        userId: tokenRecord.userId,
        refreshTokenId: tokenRecord.id,
        message: "Refresh failed: token already revoked",
        context,
      });
    }

    throw new HttpError(401, AUTH_ERROR_MESSAGES.INVALID_OR_EXPIRED_REFRESH_TOKEN);
  }

  if (tokenRecord.expiresAt <= new Date()) {
    const revokedAt = new Date();

    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        revokedAt,
        revocationReason: RefreshTokenRevocationReason.EXPIRED,
        lastUsedAt: revokedAt,
      },
    });

    await logAuthAuditEvent({
      event: AuthAuditEvent.REFRESH_FAILED,
      success: false,
      userId: tokenRecord.userId,
      refreshTokenId: tokenRecord.id,
      message: "Refresh failed: token expired",
      context,
    });

    throw new HttpError(401, AUTH_ERROR_MESSAGES.INVALID_OR_EXPIRED_REFRESH_TOKEN);
  }

  const safeUser = await findSafeUserById(tokenRecord.userId);

  if (!safeUser) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.REFRESH_FAILED,
      success: false,
      userId: tokenRecord.userId,
      refreshTokenId: tokenRecord.id,
      message: "Refresh failed: user unavailable",
      context,
    });

    throw new HttpError(401, AUTH_ERROR_MESSAGES.INVALID_OR_EXPIRED_REFRESH_TOKEN);
  }

  const nextPayload = {
    userId: safeUser.id,
    email: safeUser.email,
    role: safeUser.role,
  };
  const nextAccessToken = signAccessToken(nextPayload);
  const nextRefreshToken = signRefreshToken(nextPayload);
  const normalizedContext = normalizeAuthRequestContext(context);
  const rotatedAt = new Date();

  const createdNextToken = await prisma.$transaction(async (tx) => {
    const createdToken = await tx.refreshToken.create({
      data: {
        userId: safeUser.id,
        token: hashRefreshToken(nextRefreshToken),
        expiresAt: getTokenExpiryDate(nextRefreshToken),
        deviceId: normalizedContext.deviceId ?? tokenRecord.deviceId ?? null,
        userAgent: normalizedContext.userAgent ?? tokenRecord.userAgent ?? null,
        ipAddress: normalizedContext.ipAddress ?? tokenRecord.ipAddress ?? null,
        lastUsedAt: rotatedAt,
      },
      select: {
        id: true,
      },
    });

    await tx.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        revokedAt: rotatedAt,
        revocationReason: RefreshTokenRevocationReason.ROTATED,
        replacedByTokenId: createdToken.id,
        lastUsedAt: rotatedAt,
      },
    });

    return createdToken;
  });

  await logAuthAuditEvent({
    event: AuthAuditEvent.REFRESH_SUCCESS,
    success: true,
    userId: safeUser.id,
    refreshTokenId: createdNextToken.id,
    message: "Refresh token rotated successfully",
    metadata: {
      replacedTokenId: tokenRecord.id,
    },
    context,
  });

  return {
    token: nextAccessToken,
    refreshToken: nextRefreshToken,
    expiresAt: getTokenExpiryDate(nextAccessToken).toISOString(),
    user: safeUser,
  };
};

/**
 * Logout scope is intentionally current-session only: we revoke only the provided
 * refresh token, and leave other active refresh tokens untouched.
 */
export const logout = async (
  payload: LogoutInput,
  context?: AuthRequestContext
): Promise<MessageResponse> => {
  const refreshToken = payload.refreshToken?.trim();

  if (!refreshToken) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.LOGOUT_IGNORED,
      success: true,
      message: "Logout ignored: no refresh token provided",
      context,
    });

    return { message: AUTH_ERROR_MESSAGES.LOGOUT_SUCCESS };
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        token: hashRefreshToken(refreshToken),
        userId: decoded.userId,
      },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
      },
    });

    if (!tokenRecord || tokenRecord.revokedAt) {
      await logAuthAuditEvent({
        event: AuthAuditEvent.LOGOUT_IGNORED,
        success: true,
        userId: decoded.userId,
        refreshTokenId: tokenRecord?.id ?? null,
        message: "Logout ignored: token missing or already revoked",
        context,
      });

      return { message: AUTH_ERROR_MESSAGES.LOGOUT_SUCCESS };
    }

    const revokedAt = new Date();
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        revokedAt,
        revocationReason: RefreshTokenRevocationReason.LOGOUT,
        lastUsedAt: revokedAt,
      },
    });

    await logAuthAuditEvent({
      event: AuthAuditEvent.LOGOUT_SUCCESS,
      success: true,
      userId: tokenRecord.userId,
      refreshTokenId: tokenRecord.id,
      message: "Logout successful",
      context,
    });
  } catch {
    await logAuthAuditEvent({
      event: AuthAuditEvent.LOGOUT_IGNORED,
      success: false,
      message: "Logout ignored: invalid or malformed refresh token",
      context,
    });
  }

  return { message: AUTH_ERROR_MESSAGES.LOGOUT_SUCCESS };
};

export const forgotPassword = async (
  payload: ForgotPasswordInput,
  context?: AuthRequestContext
): Promise<MessageResponse> => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  });

  if (!user) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.FORGOT_PASSWORD_REQUESTED,
      success: true,
      message: "Password reset requested for unknown email",
      metadata: {
        emailMatched: false,
      },
      context,
    });

    return { message: AUTH_ERROR_MESSAGES.FORGOT_PASSWORD_GENERIC };
  }

  const { raw, hashed, expiresAt } = generateResetPasswordToken();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashed,
      passwordResetExp: expiresAt,
    },
  });

  await sendResetPasswordEmail(user.email, user.fullName, raw);

  await logAuthAuditEvent({
    event: AuthAuditEvent.FORGOT_PASSWORD_REQUESTED,
    success: true,
    userId: user.id,
    message: "Password reset token issued",
    metadata: {
      emailMatched: true,
    },
    context,
  });

  return { message: AUTH_ERROR_MESSAGES.FORGOT_PASSWORD_GENERIC };
};

export const resetPassword = async (
  payload: ResetPasswordInput,
  context?: AuthRequestContext
): Promise<MessageResponse> => {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashToken(payload.token),
    },
    select: {
      id: true,
      passwordResetExp: true,
    },
  });

  if (!user || !user.passwordResetExp || user.passwordResetExp <= new Date()) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.RESET_PASSWORD_FAILED,
      success: false,
      userId: user?.id ?? null,
      message: "Password reset failed: token invalid or expired",
      context,
    });

    throw new HttpError(400, AUTH_ERROR_MESSAGES.INVALID_OR_EXPIRED_RESET_TOKEN);
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);
  const revokedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExp: null,
      },
    });

    await tx.refreshToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt,
        revocationReason: RefreshTokenRevocationReason.PASSWORD_RESET,
        lastUsedAt: revokedAt,
      },
    });
  });

  await logAuthAuditEvent({
    event: AuthAuditEvent.RESET_PASSWORD_SUCCESS,
    success: true,
    userId: user.id,
    message: "Password reset successful",
    context,
  });

  return { message: "Password reset successful. Please log in again." };
};

export const resendVerification = async (
  payload: ResendVerificationInput,
  context?: AuthRequestContext
): Promise<MessageResponse> => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: {
      id: true,
      fullName: true,
      email: true,
      isEmailVerified: true,
    },
  });

  // Generic response to avoid account enumeration
  if (!user) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.RESEND_VERIFICATION_REQUESTED,
      success: true,
      message: "Resend verification requested for unknown email",
      metadata: {
        emailMatched: false,
      },
      context,
    });

    return {
      message:
        "If an account with this email exists, a verification email has been sent.",
    };
  }

  if (user.isEmailVerified) {
    await logAuthAuditEvent({
      event: AuthAuditEvent.RESEND_VERIFICATION_REQUESTED,
      success: true,
      userId: user.id,
      message: "Resend verification requested for already verified email",
      metadata: {
        emailMatched: true,
        alreadyVerified: true,
      },
      context,
    });

    return { message: "This email is already verified. You can log in." };
  }

  const { raw, hashed, expiresAt } = generateVerificationToken();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: hashed,
      emailVerificationExp: expiresAt,
    },
  });

  await sendVerificationEmail(user.email, user.fullName, raw);

  await logAuthAuditEvent({
    event: AuthAuditEvent.RESEND_VERIFICATION_REQUESTED,
    success: true,
    userId: user.id,
    message: "Verification email resent",
    metadata: {
      emailMatched: true,
      alreadyVerified: false,
    },
    context,
  });

  return {
    message:
      "If an account with this email exists, a verification email has been sent.",
  };
};
