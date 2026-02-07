const PAYPAL_ENV =
  (process.env.PAYPAL_ENV || "sandbox").trim().toLowerCase();
const PAYPAL_API_BASE =
  PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
const PAYPAL_LOCALE = process.env.PAYPAL_LOCALE || "tr-TR";
const PAYPAL_BRAND_NAME =
  process.env.PAYPAL_BRAND_NAME || "Berkay GSM";

class PayPalError extends Error {
  constructor(status, data, message) {
    super(message || data?.message || "PayPal isteği başarısız");
    this.name = "PayPalError";
    this.status = status;
    this.data = data;
  }
}

const tokenCache = {
  value: null,
  expiresAt: 0,
};

function getCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new PayPalError(
      500,
      null,
      "Sunucuda PayPal bilgileri yapılandırılmamış"
    );
  }
  return { clientId, clientSecret };
}

async function fetchAccessToken() {
  const { clientId, clientSecret } = getCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    throw new PayPalError(response.status, data, "PayPal tokenı alınamadı");
  }
  const expiresIn = Number(data.expires_in || 0);
  tokenCache.value = data.access_token;
  tokenCache.expiresAt = Date.now() + Math.max(0, expiresIn - 60) * 1000;
  return tokenCache.value;
}

async function getAccessToken() {
  if (tokenCache.value && Date.now() < tokenCache.expiresAt) {
    return tokenCache.value;
  }
  return fetchAccessToken();
}

async function parsePayPalResponse(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PayPalError(response.status, data);
  }
  return data;
}

export async function paypalCreateOrder({
  intent = "CAPTURE",
  purchaseUnits,
  applicationContext = {},
}) {
  if (!Array.isArray(purchaseUnits) || purchaseUnits.length === 0) {
    throw new PayPalError(
      400,
      null,
      "PayPal siparişi için purchaseUnits zorunlu"
    );
  }
  const token = await getAccessToken();
  const body = {
    intent,
    purchase_units: purchaseUnits,
    application_context: {
      shipping_preference: "SET_PROVIDED_ADDRESS",
      user_action: "PAY_NOW",
      locale: PAYPAL_LOCALE,
      brand_name: PAYPAL_BRAND_NAME,
      ...applicationContext,
    },
  };

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parsePayPalResponse(response);
}

export async function paypalCaptureOrder(orderId) {
  if (!orderId) {
    throw new PayPalError(400, null, "Tahsilat için PayPal order id zorunlu");
  }
  const token = await getAccessToken();
  const response = await fetch(
    `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );
  return parsePayPalResponse(response);
}

export async function paypalRefundCapture(captureId, amount, currency) {
  if (!captureId) {
    throw new PayPalError(400, null, "İade için capture id zorunlu");
  }
  const token = await getAccessToken();
  const body =
    amount && currency
      ? {
          amount: {
            value: amount,
            currency_code: currency,
          },
        }
      : {};
  const response = await fetch(
    `${PAYPAL_API_BASE}/v2/payments/captures/${captureId}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  return parsePayPalResponse(response);
}

export { PayPalError };
