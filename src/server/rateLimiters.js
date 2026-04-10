import RateLimitBucket from "./models/RateLimitBucket.js";

const memoryBuckets = new Map();

function resolveKey(req) {
  const ip = req.ip || "unknown";
  const method = String(req.method || "GET").toUpperCase();
  let path = "";
  try {
    path = new URL(req.url || "/", "http://localhost").pathname;
  } catch {
    path = req.url || "";
  }
  return `${method}:${ip}:${path}`;
}

function buildBucketKey(baseKey, windowMs, now = Date.now()) {
  return `${baseKey}:${Math.floor(now / windowMs)}`;
}

function incrementMemoryBucket(baseKey, windowMs, now = Date.now()) {
  const key = buildBucketKey(baseKey, windowMs, now);
  const expiresAt = (Math.floor(now / windowMs) + 1) * windowMs;
  const entry = memoryBuckets.get(key);

  if (!entry || entry.expiresAt <= now) {
    memoryBuckets.set(key, { count: 1, expiresAt });
    return 1;
  }

  entry.count += 1;
  return entry.count;
}

async function incrementPersistentBucket(baseKey, windowMs, now = Date.now()) {
  const windowIndex = Math.floor(now / windowMs);
  const key = `${baseKey}:${windowIndex}`;
  const expiresAt = new Date((windowIndex + 1) * windowMs);

  const bucket = await RateLimitBucket.findOneAndUpdate(
    { key },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  return Number(bucket?.count || 0);
}

function rateLimit({
  windowMs,
  max,
  message,
  persistent = false,
  persistentMethods = [],
}) {
  return async (req, res, next) => {
    const now = Date.now();
    const baseKey = resolveKey(req);
    const method = String(req.method || "GET").toUpperCase();
    const usePersistent =
      persistent === true ||
      (Array.isArray(persistentMethods) && persistentMethods.includes(method));
    let count = 0;

    try {
      count = usePersistent
        ? await incrementPersistentBucket(baseKey, windowMs, now)
        : incrementMemoryBucket(baseKey, windowMs, now);
    } catch {
      count = incrementMemoryBucket(baseKey, windowMs, now);
    }

    if (count > max) {
      res.status(429).json(message || { message: "Çok fazla istek" });
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
const mediaSignatureWindow = Number(
  process.env.RATE_LIMIT_MEDIA_SIGNATURE_WINDOW_MS || 15 * 60 * 1000
);
const mediaSignatureMax = Number(process.env.RATE_LIMIT_MEDIA_SIGNATURE_MAX || 30);

export const generalLimiter = rateLimit({
  windowMs: defaultWindow,
  max: defaultMax,
  persistentMethods: ["POST", "PUT", "PATCH", "DELETE"],
});

export const strictLimiter = rateLimit({
  windowMs: strictWindow,
  max: strictMax,
  message: { message: "Çok fazla istek. Lütfen daha sonra tekrar deneyin." },
  persistent: true,
});

export const refreshLimiter = rateLimit({
  windowMs: refreshWindow,
  max: refreshMax,
  persistent: true,
});

export const mediaUploadLimiter = rateLimit({
  windowMs: mediaWindow,
  max: mediaMax,
  message: { message: "Yükleme limiti aşıldı. Lütfen daha sonra tekrar deneyin." },
  persistent: true,
});

export const mediaSignatureLimiter = rateLimit({
  windowMs: mediaSignatureWindow,
  max: mediaSignatureMax,
  message: { message: "Yükleme limiti aşıldı. Lütfen daha sonra tekrar deneyin." },
  persistent: true,
});

const contactWindow = Number(
  process.env.RATE_LIMIT_CONTACT_WINDOW_MS || 10 * 60 * 1000
);
const contactMax = Number(process.env.RATE_LIMIT_CONTACT_MAX || 5);

export const contactMessageLimiter = rateLimit({
  windowMs: contactWindow,
  max: contactMax,
  message: {
    message:
      "Kısa sürede çok fazla mesaj gönderildi. Lütfen biraz sonra tekrar deneyin.",
  },
  persistent: true,
});

// Webhook: iyzico sunucu IP'leri için toleranslı ama spam'i kesen limiter.
// Persistent değil (memory) — iyzico sunucuları az sayıda bilinen IP'den gelir.
const webhookWindow = Number(
  process.env.RATE_LIMIT_WEBHOOK_WINDOW_MS || 60 * 1000
);
const webhookMax = Number(process.env.RATE_LIMIT_WEBHOOK_MAX || 60);

export const webhookLimiter = rateLimit({
  windowMs: webhookWindow,
  max: webhookMax,
  message: { message: "İstek limiti aşıldı" },
});

// Callback: kullanıcı ödeme sonrası geri döndüğünde IP başına 30 req/dk izin ver.
// Normal akışta bir kullanıcı 1-2 kez callback'e düşer; bu limit bot spamini keser.
const callbackWindow = Number(
  process.env.RATE_LIMIT_CALLBACK_WINDOW_MS || 60 * 1000
);
const callbackMax = Number(process.env.RATE_LIMIT_CALLBACK_MAX || 30);

export const callbackLimiter = rateLimit({
  windowMs: callbackWindow,
  max: callbackMax,
  message: { message: "İstek limiti aşıldı" },
});
