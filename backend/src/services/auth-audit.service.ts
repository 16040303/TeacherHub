import { AuthAuditEvent, Prisma } from "@prisma/client";
import prisma from "../config/prisma";
import { env } from "../config/env";

export interface AuthRequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
}

interface NormalizedAuthRequestContext {
  ipAddress: string | null;
  userAgent: string | null;
  deviceId: string | null;
}

interface LogAuthAuditEventInput {
  event: AuthAuditEvent;
  success?: boolean;
  userId?: number | null;
  refreshTokenId?: number | null;
  message?: string;
  metadata?: Prisma.JsonValue;
  context?: AuthRequestContext;
}

const trimNullable = (
  value: string | null | undefined,
  maxLength: number
): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
};

export const normalizeAuthRequestContext = (
  context?: AuthRequestContext
): NormalizedAuthRequestContext => {
  return {
    ipAddress: trimNullable(context?.ipAddress, 64),
    userAgent: trimNullable(context?.userAgent, 512),
    deviceId: trimNullable(context?.deviceId, 191),
  };
};

const normalizeMetadata = (
  metadata: Prisma.JsonValue | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (typeof metadata === "undefined") {
    return undefined;
  }

  if (metadata === null) {
    return Prisma.JsonNull;
  }

  return metadata as Prisma.InputJsonValue;
};

export const logAuthAuditEvent = async (
  payload: LogAuthAuditEventInput
): Promise<void> => {
  const normalizedContext = normalizeAuthRequestContext(payload.context);

  try {
    await prisma.authAuditLog.create({
      data: {
        event: payload.event,
        success: payload.success ?? true,
        userId: payload.userId ?? null,
        refreshTokenId: payload.refreshTokenId ?? null,
        ipAddress: normalizedContext.ipAddress,
        userAgent: normalizedContext.userAgent,
        deviceId: normalizedContext.deviceId,
        message: trimNullable(payload.message, 255),
        metadata: normalizeMetadata(payload.metadata),
      },
    });
  } catch (error) {
    if (!env.IS_PRODUCTION) {
      console.error("Failed to persist auth audit log:", error);
    }
  }
};
