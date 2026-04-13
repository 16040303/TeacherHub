import { Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";
import { HttpError } from "./http-error";
import { sendError } from "./response";

export const handleControllerError = (res: Response, error: unknown): void => {
  if (error instanceof ZodError) {
    sendError(res, {
      statusCode: 400,
      message: "Validation failed",
      errors: error.flatten().fieldErrors,
    });
    return;
  }

  if (error instanceof HttpError) {
    sendError(res, {
      statusCode: error.statusCode,
      message: error.message,
    });
    return;
  }

  if (!env.IS_PRODUCTION) {
    console.error("Unhandled controller error:", error);
  }

  sendError(res, {
    statusCode: 500,
    message: "Internal server error",
  });
};
