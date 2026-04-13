import { Router } from "express";
import multer from "multer";
import { env } from "../config/env";
import { AuthRequest, authenticate } from "../middlewares/auth.middleware";
import { uploadSingleFile } from "../middlewares/upload.middleware";
import { sendError, sendSuccess } from "../utils/response";

const uploadRouter = Router();

uploadRouter.post("/", authenticate, (req, res) => {
  uploadSingleFile(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        sendError(res, {
          statusCode: 400,
          message: "File is too large. Maximum size is 10MB",
        });
        return;
      }

      sendError(res, {
        statusCode: 400,
        message: error.message,
      });
      return;
    }

    if (error) {
      sendError(res, {
        statusCode: 400,
        message: error.message,
      });
      return;
    }

    if (!req.file) {
      sendError(res, {
        statusCode: 400,
        message: "No file uploaded. Use multipart/form-data with field name 'file'",
      });
      return;
    }

    const authReq = req as AuthRequest;
    const publicUrl = env.UPLOADS_PUBLIC_ENABLED
      ? `/uploads/${req.file.filename}`
      : undefined;

    sendSuccess(res, {
      statusCode: 201,
      message: "File uploaded successfully",
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: publicUrl,
        isPubliclyAccessible: env.UPLOADS_PUBLIC_ENABLED,
        uploadedBy: {
          userId: authReq.user.userId,
          email: authReq.user.email,
          role: authReq.user.role,
        },
      },
    });
  });
});

export default uploadRouter;
