import { UserRole } from "@prisma/client";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtUserPayload {
  userId: number;
  email: string;
  role: UserRole;
}

export const signAccessToken = (payload: JwtUserPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

export const verifyAccessToken = (token: string): JwtUserPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (typeof decoded === "string") {
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
