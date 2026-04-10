import cors from "cors";

import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import adminRouter from "./routes/admin.route";
import authRouter from "./routes/auth.route";
import communityRouter from "./routes/community.route";
import { env } from "./config/env";
import followRouter from "./routes/follow.route";
import lessonFavoriteRouter from "./routes/lesson-favorite.route";
import lessonRouter from "./routes/lesson.route";
import notificationRouter from "./routes/notification.route";
import orderRouter from "./routes/order.route";
import { profileRouter, teacherRouter } from "./routes/profile.route";
import reviewRouter from "./routes/review.route";
import uploadRouter from "./routes/upload.route";
import walletRouter from "./routes/wallet.route";

const app = express();

if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: env.UPLOADS_PUBLIC_ENABLED
      ? { policy: "cross-origin" }
      : { policy: "same-origin" },
  })
);

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (env.CORS_ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
});

app.use(corsMiddleware);
app.use(express.json({ limit: env.MAX_JSON_BODY_SIZE }));
app.use(
  express.urlencoded({
    extended: true,
    limit: env.MAX_URLENCODED_BODY_SIZE,
  })
);

if (env.UPLOADS_PUBLIC_ENABLED) {
  app.use("/uploads", express.static("uploads"));
}

const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts. Please try again later.",
  },
});

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    message: "TeacherHub backend is running",
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "teacherhub-backend",
    environment: env.NODE_ENV,
  });
});

app.use("/api/auth", authRateLimiter, authRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/profile", profileRouter);
app.use("/api/teachers", teacherRouter);
app.use("/api/lessons", lessonFavoriteRouter);
app.use("/api/lessons", lessonRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/orders", orderRouter);
app.use("/api/community", communityRouter);
app.use("/api/follows", followRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/wallet", walletRouter);
app.use("/api/admin", adminRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    message: "Route not found",
  });
});

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    if (!env.IS_PRODUCTION) {
      console.error("Unhandled server error:", error);
    }

    res.status(500).json({
      message: "Internal server error",
    });
  }
);

app.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}`);
});