import assert from "node:assert/strict";
import crypto from "crypto";
import { beforeEach, test } from "node:test";
import bcrypt from "bcrypt";
import { AuthAuditEvent, RefreshTokenRevocationReason, UserRole } from "@prisma/client";
import prisma from "../src/config/prisma";
import {
  forgotPassword,
  login,
  logout,
  refreshToken as refreshAuthToken,
  register,
  resetPassword,
  verifyEmail,
} from "../src/services/auth.service";
import { HttpError } from "../src/utils/http-error";

interface MockUser {
  id: number;
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  status: string;
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
  emailVerificationToken: string | null;
  emailVerificationExp: Date | null;
  passwordResetToken: string | null;
  passwordResetExp: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockRefreshToken {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date;
  revokedAt: Date | null;
  revocationReason: RefreshTokenRevocationReason | null;
  replacedByTokenId: number | null;
  deviceId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockAuthAuditLog {
  id: number;
  userId: number | null;
  refreshTokenId: number | null;
  event: AuthAuditEvent;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  deviceId: string | null;
  message: string | null;
  metadata: unknown;
  createdAt: Date;
}

interface MockState {
  users: MockUser[];
  refreshTokens: MockRefreshToken[];
  authAuditLogs: MockAuthAuditLog[];
  nextUserId: number;
  nextRefreshTokenId: number;
  nextAuthAuditLogId: number;
}

let state: MockState;

const createState = (): MockState => ({
  users: [],
  refreshTokens: [],
  authAuditLogs: [],
  nextUserId: 1,
  nextRefreshTokenId: 1,
  nextAuthAuditLogId: 1,
});

const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const isDateEqual = (left: unknown, right: unknown): boolean => {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }

  return left === right;
};

const matchesWhere = <T extends Record<string, unknown>>(
  item: T,
  where: Record<string, unknown> | undefined
): boolean => {
  if (!where) {
    return true;
  }

  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) {
      return true;
    }

    return isDateEqual(item[key], value);
  });
};

const installPrismaMock = (): void => {
  const prismaAny = prisma as any;
  const userDelegate = prismaAny.user as any;
  const refreshTokenDelegate = prismaAny.refreshToken as any;
  const authAuditLogDelegate = prismaAny.authAuditLog as any;

  userDelegate.findUnique = async ({ where }: any) => {
    if (where?.email) {
      return state.users.find((item) => item.email === where.email) ?? null;
    }

    if (typeof where?.id === "number") {
      return state.users.find((item) => item.id === where.id) ?? null;
    }

    return null;
  };

  userDelegate.findFirst = async ({ where }: any) => {
    return state.users.find((item) => matchesWhere(item as any, where)) ?? null;
  };

  userDelegate.create = async ({ data }: any) => {
    const now = new Date();
    const created: MockUser = {
      id: state.nextUserId++,
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      role: data.role,
      status: "ACTIVE",
      isEmailVerified: Boolean(data.isEmailVerified),
      emailVerifiedAt: null,
      emailVerificationToken: data.emailVerificationToken ?? null,
      emailVerificationExp: data.emailVerificationExp ?? null,
      passwordResetToken: data.passwordResetToken ?? null,
      passwordResetExp: data.passwordResetExp ?? null,
      createdAt: now,
      updatedAt: now,
    };

    state.users.push(created);

    return created;
  };

  userDelegate.update = async ({ where, data }: any) => {
    const target = state.users.find((item) => item.id === where.id);

    if (!target) {
      throw new Error("User not found in test mock");
    }

    Object.assign(target, data, { updatedAt: new Date() });
    return target;
  };

  refreshTokenDelegate.create = async ({ data }: any) => {
    const now = new Date();
    const created: MockRefreshToken = {
      id: state.nextRefreshTokenId++,
      userId: data.userId,
      token: data.token,
      expiresAt: data.expiresAt,
      revokedAt: data.revokedAt ?? null,
      revocationReason: data.revocationReason ?? null,
      replacedByTokenId: data.replacedByTokenId ?? null,
      deviceId: data.deviceId ?? null,
      userAgent: data.userAgent ?? null,
      ipAddress: data.ipAddress ?? null,
      lastUsedAt: data.lastUsedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };

    state.refreshTokens.push(created);
    return created;
  };

  refreshTokenDelegate.findFirst = async ({ where }: any) => {
    return (
      state.refreshTokens.find((item) => matchesWhere(item as any, where)) ?? null
    );
  };

  refreshTokenDelegate.update = async ({ where, data }: any) => {
    const target = state.refreshTokens.find((item) => item.id === where.id);

    if (!target) {
      throw new Error("Refresh token not found in test mock");
    }

    Object.assign(target, data, { updatedAt: new Date() });
    return target;
  };

  refreshTokenDelegate.updateMany = async ({ where, data }: any) => {
    const targets = state.refreshTokens.filter((item) =>
      matchesWhere(item as any, where)
    );

    targets.forEach((token) => {
      Object.assign(token, data, { updatedAt: new Date() });
    });

    return { count: targets.length };
  };

  authAuditLogDelegate.create = async ({ data }: any) => {
    const created: MockAuthAuditLog = {
      id: state.nextAuthAuditLogId++,
      userId: data.userId ?? null,
      refreshTokenId: data.refreshTokenId ?? null,
      event: data.event,
      success: data.success ?? true,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      deviceId: data.deviceId ?? null,
      message: data.message ?? null,
      metadata: data.metadata ?? null,
      createdAt: new Date(),
    };

    state.authAuditLogs.push(created);
    return created;
  };

  prismaAny.$transaction = async (callback: (tx: any) => Promise<unknown>) => {
    return callback({
      user: userDelegate,
      refreshToken: refreshTokenDelegate,
    });
  };
};

const seedVerifiedUser = async (
  overrides: Partial<Pick<MockUser, "email" | "fullName" | "role">> & {
    password?: string;
  } = {}
): Promise<{ user: MockUser; plainPassword: string }> => {
  const plainPassword = overrides.password ?? "Password@123";
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  const now = new Date();

  const user: MockUser = {
    id: state.nextUserId++,
    fullName: overrides.fullName ?? "Verified User",
    email: overrides.email ?? "verified@example.com",
    password: hashedPassword,
    role: overrides.role ?? UserRole.TEACHER,
    status: "ACTIVE",
    isEmailVerified: true,
    emailVerifiedAt: now,
    emailVerificationToken: null,
    emailVerificationExp: null,
    passwordResetToken: null,
    passwordResetExp: null,
    createdAt: now,
    updatedAt: now,
  };

  state.users.push(user);

  return { user, plainPassword };
};

const findAuditLog = (
  event: AuthAuditEvent,
  predicate?: (entry: MockAuthAuditLog) => boolean
): MockAuthAuditLog | undefined => {
  return state.authAuditLogs.find(
    (entry) => entry.event === event && (predicate ? predicate(entry) : true)
  );
};

beforeEach(() => {
  state = createState();
  installPrismaMock();
});

test("register creates unverified user and blocks login until verification", async () => {
  const context = {
    ipAddress: "127.0.0.1",
    userAgent: "AuthServiceTest/1.0",
    deviceId: "device-register",
  };

  const registerResult = await register(
    {
      fullName: "Alice Teacher",
      email: "alice@example.com",
      password: "Password@123",
      role: UserRole.TEACHER,
    },
    context
  );

  assert.equal(
    registerResult.message,
    "Registration successful. Please check your email to verify your account."
  );
  assert.equal(state.users.length, 1);
  assert.equal(state.users[0].isEmailVerified, false);
  assert.ok(state.users[0].emailVerificationToken);
  assert.ok(state.users[0].emailVerificationExp);
  assert.equal(state.refreshTokens.length, 0);

  const registerAudit = findAuditLog(
    AuthAuditEvent.REGISTER,
    (entry) => entry.success === true
  );
  assert.ok(registerAudit);
  assert.equal(registerAudit?.userId, state.users[0].id);
  assert.equal(registerAudit?.ipAddress, context.ipAddress);
  assert.equal(registerAudit?.deviceId, context.deviceId);

  await assert.rejects(
    login(
      {
        email: "alice@example.com",
        password: "Password@123",
      },
      context
    ),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 403);
      assert.equal(error.message, "Please verify your email before logging in");
      return true;
    }
  );

  const loginFailedAudit = findAuditLog(
    AuthAuditEvent.LOGIN_FAILED,
    (entry) => entry.userId === state.users[0].id
  );
  assert.ok(loginFailedAudit);
});

test("verify email enables login and refresh token rotation with reuse detection", async () => {
  const seeded = await seedVerifiedUser({ email: "bob@example.com" });
  const context = {
    ipAddress: "10.0.0.10",
    userAgent: "AuthServiceTest/2.0",
    deviceId: "device-bob",
  };
  const verifyRawToken = "verify-token-bob";
  seeded.user.isEmailVerified = false;
  seeded.user.emailVerifiedAt = null;
  seeded.user.emailVerificationToken = hashToken(verifyRawToken);
  seeded.user.emailVerificationExp = new Date(Date.now() + 60 * 60 * 1000);

  const verifyResult = await verifyEmail({ token: verifyRawToken }, context);
  assert.equal(verifyResult.message, "Email verified successfully. You can now log in.");
  assert.equal(seeded.user.isEmailVerified, true);
  assert.equal(seeded.user.emailVerificationToken, null);

  const loginResult = await login(
    {
      email: seeded.user.email,
      password: seeded.plainPassword,
    },
    context
  );

  assert.ok(loginResult.token.length > 10);
  assert.ok(loginResult.refreshToken.length > 10);
  assert.ok(Date.parse(loginResult.expiresAt) > Date.now());
  assert.equal(state.refreshTokens.length, 1);
  assert.equal(state.refreshTokens[0].revokedAt, null);
  assert.equal(state.refreshTokens[0].token, hashToken(loginResult.refreshToken));
  assert.notEqual(state.refreshTokens[0].token, loginResult.refreshToken);
  assert.equal(state.refreshTokens[0].deviceId, context.deviceId);
  assert.equal(state.refreshTokens[0].userAgent, context.userAgent);
  assert.equal(state.refreshTokens[0].ipAddress, context.ipAddress);

  const refreshed = await refreshAuthToken(
    { refreshToken: loginResult.refreshToken },
    context
  );

  assert.ok(refreshed.token.length > 10);
  assert.notEqual(refreshed.refreshToken, loginResult.refreshToken);
  assert.equal(state.refreshTokens.length, 2);

  const rotatedRecord = state.refreshTokens.find(
    (item) => item.token === hashToken(loginResult.refreshToken)
  );
  assert.ok(rotatedRecord?.revokedAt);
  assert.equal(rotatedRecord?.revocationReason, RefreshTokenRevocationReason.ROTATED);
  assert.ok(typeof rotatedRecord?.replacedByTokenId === "number");

  const activeTokensBeforeReuse = state.refreshTokens.filter(
    (item) => item.revokedAt === null
  );
  assert.equal(activeTokensBeforeReuse.length, 1);
  assert.equal(activeTokensBeforeReuse[0].token, hashToken(refreshed.refreshToken));
  assert.notEqual(activeTokensBeforeReuse[0].token, hashToken(loginResult.refreshToken));

  await assert.rejects(
    refreshAuthToken({ refreshToken: loginResult.refreshToken }, context),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.message, "Invalid or expired refresh token");
      return true;
    }
  );

  const activeTokensAfterReuse = state.refreshTokens.filter((item) => item.revokedAt === null);
  assert.equal(activeTokensAfterReuse.length, 0);

  const rotatedToken = state.refreshTokens.find(
    (item) => item.token === hashToken(loginResult.refreshToken)
  );
  const replacementToken = state.refreshTokens.find(
    (item) => item.token === hashToken(refreshed.refreshToken)
  );

  assert.equal(rotatedToken?.revocationReason, RefreshTokenRevocationReason.ROTATED);
  assert.equal(
    replacementToken?.revocationReason,
    RefreshTokenRevocationReason.REUSE_DETECTED
  );

  const reuseDetectedAudit = findAuditLog(
    AuthAuditEvent.REFRESH_REUSE_DETECTED,
    (entry) => entry.userId === seeded.user.id && entry.success === false
  );
  assert.ok(reuseDetectedAudit);
});

test("logout revokes only provided refresh token and keeps other sessions active", async () => {
  const seeded = await seedVerifiedUser({ email: "logout@example.com" });
  const firstContext = {
    ipAddress: "192.168.1.10",
    userAgent: "AuthServiceTest/Logout-A",
    deviceId: "device-logout-a",
  };
  const secondContext = {
    ipAddress: "192.168.1.11",
    userAgent: "AuthServiceTest/Logout-B",
    deviceId: "device-logout-b",
  };

  const firstLogin = await login(
    {
      email: seeded.user.email,
      password: seeded.plainPassword,
    },
    firstContext
  );

  const secondLogin = await login(
    {
      email: seeded.user.email,
      password: seeded.plainPassword,
    },
    secondContext
  );

  assert.equal(state.refreshTokens.length, 2);

  const logoutResult = await logout(
    { refreshToken: firstLogin.refreshToken },
    firstContext
  );
  assert.equal(logoutResult.message, "Logged out successfully");

  const firstTokenRecord = state.refreshTokens.find(
    (item) => item.token === hashToken(firstLogin.refreshToken)
  );
  const secondTokenRecord = state.refreshTokens.find(
    (item) => item.token === hashToken(secondLogin.refreshToken)
  );

  assert.ok(firstTokenRecord?.revokedAt);
  assert.equal(firstTokenRecord?.revocationReason, RefreshTokenRevocationReason.LOGOUT);
  assert.equal(secondTokenRecord?.revokedAt, null);

  const logoutAudit = findAuditLog(
    AuthAuditEvent.LOGOUT_SUCCESS,
    (entry) => entry.userId === seeded.user.id && entry.success === true
  );
  assert.ok(logoutAudit);

  const refreshedSecondSession = await refreshAuthToken({
    refreshToken: secondLogin.refreshToken,
  });
  assert.ok(refreshedSecondSession.refreshToken.length > 10);

  await assert.rejects(
    refreshAuthToken({ refreshToken: firstLogin.refreshToken }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.message, "Invalid or expired refresh token");
      return true;
    }
  );
});

test("forgot/reset password uses generic response and revokes previous sessions", async () => {
  const seeded = await seedVerifiedUser({ email: "reset@example.com" });
  const context = {
    ipAddress: "172.16.0.5",
    userAgent: "AuthServiceTest/Reset",
    deviceId: "device-reset",
  };

  const loginResult = await login(
    {
      email: seeded.user.email,
      password: seeded.plainPassword,
    },
    context
  );

  const forgotKnown = await forgotPassword({ email: seeded.user.email }, context);
  const forgotUnknown = await forgotPassword({ email: "missing@example.com" }, context);

  assert.equal(
    forgotKnown.message,
    "If an account with this email exists, a password reset link has been sent."
  );
  assert.equal(forgotUnknown.message, forgotKnown.message);

  const forgotPasswordAuditEvents = state.authAuditLogs.filter(
    (entry) => entry.event === AuthAuditEvent.FORGOT_PASSWORD_REQUESTED
  );
  assert.equal(forgotPasswordAuditEvents.length, 2);

  const afterForgotUser = state.users.find((item) => item.id === seeded.user.id);
  assert.ok(afterForgotUser?.passwordResetToken);
  assert.ok(afterForgotUser?.passwordResetExp);

  const deterministicResetToken = "deterministic-reset-token";
  afterForgotUser!.passwordResetToken = hashToken(deterministicResetToken);
  afterForgotUser!.passwordResetExp = new Date(Date.now() + 60 * 60 * 1000);

  const resetResult = await resetPassword(
    {
      token: deterministicResetToken,
      password: "NewPassword@123",
    },
    context
  );

  assert.equal(resetResult.message, "Password reset successful. Please log in again.");
  assert.equal(afterForgotUser?.passwordResetToken, null);
  assert.equal(afterForgotUser?.passwordResetExp, null);
  assert.ok(
    state.refreshTokens
      .filter((item) => item.userId === seeded.user.id)
      .every(
        (item) =>
          item.revokedAt !== null &&
          item.revocationReason === RefreshTokenRevocationReason.PASSWORD_RESET
      )
  );

  const resetAudit = findAuditLog(
    AuthAuditEvent.RESET_PASSWORD_SUCCESS,
    (entry) => entry.userId === seeded.user.id && entry.success === true
  );
  assert.ok(resetAudit);

  await assert.rejects(
    login(
      {
        email: seeded.user.email,
        password: seeded.plainPassword,
      },
      context
    ),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 401);
      return true;
    }
  );

  const relogin = await login(
    {
      email: seeded.user.email,
      password: "NewPassword@123",
    },
    context
  );
  assert.ok(relogin.refreshToken.length > 10);

  await assert.rejects(
    refreshAuthToken({ refreshToken: loginResult.refreshToken }, context),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.message, "Invalid or expired refresh token");
      return true;
    }
  );

  const refreshFailedAudit = findAuditLog(
    AuthAuditEvent.REFRESH_FAILED,
    (entry) => entry.userId === seeded.user.id && entry.success === false
  );
  assert.ok(refreshFailedAudit);
});
