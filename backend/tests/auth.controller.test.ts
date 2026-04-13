import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Request, Response } from "express";
import { UserRole } from "@prisma/client";
import {
  __setAuthServiceForTests,
  googleLogin,
  login,
  logout,
  refreshToken,
  resetPassword,
} from "../src/controllers/auth.controller";
import { HttpError } from "../src/utils/http-error";

type AuthServiceContract = NonNullable<
  Parameters<typeof __setAuthServiceForTests>[0]
>;

interface CapturedResponse {
  statusCode: number;
  body: unknown;
}

const createMockResponse = (): Response & { __capture: CapturedResponse } => {
  const capture: CapturedResponse = {
    statusCode: 200,
    body: undefined,
  };

  const response = {
    __capture: capture,
    status(code: number) {
      capture.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      capture.body = payload;
      return this;
    },
  };

  return response as unknown as Response & { __capture: CapturedResponse };
};

const createRequest = (
  body: Record<string, unknown> = {},
  query: Record<string, unknown> = {}
): Request => {
  return { body, query } as Request;
};

const createAuthResponse = () => ({
  token: "access-token",
  refreshToken: "refresh-token",
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  user: {
    id: 1,
    fullName: "Controller Test User",
    email: "controller@example.com",
    role: UserRole.TEACHER,
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
});

const createAuthServiceStub = (
  overrides: Partial<AuthServiceContract> = {}
): AuthServiceContract => ({
  register: async () => ({ message: "Registration successful" }),
  login: async () => createAuthResponse(),
  googleLogin: async () => createAuthResponse(),
  refreshToken: async () => createAuthResponse(),
  logout: async () => ({ message: "Logged out successfully" }),
  forgotPassword: async () => ({
    message: "If an account with this email exists, a password reset link has been sent.",
  }),
  resetPassword: async () => ({
    message: "Password reset successful. Please log in again.",
  }),
  verifyEmail: async () => ({ message: "Email verified successfully. You can now log in." }),
  resendVerification: async () => ({
    message: "If an account with this email exists, a verification email has been sent.",
  }),
  ...overrides,
});

afterEach(() => {
  __setAuthServiceForTests(null);
});

test("login controller returns success envelope and normalized email", async () => {
  let capturedEmail = "";
  const authResponse = createAuthResponse();

  __setAuthServiceForTests(
    createAuthServiceStub({
      login: async (payload) => {
        capturedEmail = payload.email;
        return authResponse;
      },
    })
  );

  const req = createRequest({
    email: "UPPERCASE@Example.COM",
    password: "Password@123",
  });
  const res = createMockResponse();

  await login(req, res);

  assert.equal(capturedEmail, "uppercase@example.com");
  assert.equal(res.__capture.statusCode, 200);
  assert.deepEqual(res.__capture.body, {
    success: true,
    message: "Login successful",
    data: authResponse,
  });
});

test("refresh token controller maps validator errors to standard envelope", async () => {
  let called = false;

  __setAuthServiceForTests(
    createAuthServiceStub({
      refreshToken: async () => {
        called = true;
        return createAuthResponse();
      },
    })
  );

  const req = createRequest({});
  const res = createMockResponse();

  await refreshToken(req, res);

  const body = res.__capture.body as {
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
  };

  assert.equal(called, false);
  assert.equal(res.__capture.statusCode, 400);
  assert.equal(body.success, false);
  assert.equal(body.message, "Validation failed");
  assert.ok(Array.isArray(body.errors?.refreshToken));
});

test("logout controller maps HttpError via sendError helper", async () => {
  __setAuthServiceForTests(
    createAuthServiceStub({
      logout: async () => {
        throw new HttpError(401, "Invalid or expired refresh token");
      },
    })
  );

  const req = createRequest({ refreshToken: "bad-token" });
  const res = createMockResponse();

  await logout(req, res);

  assert.deepEqual(res.__capture.body, {
    success: false,
    message: "Invalid or expired refresh token",
  });
  assert.equal(res.__capture.statusCode, 401);
});

test("reset password controller returns contract-compliant success message", async () => {
  __setAuthServiceForTests(
    createAuthServiceStub({
      resetPassword: async () => ({
        message: "Password reset successful. Please log in again.",
      }),
    })
  );

  const req = createRequest({
    token: "valid-reset-token",
    password: "Password@123",
  });
  const res = createMockResponse();

  await resetPassword(req, res);

  assert.equal(res.__capture.statusCode, 200);
  assert.deepEqual(res.__capture.body, {
    success: true,
    message: "Password reset successful. Please log in again.",
  });
});

test("google login controller returns success envelope and id token payload", async () => {
  let capturedIdToken = "";
  const authResponse = createAuthResponse();

  __setAuthServiceForTests(
    createAuthServiceStub({
      googleLogin: async (payload) => {
        capturedIdToken = payload.idToken;
        return authResponse;
      },
    })
  );

  const req = createRequest({ idToken: "google-id-token" });
  const res = createMockResponse();

  await googleLogin(req, res);

  assert.equal(capturedIdToken, "google-id-token");
  assert.equal(res.__capture.statusCode, 200);
  assert.deepEqual(res.__capture.body, {
    success: true,
    message: "Login successful",
    data: authResponse,
  });
});
