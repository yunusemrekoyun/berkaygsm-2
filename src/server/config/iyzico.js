const SANDBOX_BASE_URL = "https://sandbox-api.iyzipay.com";
const LIVE_BASE_URL = "https://api.iyzipay.com";

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function ensureAbsoluteUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.origin;
  } catch {
    return "";
  }
}

export function getIyzicoConfig() {
  const sandbox = toBoolean(process.env.IYZICO_SANDBOX, true);
  const baseUrl = String(
    process.env.IYZICO_BASE_URL ||
      (sandbox ? SANDBOX_BASE_URL : LIVE_BASE_URL)
  )
    .trim()
    .replace(/\/+$/, "");

  const publicBaseUrl = ensureAbsoluteUrl(
    process.env.IYZICO_CALLBACK_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.MAIL_PUBLIC_BASE_URL
  );

  return {
    apiKey: String(process.env.IYZICO_API_KEY || "").trim(),
    secretKey: String(process.env.IYZICO_SECRET_KEY || "").trim(),
    baseUrl,
    publicBaseUrl,
    sandbox,
    locale: String(process.env.IYZICO_LOCALE || "tr").trim() || "tr",
    sessionTtlMinutes: Math.max(
      5,
      Number(process.env.IYZICO_SESSION_TTL_MINUTES || 30) || 30
    ),
    enabledInstallments: [1],
  };
}

export function assertIyzicoConfigured() {
  const config = getIyzicoConfig();
  if (!config.apiKey || !config.secretKey) {
    const error = new Error(
      "Iyzico anahtarları tanımlı değil. IYZICO_API_KEY ve IYZICO_SECRET_KEY gerekli."
    );
    error.status = 503;
    error.code = "IYZICO_NOT_CONFIGURED";
    throw error;
  }
  if (!config.publicBaseUrl) {
    const error = new Error(
      "Iyzico callback origin tanımlı değil. IYZICO_CALLBACK_BASE_URL veya NEXT_PUBLIC_SITE_URL gerekli."
    );
    error.status = 503;
    error.code = "IYZICO_CALLBACK_BASE_URL_MISSING";
    throw error;
  }
  if (!config.publicBaseUrl.startsWith("https://")) {
    const error = new Error(
      "Iyzico callback adresi HTTPS olmalı. IYZICO_CALLBACK_BASE_URL değerini HTTPS origin olarak ayarlayın."
    );
    error.status = 503;
    error.code = "IYZICO_CALLBACK_BASE_URL_INVALID";
    throw error;
  }
  return config;
}

export function getIyzicoCallbackUrl() {
  const { publicBaseUrl } = assertIyzicoConfigured();
  return `${publicBaseUrl}/api/payments/iyzico/callback`;
}
