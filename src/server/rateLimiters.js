const buckets = new Map();

function resolveKey(req) {
  const ip = req.ip || req.headers?.["x-forwarded-for"] || "unknown";
  const path = req.url || "";
  return `${ip}:${path}`;
}

function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const now = Date.now();
    const key = resolveKey(req);
    const entry = buckets.get(key);

    if (!entry || entry.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.status(429).json(message || { message: "Too many requests" });
      return;
    }

    return next();
  };
}

const defaultWindow = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const defaultMax = Number(process.env.RATE_LIMIT_MAX || 600);
const strictWindow = Number(process.env.RATE_LIMIT_STRICT_WINDOW_MS || 60 * 1000);
const strictMax = Number(process.env.RATE_LIMIT_STRICT_MAX || 20);
const refreshWindow = Number(process.env.RATE_LIMIT_REFRESH_WINDOW_MS || 60 * 1000);
const refreshMax = Number(process.env.RATE_LIMIT_REFRESH_MAX || 200);
const mediaWindow = Number(process.env.RATE_LIMIT_MEDIA_WINDOW_MS || 15 * 60 * 1000);
const mediaMax = Number(process.env.RATE_LIMIT_MEDIA_MAX || 50);

export const generalLimiter = rateLimit({
  windowMs: defaultWindow,
  max: defaultMax,
});

export const strictLimiter = rateLimit({
  windowMs: strictWindow,
  max: strictMax,
  message: { message: "Too many requests, please try again later." },
});

export const refreshLimiter = rateLimit({
  windowMs: refreshWindow,
  max: refreshMax,
});

export const mediaUploadLimiter = rateLimit({
  windowMs: mediaWindow,
  max: mediaMax,
  message: { message: "Upload rate limit exceeded. Try again later." },
});
