import { Router } from "express";
import multer from "multer";
import { env } from "../config/env";
import { AuthRequest, authenticate } from "../middlewares/auth.middleware";
import { uploadSingleFile } from "../middlewares/upload.middleware";

const uploadRouter = Router();

uploadRouter.post("/", authenticate, (req, res) => {
  uploadSingleFile(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          message: "File is too large. Maximum size is 10MB",
        });
        return;
      }

      res.status(400).json({
        message: error.message,
      });
      return;
    }

    if (error) {
      res.status(400).json({
        message: error.message,
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        message: "No file uploaded. Use multipart/form-data with field name 'file'",
      });
      return;
    }

    const authReq = req as AuthRequest;
    const publicUrl = env.UPLOADS_PUBLIC_ENABLED
      ? `/uploads/${req.file.filename}`
      : undefined;

    res.status(201).json({
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
