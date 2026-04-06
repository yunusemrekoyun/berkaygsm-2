function isMediaFreezeEnabled() {
  const raw = String(process.env.MEDIA_MIGRATION_FREEZE || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(raw);
}

export function requireMediaWritesEnabled(req, res, next) {
  if (!isMediaFreezeEnabled()) {
    return next();
  }

  res.setHeader("Retry-After", "3600");
  return res.status(503).json({
    message:
      "Medya taşıma süreci nedeniyle bu işlem geçici olarak durduruldu. Lütfen daha sonra tekrar deneyin.",
    code: "MEDIA_MIGRATION_FREEZE",
  });
}

