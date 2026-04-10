import { Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";
import { HttpError } from "./http-error";

export const handleControllerError = (res: Response, error: unknown): void => {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Validation failed",
      errors: error.flatten(),
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      message: error.message,
    });
    return;
  }

  if (!env.IS_PRODUCTION) {
    console.error("Unhandled controller error:", error);
  }

  res.status(500).json({
    message: "Internal server error",
  });
};
