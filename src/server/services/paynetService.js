import { assertPaynetConfigured } from "../config/paynet.js";
import { logger } from "../utils/logger.js";

const PAYNET_REQUEST_TIMEOUT_MS = 30_000;

function truncate(value, max) {
  const raw = String(value || "").trim();
  return raw.length > max ? raw.slice(0, max) : raw;
}

async function requestPaynetJson({ endpoint, secretKey, payload, referanceNo, xactId = null }) {
  const controller = new AbortController();
  const startedAt = Date.now();
  // Cover both response headers and the complete body, not just connection setup.
  const timer = setTimeout(() => controller.abort(), PAYNET_REQUEST_TIMEOUT_MS);
  let response;
  let phase = "request";
  try {
    // Never automatically retry: a lost response does not mean Paynet rejected
    // the mailorder, and repeating the POST could create another payment link.
    response = await fetch(endpoint, {
      method: "POST",
      headers: buildPaynetAuthHeaders(secretKey),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    phase = "read_body";
    const rawText = await response.text();
    phase = "parse_json";
    const data = JSON.parse(rawText);
    return { response, data };
  } catch (error) {
    const timedOut = controller.signal.aborted;
    const code = timedOut
      ? "PAYNET_TIMEOUT"
      : phase === "parse_json"
        ? "PAYNET_INVALID_RESPONSE"
        : "PAYNET_NETWORK_ERROR";
    const url = URL.canParse(endpoint) ? new URL(endpoint) : null;
    logger.error(
      {
        referanceNo,
        xactId,
        endpoint: url ? `${url.origin}${url.pathname}` : "invalid-url",
        phase,
        status: response?.status || null,
        code,
        errorName: error?.name || null,
        errorCode: error?.code || null,
        causeCode: error?.cause?.code || null,
        elapsedMs: Date.now() - startedAt,
        timeoutMs: PAYNET_REQUEST_TIMEOUT_MS,
      },
      "paynet: API request failed"
    );
    // Do not propagate raw provider bodies or network messages to customers or
    // downstream loggers: they can contain payment tokens or personal data.
    const message = timedOut
      ? "Ödeme sağlayıcısından zamanında yanıt alınamadı."
      : phase === "parse_json"
        ? "Ödeme sağlayıcısından geçerli bir yanıt alınamadı."
        : "Ödeme sağlayıcısıyla iletişim kurulamadı.";
    throw Object.assign(new Error(message), {
      code,
      status: timedOut ? 504 : 502,
    });
  } finally {
    clearTimeout(timer);
  }
}

function buildPaynetAuthHeaders(secretKey) {
  return {
    "Content-Type": "application/json",
    Authorization: `Basic ${secretKey}`,
  };
}

function toPaynetRowArray(data) {
  if (Array.isArray(data?.Data)) return data.Data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function parsePaynetDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Creates a hosted payment page via Paynet mailorder API.
 *
 * @param {object} params
 * @param {string} params.referenceNo      - Official Paynet reference number
 * @param {string} params.referanceNo      - Legacy alias kept for local compatibility
 * @param {number} params.amount           - Total amount in TRY (e.g. 149.99)
 * @param {string} params.currency         - Currency code (default "TRY")
 * @param {string} params.confirmationUrl  - Server-to-server notification URL
 * @param {string} params.returnUrl        - Browser redirect URL after payment
 * @param {string} params.successUrl       - Browser redirect URL after successful payment
 * @param {string} params.errorUrl         - Browser redirect URL after failed payment
 * @param {string} [params.ratioCode]      - Paynet custom ratio table code
 * @param {boolean} [params.addCommissionToAmount]
 * @param {string} [params.agentId]
 * @param {number} [params.posType]
 * @param {string} [params.installments]
 * @param {boolean} [params.noInstallment]
 * @param {boolean} [params.multiPayment]
 * @param {object} params.buyer            - { name, surname, email, phone }
 * @param {object} params.address          - { addressLine, city, postalCode }
 * @param {string} [params.description]
 * @returns {Promise<{ paymentUrl: string, referanceNo: string }>}
 */
export async function createPaynetMailOrder({
  referenceNo,
  referanceNo,
  amount,
  currency = "TRY",
  confirmationUrl,
  returnUrl,
  successUrl,
  errorUrl,
  ratioCode = "",
  addCommissionToAmount = false,
  agentId = "",
  posType = 5,
  installments = "",
  noInstallment = false,
  multiPayment = false,
  buyer,
  address,
  description = "",
}) {
  const config = assertPaynetConfigured();
  const resolvedReferenceNo = String(referenceNo || referanceNo || "").trim();
  const resolvedReturnUrl = String(returnUrl || "").trim();
  const resolvedSuccessUrl = String(successUrl || resolvedReturnUrl).trim();
  const resolvedErrorUrl = String(errorUrl || resolvedReturnUrl).trim();

  if (!resolvedReferenceNo) {
    throw new Error("Paynet reference_no zorunlu");
  }

  if (!resolvedSuccessUrl || !resolvedErrorUrl) {
    throw new Error("Paynet dönüş URL'leri eksik");
  }

  const payload = {
    reference_no: resolvedReferenceNo,
    // Legacy alias: harmless if ignored, useful if merchant account still expects old spelling.
    referance_no: resolvedReferenceNo,
    amount: Number(amount).toFixed(2),
    currency,
    // Server-to-server payment result notification
    confirmation_url: confirmationUrl,
    // Browser redirect after payment completes
    succeed_url: resolvedSuccessUrl,
    error_url: resolvedErrorUrl,
    // Compatibility aliases for older integrations
    return_url: resolvedReturnUrl || resolvedSuccessUrl,
    success_url: resolvedSuccessUrl,
    fail_url: resolvedErrorUrl,
    pos_type: Number(posType || 5) || 5,
    addcomission_to_amount: Boolean(addCommissionToAmount),
    multi_payment: Boolean(multiPayment),
    buyer_name: truncate(buyer.name, 50),
    buyer_surname: truncate(buyer.surname, 50),
    buyer_email: truncate(buyer.email, 160),
    buyer_phone: truncate(buyer.phone, 32),
    buyer_address: truncate(address.addressLine || "-", 400),
    buyer_city: truncate(address.city || "-", 50),
    buyer_country: "TR",
    buyer_zip_code: truncate(address.postalCode || "34000", 20),
    description: truncate(description, 200),
  };

  if (ratioCode) payload.ratio_code = String(ratioCode).trim();
  if (agentId) payload.agent_id = String(agentId).trim();
  if (installments) payload.installments = String(installments).trim();
  if (noInstallment) payload.no_instalment = true;

  const endpoint = `${config.baseUrl}/v1/mailorder/create`;

  logger.info(
    {
      referanceNo: resolvedReferenceNo,
      reference_no: resolvedReferenceNo,
      endpoint,
      amount: payload.amount,
      pos_type: payload.pos_type,
      addcomission_to_amount: payload.addcomission_to_amount,
      ratio_code: payload.ratio_code || null,
      agent_id: payload.agent_id || null,
      installments: payload.installments || null,
      no_instalment: payload.no_instalment === true,
      multi_payment: payload.multi_payment,
      confirmation_url: payload.confirmation_url,
      succeed_url: payload.succeed_url,
      error_url: payload.error_url,
    },
    "paynet: sending mailorder create request"
  );

  const { response, data } = await requestPaynetJson({
    endpoint,
    secretKey: config.secretKey,
    payload,
    referanceNo: resolvedReferenceNo,
  });

  logger.info(
    {
      referanceNo: resolvedReferenceNo,
      status: response.status,
      responseKeys: Object.keys(data || {}),
    },
    "paynet: received mailorder create response"
  );

  if (!response.ok) {
    throw new Error(
      data?.message || data?.error || `Paynet API hatası: HTTP ${response.status}`
    );
  }

  const paymentUrl = String(
    data?.payment_url || data?.url || data?.redirect_url || data?.paymentUrl || data?.paymentURL || ""
  ).trim();

  if (!paymentUrl) {
    throw new Error("Paynet ödeme sayfası URL'si alınamadı.");
  }

  logger.info(
    { referanceNo: resolvedReferenceNo },
    "paynet: payment URL obtained"
  );

  return { paymentUrl, referanceNo: resolvedReferenceNo, referenceNo: resolvedReferenceNo };
}

export async function checkPaynetTransaction({
  referenceNo,
  xactId = "",
}) {
  const config = assertPaynetConfigured();
  const resolvedReferenceNo = String(referenceNo || "").trim();
  const resolvedXactId = String(xactId || "").trim();

  if (!resolvedReferenceNo && !resolvedXactId) {
    throw new Error("Paynet transaction check için reference_no veya xact_id gerekli");
  }

  const endpoint = `${config.baseUrl}/v1/transaction/check`;
  const payload = {};
  if (resolvedReferenceNo) payload.reference_no = resolvedReferenceNo;
  if (resolvedXactId) payload.xact_id = resolvedXactId;

  logger.info(
    {
      referanceNo: resolvedReferenceNo || null,
      xactId: resolvedXactId || null,
      endpoint,
    },
    "paynet: sending transaction check request"
  );

  const { response, data } = await requestPaynetJson({
    endpoint,
    secretKey: config.secretKey,
    payload,
    referanceNo: resolvedReferenceNo || null,
    xactId: resolvedXactId || null,
  });

  logger.info(
    {
      referanceNo: resolvedReferenceNo || null,
      xactId: resolvedXactId || null,
      status: response.status,
      responseKeys: Object.keys(data || {}),
    },
    "paynet: received transaction check response"
  );

  if (!response.ok || Number(data?.code) !== 0) {
    throw new Error(
      data?.message || data?.error || `Paynet transaction check hatası: HTTP ${response.status}`
    );
  }

  const rows = toPaynetRowArray(data);
  if (!rows.length) {
    throw new Error("Paynet transaction check boş sonuç döndü");
  }

  let row = null;
  if (resolvedXactId) {
    row =
      rows.find(
        (candidate) => String(candidate?.xact_id || "").trim() === resolvedXactId
      ) || null;
  }

  if (!row) {
    row = [...rows].sort(
      (left, right) => parsePaynetDate(right?.xact_date) - parsePaynetDate(left?.xact_date)
    )[0];
  }

  return { row, rows, raw: data };
}
