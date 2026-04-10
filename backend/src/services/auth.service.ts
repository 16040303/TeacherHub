import { UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import prisma from "../config/prisma";
import { HttpError } from "../utils/http-error";
import { signAccessToken } from "../utils/jwt";
import { LoginInput, RegisterInput } from "../validators/auth.validator";

export interface SafeUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  token: string;
  user: SafeUser;
}

type AuthUserRecord = {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

const toSafeUser = (user: AuthUserRecord): SafeUser => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
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

export const register = async (payload: RegisterInput): Promise<AuthResponse> => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new HttpError(409, "Email is already registered");
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);

  const createdUser = await prisma.user.create({
    data: {
      fullName: payload.fullName,
      email: payload.email,
      password: hashedPassword,
      role: resolveRegistrationRole(payload.role),
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const safeUser = toSafeUser(createdUser);

  return {
    token: signAccessToken({
      userId: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
    }),
    user: safeUser,
  };
};

export const login = async (payload: LoginInput): Promise<AuthResponse> => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      password: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(payload.password, user.password);

  if (!isPasswordValid) {
    throw new HttpError(401, "Invalid email or password");
  }

  const safeUser = toSafeUser({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });

  return {
    token: signAccessToken({
      userId: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
    }),
    user: safeUser,
  };
};
