import crypto from "crypto";
import { UserRole } from "@prisma/client";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtUserPayload {
  userId: number;
  email: string;
  role: UserRole;
}

interface JwtRefreshPayload extends JwtUserPayload {
  type: "refresh";
}

const toBasePayload = (decoded: unknown): JwtUserPayload => {
  if (typeof decoded === "string" || !decoded) {
    throw new Error("Invalid token payload");
  }

  const payload = decoded as JwtPayload & Partial<JwtUserPayload>;

  if (
    typeof payload.userId !== "number" ||
    typeof payload.email !== "string" ||
    typeof payload.role !== "string" ||
    !Object.values(UserRole).includes(payload.role as UserRole)
  ) {
    throw new Error("Token payload is malformed");
  }

  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role as UserRole,
  };
};

const toTokenExpiry = (value: string): SignOptions["expiresIn"] => {
  return value as SignOptions["expiresIn"];
};

export const signAccessToken = (payload: JwtUserPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: toTokenExpiry(env.ACCESS_TOKEN_EXPIRES_IN),
  });
};

export const verifyAccessToken = (token: string): JwtUserPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  return toBasePayload(decoded);
};

export const signRefreshToken = (payload: JwtUserPayload): string => {
  const refreshPayload: JwtRefreshPayload = {
    ...payload,
    type: "refresh",
  };

  return jwt.sign(refreshPayload, env.JWT_SECRET, {
    expiresIn: toTokenExpiry(env.REFRESH_TOKEN_EXPIRES_IN),
    jwtid: crypto.randomUUID(),
  });
};

export const verifyRefreshToken = (token: string): JwtUserPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (typeof decoded === "string" || !decoded) {
    throw new Error("Invalid token payload");
  }

  const payload = decoded as JwtPayload & Partial<JwtRefreshPayload>;

  if (payload.type !== "refresh") {
    throw new Error("Invalid refresh token payload");
  }

  return toBasePayload(payload);
};

export const getTokenExpiryDate = (token: string): Date => {
  const decoded = jwt.decode(token);

  if (!decoded || typeof decoded === "string") {
    throw new Error("Unable to decode token payload");
  }

  if (typeof decoded.exp !== "number") {
    throw new Error("Token expiry is missing");
  }

  return new Date(decoded.exp * 1000);
};
