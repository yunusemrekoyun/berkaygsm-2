const LIVE_BASE_URL = "https://api.paynet.com.tr";
const TEST_BASE_URL = "https://pts-api.paynet.com.tr";

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
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

function parsePositiveInt(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

function normalizeInstallments(value) {
  const seen = new Set();

  return String(value || "")
    .split(",")
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => {
      const parsed = Number(item);
      if (!Number.isFinite(parsed) || parsed < 0) return null;

      // Paynet docs use 0 for peşin/tek çekim. Accepting 1 here keeps env input
      // ergonomic on our side while sending the value Paynet expects.
      if (parsed === 1) return "0";

      return String(Math.floor(parsed));
    })
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    })
    .join(",");
}

export function getPaynetConfig() {
  // Payment work should default to test mode unless production is explicitly requested.
  const sandbox = toBoolean(process.env.PAYNET_SANDBOX, true);
  const baseUrl = String(
    process.env.PAYNET_BASE_URL || (sandbox ? TEST_BASE_URL : LIVE_BASE_URL)
  )
    .trim()
    .replace(/\/+$/, "");

  const publicBaseUrl = ensureAbsoluteUrl(
    process.env.PAYNET_CALLBACK_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.MAIL_PUBLIC_BASE_URL
  );

  return {
    secretKey: String(process.env.PAYNET_SECRET_KEY || "").trim(),
    publishableKey: String(process.env.PAYNET_PUBLISHABLE_KEY || "").trim(),
    baseUrl,
    publicBaseUrl,
    sandbox,
    ratioCode: String(process.env.PAYNET_RATIO_CODE || "").trim(),
    addCommissionToAmount: toBoolean(
      process.env.PAYNET_ADD_COMMISSION_TO_AMOUNT,
      false
    ),
    agentId: String(process.env.PAYNET_AGENT_ID || "").trim(),
    posType: parsePositiveInt(process.env.PAYNET_POS_TYPE || 5, 5),
    installments: normalizeInstallments(process.env.PAYNET_INSTALLMENTS || ""),
    noInstallment: toBoolean(process.env.PAYNET_NO_INSTALLMENT, false),
    multiPayment: toBoolean(process.env.PAYNET_MULTI_PAYMENT, false),
    sessionTtlMinutes: Math.max(
      5,
      Number(process.env.PAYNET_SESSION_TTL_MINUTES || 30) || 30
    ),
  };
}

export function assertPaynetConfigured() {
  const config = getPaynetConfig();
  if (!config.secretKey) {
    const err = new Error(
      "Paynet secret key tanımlı değil. PAYNET_SECRET_KEY gerekli."
    );
    err.status = 503;
    err.code = "PAYNET_NOT_CONFIGURED";
    throw err;
  }
  if (!config.publicBaseUrl) {
    const err = new Error(
      "Paynet callback origin tanımlı değil. PAYNET_CALLBACK_BASE_URL veya NEXT_PUBLIC_SITE_URL gerekli."
    );
    err.status = 503;
    err.code = "PAYNET_CALLBACK_BASE_URL_MISSING";
    throw err;
  }
  if (!config.publicBaseUrl.startsWith("https://")) {
    const err = new Error(
      "Paynet callback adresi HTTPS olmalı. PAYNET_CALLBACK_BASE_URL değerini HTTPS origin olarak ayarlayın."
    );
    err.status = 503;
    err.code = "PAYNET_CALLBACK_BASE_URL_INVALID";
    throw err;
  }
  return config;
}

export function getPaynetCallbackUrl() {
  const { publicBaseUrl } = assertPaynetConfigured();
  return `${publicBaseUrl}/api/payments/paynet/callback`;
}

export function getPaynetReturnUrl() {
  const { publicBaseUrl } = assertPaynetConfigured();
  return `${publicBaseUrl}/api/payments/paynet/return`;
}
