import crypto from "crypto";
import { assertIyzicoConfigured, getIyzicoConfig } from "../config/iyzico.js";

function toError(message, status = 500, extra = null) {
  const error = new Error(message);
  error.status = status;
  if (extra) error.extra = extra;
  return error;
}

function normalizePriceForSignature(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return raw;
  if (Number.isInteger(numeric)) return String(numeric);
  return numeric.toString();
}

function normalizeSignatureValue(name, value) {
  if (value === undefined || value === null) return "";
  if (name === "price" || name === "paidPrice") {
    return normalizePriceForSignature(value);
  }
  return String(value);
}

function hmacHex(secretKey, payload) {
  return crypto
    .createHmac("sha256", secretKey)
    .update(payload)
    .digest("hex");
}

export function buildIyzicoAuthorizationHeader({
  apiKey,
  secretKey,
  path,
  body,
  randomKey,
}) {
  const bodyText = body ? JSON.stringify(body) : "";
  const payload = `${randomKey}${path}${bodyText}`;
  const signature = hmacHex(secretKey, payload);
  const encoded = Buffer.from(
    `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`,
    "utf8"
  ).toString("base64");
  return `IYZWSv2 ${encoded}`;
}

function verifyResponseSignature(secretKey, params, expectedSignature) {
  const expected = String(expectedSignature || "").trim().toLowerCase();
  if (!expected) return false;
  const payload = params
    .map(([name, value]) => normalizeSignatureValue(name, value))
    .join(":");
  const actual = hmacHex(secretKey, payload).toLowerCase();
  return actual === expected;
}

export function verifyIyzicoInitializeSignature(secretKey, data = {}) {
  return verifyResponseSignature(
    secretKey,
    [
      ["conversationId", data.conversationId],
      ["token", data.token],
    ],
    data.signature
  );
}

export function verifyIyzicoRetrieveSignature(secretKey, data = {}) {
  return verifyResponseSignature(
    secretKey,
    [
      ["paymentStatus", data.paymentStatus],
      ["paymentId", data.paymentId],
      ["currency", data.currency],
      ["basketId", data.basketId],
      ["conversationId", data.conversationId],
      ["paidPrice", data.paidPrice],
      ["price", data.price],
      ["token", data.token],
    ],
    data.signature
  );
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function iyzicoRequest(path, body) {
  const config = assertIyzicoConfigured();
  const randomKey = `${Date.now()}${crypto.randomInt(100000, 999999)}`;
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: buildIyzicoAuthorizationHeader({
        apiKey: config.apiKey,
        secretKey: config.secretKey,
        path,
        body,
        randomKey,
      }),
      "Content-Type": "application/json",
      "x-iyzi-rnd": randomKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  const rawText = await response.text();
  const data = parseJsonSafe(rawText);
  if (!data) {
    throw toError("Iyzico geçersiz cevap döndü", 502, {
      phase: "http",
      path,
      responseText: rawText.slice(0, 500),
    });
  }

  if (!response.ok || String(data.status || "").toLowerCase() === "failure") {
    const message =
      data.errorMessage ||
      data.errorCode ||
      data.message ||
      "Iyzico isteği başarısız oldu";
    throw toError(message, 502, {
      phase: "api",
      path,
      errorCode: data.errorCode || null,
      status: data.status || null,
    });
  }

  return data;
}

export async function initializeIyzicoCheckoutForm(payload) {
  const data = await iyzicoRequest(
    "/payment/iyzipos/checkoutform/initialize/auth/ecom",
    payload
  );
  const { secretKey } = getIyzicoConfig();
  const isValid = verifyIyzicoInitializeSignature(secretKey, data);

  if (!isValid) {
    throw toError("Iyzico initialize cevabı doğrulanamadı", 502, {
      phase: "signature",
      type: "initialize",
    });
  }

  if (!data.token || !data.paymentPageUrl) {
    throw toError("Iyzico ödeme sayfası oluşturulamadı", 502, {
      phase: "initialize",
    });
  }

  return data;
}

export async function retrieveIyzicoCheckoutForm(payload) {
  const data = await iyzicoRequest(
    "/payment/iyzipos/checkoutform/auth/ecom/detail",
    payload
  );
  const { secretKey } = getIyzicoConfig();
  const isValid = verifyIyzicoRetrieveSignature(secretKey, data);

  if (!isValid) {
    throw toError("Iyzico ödeme sonucu doğrulanamadı", 502, {
      phase: "signature",
      type: "retrieve",
    });
  }

  return data;
}

export function validateIyzicoHppWebhookSignature(body, headerSignature) {
  const signature = String(headerSignature || "").trim().toLowerCase();
  if (!signature) return false;
  const { secretKey } = getIyzicoConfig();
  const payload = [
    ["secretKey", secretKey],
    ["iyziEventType", body?.iyziEventType],
    ["iyziPaymentId", body?.iyziPaymentId],
    ["token", body?.token],
    ["paymentConversationId", body?.paymentConversationId],
    ["status", body?.status],
  ]
    .map(([, value]) => String(value ?? ""))
    .join("");
  const actual = hmacHex(secretKey, payload).toLowerCase();
  return actual === signature;
}

export function buildIyzicoCallbackRedirectUrl({
  baseUrl = "",
  orderId,
  status,
  message,
  customerEmail = null,
}) {
  const config = getIyzicoConfig();
  const resolvedBaseUrl = String(baseUrl || config.publicBaseUrl || "").trim();
  const url = new URL(
    "/checkout/success",
    resolvedBaseUrl || "https://example.com"
  );
  if (orderId) url.searchParams.set("order", String(orderId));
  if (status) url.searchParams.set("status", String(status));
  if (message) url.searchParams.set("message", String(message));
  // Yalnızca başarılı ödeme redirect'inde müşteri emaili eklenir; trackOrder
  // endpoint'i bu değeri sipariş sahipliğini doğrulamak için kullanır.
  if (customerEmail) url.searchParams.set("email", String(customerEmail));
  return resolvedBaseUrl
    ? `${url.origin}${url.pathname}${url.search}`
    : `/checkout/success${url.search}`;
}

export function normalizeIyzicoPrice(value) {
  const numeric = Number(value || 0);
  return Math.round(numeric * 100) / 100;
}
