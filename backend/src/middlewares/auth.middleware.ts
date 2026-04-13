import { UserRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import type { JwtUserPayload } from "../utils/jwt";
import { verifyAccessToken } from "../utils/jwt";
import { sendError } from "../utils/response";

export interface AuthRequest extends Request {
  user: JwtUserPayload;
}

const parseBearerToken = (authorizationHeader?: string): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
};

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = parseBearerToken(req.headers.authorization);

  if (!req.headers.authorization) {
    sendError(res, { statusCode: 401, message: "Authorization header is required" });
    return;
  }

  if (!token) {
    sendError(res, {
      statusCode: 401,
      message: "Authorization header must be in Bearer <token> format",
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    (req as AuthRequest).user = payload;
    next();
  } catch {
    sendError(res, { statusCode: 401, message: "Invalid or expired token" });
  }
};

export const authorize = (roles: UserRole | UserRole[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      sendError(res, { statusCode: 401, message: "Unauthorized" });
      return;
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      const isAdminOnly =
        allowedRoles.length === 1 && allowedRoles[0] === UserRole.ADMIN;

      sendError(res, {
        statusCode: 403,
        message: isAdminOnly
          ? "Admin access is required"
          : "You do not have permission to access this resource",
      });
      return;
    }

    next();
  };
};

export const requireAdmin = authorize(UserRole.ADMIN);

/**
 * Optional authenticate — populates req.user if a valid Bearer token is present,
 * but does not reject the request if the header is missing.
 */
export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    (req as AuthRequest).user = payload;
  } catch {
    // ignore invalid token — treat as unauthenticated
  }

  next();
};
