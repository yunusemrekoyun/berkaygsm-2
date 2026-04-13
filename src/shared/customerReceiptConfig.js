export const DEFAULT_CUSTOMER_RECEIPT_CONFIG = {
  slogan: "Kutunu acarken ayni heyecani biz de paylasiyoruz.",
  message:
    "Siparisiniz icin tesekkur ederiz. Paketinizi teslim alirken dis ambalaji kontrol etmeyi unutmayin.",
  instagramUrl: "instagram.com/ceplife",
  tiktokUrl: "tiktok.com/@ceplife",
};

function normalizeText(value, fallback = "") {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

export function normalizeCustomerReceiptConfig(value = {}) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    slogan: normalizeText(raw.slogan, DEFAULT_CUSTOMER_RECEIPT_CONFIG.slogan).slice(
      0,
      120
    ),
    message: normalizeText(
      raw.message,
      DEFAULT_CUSTOMER_RECEIPT_CONFIG.message
    ).slice(0, 600),
    instagramUrl: normalizeText(
      raw.instagramUrl,
      DEFAULT_CUSTOMER_RECEIPT_CONFIG.instagramUrl
    ).slice(0, 160),
    tiktokUrl: normalizeText(
      raw.tiktokUrl,
      DEFAULT_CUSTOMER_RECEIPT_CONFIG.tiktokUrl
    ).slice(0, 160),
  };
}
