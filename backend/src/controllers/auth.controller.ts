import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import type { AuthRequestContext } from "../services/auth-audit.service";
import { handleControllerError } from "../utils/controller-error";
import { sendSuccess } from "../utils/response";
import {
  forgotPasswordSchema,
  googleLoginSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../validators/auth.validator";

type AuthServiceContract = Pick<
  typeof authService,
  | "register"
  | "login"
  | "googleLogin"
  | "refreshToken"
  | "logout"
  | "forgotPassword"
  | "resetPassword"
  | "verifyEmail"
  | "resendVerification"
>;

const defaultAuthService: AuthServiceContract = authService;
let authServiceHandlers: AuthServiceContract = defaultAuthService;

const readHeaderValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === "string" && item.trim().length > 0) ?? null;
  }

  return typeof value === "string" ? value : null;
};

const extractAuthRequestContext = (req: Request): AuthRequestContext => {
  const headers = req.headers ?? {};
  const ipAddress =
    (typeof req.ip === "string" && req.ip) ||
    (typeof req.socket?.remoteAddress === "string" ? req.socket.remoteAddress : null);

  return {
    ipAddress,
    userAgent: readHeaderValue(headers["user-agent"]),
    deviceId: readHeaderValue(headers["x-device-id"]),
  };
};

/**
 * Test-only hook for controller unit tests.
 * Runtime code paths keep using the real auth service implementation.
 */
export const __setAuthServiceForTests = (
  overrides: AuthServiceContract | null
): void => {
  authServiceHandlers = overrides ?? defaultAuthService;
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = registerSchema.parse(req.body);
    const result = await authServiceHandlers.register(
      payload,
      extractAuthRequestContext(req)
    );

    sendSuccess(res, {
      statusCode: 201,
      message: result.message,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await authServiceHandlers.login(payload, extractAuthRequestContext(req));

    sendSuccess(res, {
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = googleLoginSchema.parse(req.body);
    const result = await authServiceHandlers.googleLogin(
      payload,
      extractAuthRequestContext(req)
    );

    sendSuccess(res, {
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = refreshTokenSchema.parse(req.body);
    const result = await authServiceHandlers.refreshToken(
      payload,
      extractAuthRequestContext(req)
    );

    sendSuccess(res, {
      message: "Session refreshed successfully",
      data: result,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = logoutSchema.parse(req.body);
    const result = await authServiceHandlers.logout(payload, extractAuthRequestContext(req));

    sendSuccess(res, {
      message: result.message,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = forgotPasswordSchema.parse(req.body);
    const result = await authServiceHandlers.forgotPassword(
      payload,
      extractAuthRequestContext(req)
    );

    sendSuccess(res, {
      message: result.message,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = resetPasswordSchema.parse(req.body);
    const result = await authServiceHandlers.resetPassword(
      payload,
      extractAuthRequestContext(req)
    );

    sendSuccess(res, {
      message: result.message,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = verifyEmailSchema.parse(req.query);
    const result = await authServiceHandlers.verifyEmail(
      payload,
      extractAuthRequestContext(req)
    );

    sendSuccess(res, { message: result.message });
  } catch (error) {
    handleControllerError(res, error);
  }
};

export const resendVerification = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const payload = resendVerificationSchema.parse(req.body);
    const result = await authServiceHandlers.resendVerification(
      payload,
      extractAuthRequestContext(req)
    );

    sendSuccess(res, { message: result.message });
  } catch (error) {
    handleControllerError(res, error);
  }
};
