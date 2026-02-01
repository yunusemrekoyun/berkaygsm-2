import rateLimit from "express-rate-limit";

const defaultWindow = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const defaultMax = Number(process.env.RATE_LIMIT_MAX || 600);
const strictWindow = Number(process.env.RATE_LIMIT_STRICT_WINDOW_MS || 60 * 1000);
const strictMax = Number(process.env.RATE_LIMIT_STRICT_MAX || 20);
const refreshWindow = Number(
  process.env.RATE_LIMIT_REFRESH_WINDOW_MS || 60 * 1000
);
const refreshMax = Number(process.env.RATE_LIMIT_REFRESH_MAX || 200);
const mediaWindow = Number(process.env.RATE_LIMIT_MEDIA_WINDOW_MS || 15 * 60 * 1000);
const mediaMax = Number(process.env.RATE_LIMIT_MEDIA_MAX || 50);

export const generalLimiter = rateLimit({
  windowMs: defaultWindow,
  max: defaultMax,
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictLimiter = rateLimit({
  windowMs: strictWindow,
  max: strictMax,
  message: { message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const refreshLimiter = rateLimit({
  windowMs: refreshWindow,
  max: refreshMax,
  standardHeaders: true,
  legacyHeaders: false,
});

export const mediaUploadLimiter = rateLimit({
  windowMs: mediaWindow,
  max: mediaMax,
  message: { message: "Upload rate limit exceeded. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
