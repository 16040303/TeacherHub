import { UserRole } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { JwtUserPayload, verifyAccessToken } from "../utils/jwt";

export interface AuthRequest extends Request {
  user: JwtUserPayload;
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      message: "Authorization header is required",
    });
    return;
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({
      message: "Authorization header must be in Bearer token format",
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    (req as AuthRequest).user = payload;
    next();
  } catch {
    res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthRequest;

  if (!authReq.user) {
    res.status(401).json({
      message: "Unauthorized",
    });
    return;
  }

  if (authReq.user.role !== UserRole.ADMIN) {
    res.status(403).json({
      message: "Admin access is required",
    });
    return;
  }

  next();
};
