// backend/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import helmet from "helmet";
import * as Sentry from "@sentry/node";
import { connectDB } from "./config/db.js";
import apiRoutes from "./routes/index.js";
import { configureCloudinary } from "./config/cloudinary.js";
import { generalLimiter } from "./middleware/rateLimiters.js";
import { httpLogger } from "./middleware/httpLogger.js";
import { logger } from "./utils/logger.js";

// ----------------- SENTRY -----------------
const sentryEnabled = Boolean(process.env.SENTRY_DSN);
if (sentryEnabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  });
}

const app = express();

// ----------------- ALLOWED ORIGINS -----------------
const FRONTEND = process.env.FRONTEND_URL?.trim();
const LOCAL = "http://localhost:5173";

// Render’ın kendi backend domaini (dinamik)
const BACKEND = process.env.RENDER_EXTERNAL_URL || "";
// Örnek: https://ayyildiz-ic-giyim.onrender.com

const corsAllowlist = [FRONTEND, LOCAL, BACKEND]
  .filter(Boolean)
  .map((x) => x.replace(/\/$/, "")); // trailing slash temizle

console.log("🔐 CORS Allowlist:", corsAllowlist);

// ----------------- HELMET (CSP FIXED) -----------------
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: ["'self'", "https:", "data:"],
        connectSrc: [
          "'self'",
          FRONTEND,
          LOCAL,
          BACKEND,
          "https://api.paypal.com",
          "https://www.paypal.com",
        ].filter(Boolean),
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
  })
);

if (sentryEnabled) {
  app.use(Sentry.Handlers.requestHandler());
}

// ----------------- CORS -----------------
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/$/, "");
      if (corsAllowlist.includes(cleanOrigin)) {
        return callback(null, true);
      }

      console.log("❌ CORS BLOCKED:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ----------------- MIDDLEWARE -----------------
app.use("/api", generalLimiter);
app.use(httpLogger);
app.use(express.json());
app.use(cookieParser());
configureCloudinary();

// ----------------- ROUTES -----------------
app.use("/api", apiRoutes);

if (sentryEnabled) {
  app.use(Sentry.Handlers.errorHandler());
}

// ----------------- ERROR HANDLER -----------------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const maxMb = process.env.HERO_MAX_FILE_MB || 200;
    return res
      .status(413)
      .json({ message: `File too large. Max ${maxMb}MB allowed.` });
  }

  const status = err.status || 500;

  if (status >= 500) {
    logger.error({ err }, "Unhandled server error");
  }

  return res.status(status).json({ message: err.message || "Server error" });
});

// ----------------- SERVER START -----------------
const port = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(port, () => {
    console.log("🚀 API running on port", port);
    console.log("🌐 BACKEND URL:", BACKEND);
    console.log("🔐 Allowed Origins:", corsAllowlist);
  });
});
