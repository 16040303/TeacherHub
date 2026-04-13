import { Response } from "express";

/**
 * Standard envelope for all API responses.
 * Backend returns: { success, message, data? }
 */
export const sendSuccess = <T>(
  res: Response,
  {
    statusCode = 200,
    message,
    data,
  }: {
    statusCode?: number;
    message: string;
    data?: T;
  }
): void => {
  const body: Record<string, unknown> = { success: true, message };
  if (data !== undefined) {
    body.data = data;
  }
  res.status(statusCode).json(body);
};

export const sendError = (
  res: Response,
  {
    statusCode = 500,
    message,
    errors,
  }: {
    statusCode?: number;
    message: string;
    errors?: unknown;
  }
): void => {
  const body: Record<string, unknown> = { success: false, message };
  if (errors !== undefined) {
    body.errors = errors;
  }
  res.status(statusCode).json(body);
};
