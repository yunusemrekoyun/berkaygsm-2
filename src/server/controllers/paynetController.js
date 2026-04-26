import crypto from "crypto";
import User from "../models/User.js";
import PaynetSession from "../models/PaynetSession.js";
import {
  buildOrderPreparation,
  finalizeOrder,
  normalizeCode,
  releaseReservedStock,
  reservePreparedStock,
  roundCurrency,
  runInMongoTransaction,
} from "./orderController.js";
import {
  sendOrderAdminEmail,
  sendOrderCustomerEmail,
  sendPaymentManualReviewAdminEmail,
} from "../services/emailService.js";
import { sendOrderReceivedSms } from "../services/smsService.js";
import { assertPaynetConfigured, getPaynetCallbackUrl, getPaynetReturnUrl } from "../config/paynet.js";
import {
  checkPaynetTransaction,
  createPaynetMailOrder,
} from "../services/paynetService.js";
import { logger } from "../utils/logger.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fail(status, message, extra = null) {
  const error = new Error(message);
  error.status = status;
  if (extra) error.extra = extra;
  throw error;
}

function sanitizeDigits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) {
    const digits = sanitizeDigits(raw);
    return digits ? `+${digits}` : "";
  }
  const digits = sanitizeDigits(raw);
  if (!digits) return "";
  if (digits.startsWith("90") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+9${digits}`;
  if (digits.length === 10) return `+90${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return "";
}

function normalizeIdentityNumber(value) {
  const digits = sanitizeDigits(value);
  return digits.length === 11 ? digits : "11111111111";
}

function splitFullName(fullName) {
  const raw = String(fullName || "").trim();
  if (!raw) return { name: "Müşteri", surname: "-" };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { name: parts[0], surname: "-" };
  return { name: parts[0], surname: parts.slice(1).join(" ") };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sendRedirect(res, location) {
  res
    .status(303)
    .setHeader("Location", location)
    .setHeader("Cache-Control", "no-store")
    .send(
      `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${escapeHtml(
        location
      )}"></head><body>Yönlendiriliyor...</body></html>`
    );
}

function normalizeAbsoluteOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

function isAllowedReturnOrigin(origin) {
  const normalized = normalizeAbsoluteOrigin(origin);
  if (!normalized) return false;
  try {
    const url = new URL(normalized);
    const host = String(url.hostname || "").trim().toLowerCase();
    const allowedHosts = new Set([
      "localhost",
      "127.0.0.1",
      "ceplife.com",
      "www.ceplife.com",
      "staging.ceplife.com",
    ]);
    try {
      const config = assertPaynetConfigured();
      const configHost = normalizeAbsoluteOrigin(config.publicBaseUrl);
      if (configHost) allowedHosts.add(new URL(configHost).hostname.toLowerCase());
    } catch {
      // ignore
    }
    return allowedHosts.has(host);
  } catch {
    return false;
  }
}

function resolvePublicBaseUrl() {
  try {
    return assertPaynetConfigured().publicBaseUrl;
  } catch {
    return String(process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  }
}

function resolveReturnOrigin(req) {
  const candidates = [req.headers.origin, req.headers.referer, req.headers.referrer];
  for (const candidate of candidates) {
    const normalized = normalizeAbsoluteOrigin(candidate);
    if (normalized && isAllowedReturnOrigin(normalized)) return normalized;
  }
  return resolvePublicBaseUrl();
}

function buildSuccessRedirectUrl(baseUrl, orderId, email = "") {
  const base = String(baseUrl || resolvePublicBaseUrl()).replace(/\/+$/, "");
  const url = new URL(`${base}/checkout/success`);
  url.searchParams.set("order", String(orderId || "").trim());
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    url.searchParams.set("email", normalizedEmail);
  }
  return url.toString();
}

function buildFailedRedirectUrl(baseUrl, message) {
  const base = String(baseUrl || resolvePublicBaseUrl()).replace(/\/+$/, "");
  const msg = message ? `&message=${encodeURIComponent(message)}` : "";
  return `${base}/checkout/success?status=failed${msg}`;
}

function buildReviewRedirectUrl(baseUrl, message) {
  const base = String(baseUrl || resolvePublicBaseUrl()).replace(/\/+$/, "");
  const msg = message ? `&message=${encodeURIComponent(message)}` : "";
  return `${base}/checkout/success?status=review${msg}`;
}

function buildPaynetReturnUrl(baseUrl, referanceNo, status = "success") {
  const base = String(baseUrl || resolvePublicBaseUrl()).replace(/\/+$/, "");
  const url = new URL(`${base}/api/payments/paynet/return`);
  if (referanceNo) {
    url.searchParams.set("ref", String(referanceNo).trim());
  }
  if (status) {
    url.searchParams.set("status", String(status).trim().toLowerCase());
  }
  return url.toString();
}

function buildReferanceNo() {
  return `pn_${crypto.randomBytes(12).toString("hex")}`;
}

function buildPendingManualReviewNotification() {
  return {
    state: "pending",
    attemptCount: 0,
    lastAttemptAt: null,
    sentAt: null,
    lastError: "",
  };
}

function normalizePricingSnapshot(pricing) {
  if (!pricing || typeof pricing !== "object") return null;
  return {
    currency: String(pricing.currency || "TRY").trim().toUpperCase(),
    subtotal: roundCurrency(Number(pricing.subtotal || 0)),
    shipping: roundCurrency(Number(pricing.shipping || 0)),
    discountAmount: roundCurrency(Number(pricing.discountAmount || 0)),
    total: roundCurrency(Number(pricing.total || 0)),
  };
}

function comparePricingSnapshots(left, right) {
  const l = normalizePricingSnapshot(left);
  const r = normalizePricingSnapshot(right);
  if (!l || !r) return false;
  return (
    l.currency === r.currency &&
    l.subtotal === r.subtotal &&
    l.shipping === r.shipping &&
    l.discountAmount === r.discountAmount &&
    l.total === r.total
  );
}

function normalizeCustomerSnapshot(customerSnapshot) {
  if (!customerSnapshot || typeof customerSnapshot !== "object") return null;
  return {
    fullName: String(customerSnapshot.fullName || "").trim(),
    email: normalizeEmail(customerSnapshot.email),
    phone: String(customerSnapshot.phone || "").trim(),
    isGuest: customerSnapshot.isGuest === true,
  };
}

function normalizeSessionItems(orderItems = []) {
  return orderItems.map((item) => ({
    kind: item.kind === "set" ? "set" : "product",
    id: item.ref,
    qty: Math.max(1, Number(item.qty || 1) || 1),
    variant: item.variant
      ? {
          color: item.variant.color ?? null,
          size: item.variant.size ?? null,
          attribute: item.variant.attribute ?? null,
        }
      : null,
    selections: Array.isArray(item.selections)
      ? item.selections.map((s) => ({
          productId: s.productId,
          color: s.color ?? null,
          size: s.size ?? null,
          attribute: s.attribute ?? null,
          qtyInSet: Math.max(1, Number(s.qtyInSet || 1) || 1),
        }))
      : [],
  }));
}

function normalizeSortedItems(items = []) {
  return [...(Array.isArray(items) ? items : [])]
    .map((item) => ({
      kind: item?.kind === "set" ? "set" : "product",
      id: String(item?.id || item?.ref || "").trim(),
      qty: Math.max(1, Number(item?.qty || 1) || 1),
      variant: item?.variant
        ? {
            color: item.variant.color ?? null,
            size: item.variant.size ?? null,
            attribute: item.variant.attribute ?? null,
          }
        : null,
    }))
    .sort((a, b) => `${a.kind}${a.id}`.localeCompare(`${b.kind}${b.id}`));
}

function buildFingerprintKey({ userId, customerSnapshot, addressSnapshot, items, couponCode, pricing }) {
  const payload = {
    userId: String(userId || "").trim(),
    email: normalizeEmail(customerSnapshot?.email),
    address: {
      fullName: String(addressSnapshot?.fullName || "").trim(),
      city: String(addressSnapshot?.city || "").trim(),
      district: String(addressSnapshot?.district || "").trim(),
      postalCode: String(addressSnapshot?.postalCode || "").trim(),
      addressLine: String(addressSnapshot?.addressLine || "").trim(),
    },
    items: normalizeSortedItems(items),
    couponCode: normalizeCode(couponCode || ""),
    pricing: normalizePricingSnapshot(pricing),
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function getSessionReservationEntries(sessionDoc) {
  const entries = sessionDoc?.stockReservation?.entries;
  return Array.isArray(entries) ? entries : [];
}

function hasActiveStockReservation(sessionDoc) {
  return (
    String(sessionDoc?.stockReservation?.state || "none") === "reserved" &&
    getSessionReservationEntries(sessionDoc).length > 0
  );
}

function buildReservationState(sessionDoc, overrides = {}) {
  const current =
    sessionDoc?.stockReservation && typeof sessionDoc.stockReservation === "object"
      ? sessionDoc.stockReservation.toObject?.() || sessionDoc.stockReservation
      : {};

  const pick = (key, fallback = null) =>
    Object.prototype.hasOwnProperty.call(overrides, key)
      ? overrides[key]
      : current?.[key] ?? fallback;

  return {
    state: pick("state", "none"),
    entries: Array.isArray(pick("entries", [])) ? pick("entries", []) : [],
    reservedAt: pick("reservedAt", null),
    releasedAt: pick("releasedAt", null),
    committedAt: pick("committedAt", null),
  };
}

function isSessionExpired(sessionDoc, now = new Date()) {
  const expiresAt = sessionDoc?.expiresAt ? new Date(sessionDoc.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() <= now.getTime();
}

function toMinorUnits(value) {
  return Math.round(Number(value || 0) * 100);
}

function isAmountValid(expectedTotal, callbackAmount) {
  const expected = toMinorUnits(expectedTotal);
  const actual = toMinorUnits(callbackAmount);
  // Installment payments: bank adds surcharge → actual >= expected is correct.
  // Single payment: allow 1 kuruş tolerance for floating-point rounding.
  return actual >= expected - 1;
}

function isDuplicateKeyError(error) {
  return Number(error?.code) === 11000;
}

async function expireOldPendingSessions(now = new Date()) {
  await PaynetSession.updateMany(
    { status: "pending", expiresAt: { $lte: now }, fingerprintKey: { $ne: null } },
    { $set: { status: "expired", fingerprintKey: null } }
  );
}

async function markSessionFailed(sessionId, message, extra = {}) {
  const update = {
    status: extra.status || "failed",
    fingerprintKey: null,
    lastError: {
      phase: extra.phase || "unknown",
      code: extra.code || "UNKNOWN",
      message: String(message || "Bilinmeyen hata"),
    },
  };

  const sessionDoc = await PaynetSession.findByIdAndUpdate(
    sessionId,
    { $set: update },
    { new: true }
  );

  if (extra.releaseReservation && sessionDoc && hasActiveStockReservation(sessionDoc)) {
    const entries = getSessionReservationEntries(sessionDoc);
    await releaseReservedStock(entries);
    await PaynetSession.findByIdAndUpdate(sessionId, {
      $set: {
        stockReservation: buildReservationState(sessionDoc, {
          state: "released",
          entries,
          releasedAt: new Date(),
        }),
      },
    });
  }
}

async function markSessionManualReview(sessionId, message, extra = {}) {
  const update = {
    status: "manual_review",
    fingerprintKey: null,
    lastError: {
      phase: extra.phase || "unknown",
      code: extra.code || "MANUAL_REVIEW",
      message: String(message || "Ödeme manuel kontrole alındı"),
    },
    manualReviewNotification:
      extra.manualReviewNotification || buildPendingManualReviewNotification(),
  };

  await PaynetSession.findByIdAndUpdate(
    sessionId,
    { $set: update },
    { new: true }
  );

  return notifyPaynetManualReviewIfNeeded(sessionId);
}

async function notifyPaynetManualReviewIfNeeded(sessionId) {
  if (!sessionId) return { ok: false, skipped: true };

  const claimedSession = await PaynetSession.findOneAndUpdate(
    {
      _id: sessionId,
      status: "manual_review",
      $or: [
        { "manualReviewNotification.state": { $exists: false } },
        { "manualReviewNotification.state": null },
        { "manualReviewNotification.state": "pending" },
      ],
    },
    {
      $set: {
        "manualReviewNotification.state": "sending",
        "manualReviewNotification.lastAttemptAt": new Date(),
      },
      $inc: { "manualReviewNotification.attemptCount": 1 },
    },
    { new: true }
  ).lean();

  if (!claimedSession) return { ok: false, skipped: true };

  const user = claimedSession?.user
    ? await User.findById(claimedSession.user)
        .select("firstName lastName email phone")
        .lean()
    : null;

  const result = await sendPaymentManualReviewAdminEmail({
    paymentSession: claimedSession,
    user,
  });

  if (result?.ok) {
    await PaynetSession.findByIdAndUpdate(sessionId, {
      $set: {
        "manualReviewNotification.state": "sent",
        "manualReviewNotification.sentAt": new Date(),
        "manualReviewNotification.lastError": "",
      },
    });
    return result;
  }

  await PaynetSession.findByIdAndUpdate(sessionId, {
    $set: {
      "manualReviewNotification.state": "pending",
      "manualReviewNotification.lastError": String(
        result?.error || "mail-send-failed"
      ),
    },
  });

  return result;
}

async function loadCustomer({ userId, customerSnapshot = null }) {
  const normalized = normalizeCustomerSnapshot(customerSnapshot);

  if (userId) {
    const user = await User.findById(userId).select(
      "firstName lastName email phone"
    );
    if (!user) fail(404, "Kullanıcı bulunamadı");
    return {
      user,
      customer: {
        fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || normalized?.fullName || "",
        email: normalizeEmail(user.email),
        phone: String(user.phone || normalized?.phone || "").trim(),
        isGuest: false,
      },
    };
  }

  if (!normalized?.fullName || !normalized?.email || !normalized?.phone) {
    fail(400, "Misafir ödeme için ad soyad, e-posta ve telefon gerekli");
  }

  return {
    user: null,
    customer: { ...normalized, isGuest: true },
  };
}

function buildInvoiceSnapshot(identityNumber) {
  return {
    identityNumber: normalizeIdentityNumber(identityNumber),
    type: "Bireysel",
    taxOffice: "Çinili",
  };
}

// ─── exported handlers ────────────────────────────────────────────────────────

export async function initializePaynetPayment(req, res) {
  try {
    const config = assertPaynetConfigured();
    const identityNumber = String(req.body?.identityNumber || "").trim();
    const couponCode = normalizeCode(req.body?.couponCode || "");
    const note = String(req.body?.note || "").trim();
    const guestCustomer = normalizeCustomerSnapshot(req.body?.guestCustomer || null);
    const isGuestCheckout = !req.userId;

    if (isGuestCheckout) {
      if (req.body?.addressId) {
        fail(400, "Misafir ödeme için kayıtlı adres kullanılamaz");
      }
      if (!guestCustomer?.fullName || !guestCustomer?.email || !guestCustomer?.phone) {
        fail(400, "Misafir ödeme için ad soyad, e-posta ve telefon gerekli");
      }
      if (couponCode) {
        fail(401, "Kupon kullanmak için giriş yapmalısınız");
      }
    }

    const prepared = await buildOrderPreparation({
      userId: req.userId || null,
      addressId: req.body?.addressId,
      addressSnapshot: req.body?.addressSnapshot || null,
      items: req.body?.items || [],
      couponCode: couponCode || null,
    });

    const sessionItems = normalizeSessionItems(prepared.details.orderItems);
    const fingerprintKey = buildFingerprintKey({
      userId: req.userId || null,
      customerSnapshot: guestCustomer,
      addressSnapshot: prepared.details.addressSnap,
      items: sessionItems,
      couponCode,
      pricing: prepared.summary,
    });

    const now = new Date();
    const ttlMs = config.sessionTtlMinutes * 60 * 1000;

    // Reuse an active session with same fingerprint
    const existingSession = await PaynetSession.findOne({
      fingerprintKey,
      status: "pending",
      order: null,
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (existingSession?.paymentUrl) {
      return res.json({
        payment: {
          provider: "paynet",
          mode: config.sandbox ? "sandbox" : "live",
          paymentUrl: existingSession.paymentUrl,
          reused: true,
        },
        sessionId: String(existingSession._id),
        summary: prepared.summary,
      });
    }

    const { user, customer } = await loadCustomer({
      userId: req.userId || null,
      customerSnapshot: guestCustomer,
    });

    const phone = normalizePhone(
      prepared.details.addressSnap?.phone || customer?.phone || user?.phone || ""
    );
    if (!phone) {
      fail(400, "Teslimat adresinde geçerli bir telefon numarası gerekli");
    }

    const email = normalizeEmail(user?.email || customer?.email || "");
    if (!email) {
      fail(400, "Geçerli bir e-posta adresi gerekli");
    }

    const nameParts = splitFullName(
      customer?.fullName || prepared.details.addressSnap?.fullName || ""
    );

    // Proactively clear fingerprintKeys on expired sessions so users can retry.
    await expireOldPendingSessions(now);

    const referanceNo = buildReferanceNo();
    const confirmationUrl = getPaynetCallbackUrl();
    const returnUrl = getPaynetReturnUrl();
    const successUrl = buildPaynetReturnUrl(resolvePublicBaseUrl(), referanceNo, "success");
    const errorUrl = buildPaynetReturnUrl(resolvePublicBaseUrl(), referanceNo, "failed");

    // Call Paynet API BEFORE the MongoDB transaction. External HTTP calls must
    // not be made inside a transaction because they extend lock duration and
    // cannot be rolled back on DB error.
    const paynetResult = await createPaynetMailOrder({
      referenceNo: referanceNo,
      referanceNo,
      amount: prepared.summary.total,
      currency: prepared.summary.currency || "TRY",
      confirmationUrl,
      returnUrl,
      successUrl,
      errorUrl,
      ratioCode: config.ratioCode,
      addCommissionToAmount: config.addCommissionToAmount,
      agentId: config.agentId,
      posType: config.posType,
      installments: config.installments,
      noInstallment: config.noInstallment,
      multiPayment: config.multiPayment,
      buyer: {
        name: nameParts.name,
        surname: nameParts.surname,
        email,
        phone,
      },
      address: {
        addressLine: prepared.details.addressSnap?.addressLine || "-",
        city: prepared.details.addressSnap?.city || "-",
        postalCode: prepared.details.addressSnap?.postalCode || "34000",
      },
      description: `CepLife sipariş #${referanceNo}`,
    });

    const paynetSession = await runInMongoTransaction(async (mongoSession, tx) => {
      const reservationResult = await reservePreparedStock(prepared.details, {
        session: mongoSession,
      });
      const reservationEntries = reservationResult.stockEntries;
      const createdAt = new Date();

      try {
        const [createdSession] = await PaynetSession.create(
          [
            {
              referanceNo,
              mode: config.sandbox ? "sandbox" : "live",
              status: "pending",
              fingerprintKey,
              user: req.userId || null,
              customer,
              identityNumber: normalizeIdentityNumber(identityNumber),
              paymentUrl: paynetResult.paymentUrl,
              addressSnapshot: prepared.details.addressSnap,
              items: sessionItems,
              couponCode: couponCode || null,
              note,
              pricing: {
                currency: prepared.summary.currency,
                subtotal: prepared.summary.subtotal,
                shipping: prepared.summary.shipping,
                discountAmount: prepared.summary.discountAmount,
                total: prepared.summary.total,
              },
              stockReservation: buildReservationState(null, {
                state: reservationEntries.length ? "reserved" : "none",
                entries: reservationEntries,
                reservedAt: reservationEntries.length ? createdAt : null,
              }),
              expiresAt: new Date(createdAt.getTime() + ttlMs),
            },
          ],
          mongoSession ? { session: mongoSession } : {}
        );

        return createdSession;
      } catch (error) {
        if (!tx?.atomic && reservationEntries.length) {
          await releaseReservedStock(reservationEntries);
        }

        // Race condition: another request created a session with the same fingerprint
        // at the same time. Find and return it.
        if (isDuplicateKeyError(error)) {
          const existing = await PaynetSession.findOne({
            fingerprintKey,
            status: "pending",
            order: null,
            expiresAt: { $gt: new Date() },
          }).session(mongoSession);

          if (existing?.paymentUrl) return existing;
        }

        throw error;
      }
    });

    return res.json({
      payment: {
        provider: "paynet",
        mode: config.sandbox ? "sandbox" : "live",
        paymentUrl: paynetSession.paymentUrl,
        reused: false,
      },
      sessionId: String(paynetSession._id),
      summary: prepared.summary,
    });
  } catch (error) {
    if (error?.status) {
      const payload = { message: error.message || "Ödeme başlatılamadı" };
      if (error.extra) payload.details = error.extra;
      return res.status(error.status).json(payload);
    }
    return res.status(500).json({ message: error.message || "Ödeme başlatılamadı" });
  }
}

// ─── shared callback logic ────────────────────────────────────────────────────

function normalizeCallbackSource(source) {
  const raw = source && typeof source === "object" ? source : {};
  const normalized = { ...raw };

  for (const [key, value] of Object.entries(raw)) {
    const cleaned = String(key || "").replace(/^amp;/i, "").trim();
    if (cleaned && normalized[cleaned] === undefined) {
      normalized[cleaned] = value;
    }
  }

  return normalized;
}

function sanitizePaynetCallbackPayload(source) {
  const normalized = normalizeCallbackSource(source);
  const sanitized = { ...normalized };

  if (Object.prototype.hasOwnProperty.call(sanitized, "card_holder")) {
    delete sanitized.card_holder;
  }
  if (Object.prototype.hasOwnProperty.call(sanitized, "card_number")) {
    delete sanitized.card_number;
  }

  return sanitized;
}

function readCallbackParam(req, keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  const sources = [req.body, req.query];
  for (const source of sources) {
    const normalizedSource = normalizeCallbackSource(source);
    for (const key of list) {
      const value = normalizedSource?.[key];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }
  return undefined;
}

function readCallbackParamFromSource(source, keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  const normalizedSource = normalizeCallbackSource(source);
  for (const key of list) {
    const value = normalizedSource?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function parseReferenceNo(req) {
  return String(
    readCallbackParam(req, [
      "reference_no",
      "referance_no",
      "referenceNo",
      "referanceNo",
      "ref",
    ]) || ""
  ).trim();
}

function parseIsSucceed(req) {
  const explicit = readCallbackParam(req, [
    "is_succeed",
    "isSucceed",
    "success",
  ]);
  if (explicit !== undefined) {
    if (explicit === true || explicit === 1) return true;
    const normalized = String(explicit).trim().toLowerCase();
    return ["true", "1", "yes", "ok", "success", "successful"].includes(
      normalized
    );
  }

  const status = String(readCallbackParam(req, "status") || "")
    .trim()
    .toLowerCase();
  if (status) {
    if (["success", "successful", "paid", "ok"].includes(status)) return true;
    if (["failed", "error", "cancelled", "canceled"].includes(status)) return false;
  }

  const code = String(readCallbackParam(req, "code") || "").trim();
  if (code) {
    if (["0", "00", "000"].includes(code)) return true;
    if (!["0", "00", "000"].includes(code)) return false;
  }

  // Official Paynet confirmation callback includes xact_id on successful payment.
  return Boolean(readCallbackParam(req, ["xact_id", "transaction_id"]));
}

function parseCallbackAmount(req) {
  return Number(
    readCallbackParam(req, ["amount", "paid_amount", "total_amount"]) || 0
  );
}

function parseAuthCode(req, fallback) {
  return String(
    readCallbackParam(req, [
      "xact_id",
      "authorization_code",
      "auth_code",
      "transaction_id",
    ]) || fallback
  );
}

function hasReturnErrorSignal(req) {
  return Boolean(
    readCallbackParam(req, [
      "paynet_error_id",
      "paynet_error_message",
      "bank_error_id",
      "bank_error_message",
    ])
  );
}

function isBrowserRequest(req) {
  return String(req.headers.accept || "").includes("text/html");
}

function hasCallbackAmount(req) {
  return (
    readCallbackParam(req, ["amount", "paid_amount", "total_amount"]) !== undefined
  );
}

function shouldProcessReturnPayload(req) {
  const hasExplicitSuccessSignal =
    readCallbackParam(req, ["is_succeed", "isSucceed"]) !== undefined;
  const hasTxnSignal =
    readCallbackParam(req, [
      "xact_id",
      "transaction_id",
      "authorization_code",
      "auth_code",
    ]) !== undefined;

  // Plain return URLs like ?ref=...&status=success are not enough to finalize
  // an order safely. We only finalize from the browser redirect when Paynet also
  // gives the amount and a concrete success signal.
  return hasCallbackAmount(req) && (hasExplicitSuccessSignal || hasTxnSignal);
}

function normalizePaynetReference(row) {
  return String(
    row?.reference_no || row?.agent_reference || row?.referenceNo || ""
  )
    .trim()
    .toLowerCase();
}

function parseProviderOrderIdFromSource(source) {
  return String(
    readCallbackParamFromSource(source, [
      "order_id",
      "orderId",
      "payment_id",
      "paymentId",
      "mailorder_id",
      "mailorderId",
      "id",
    ]) || ""
  ).trim();
}

function parseProviderXactIdFromSource(source) {
  return String(
    readCallbackParamFromSource(source, ["xact_id", "transaction_id"]) || ""
  ).trim();
}

function parseProviderAuthorizationCodeFromSource(source) {
  return String(
    readCallbackParamFromSource(source, [
      "authorization_code",
      "auth_code",
    ]) || ""
  ).trim();
}

async function resolvePaynetSessionFromCallback({ referanceNo, rawData }) {
  const normalizedReferenceNo = String(referanceNo || "").trim();
  if (normalizedReferenceNo) {
    const sessionByReference = await PaynetSession.findOne({
      referanceNo: normalizedReferenceNo,
    });
    if (sessionByReference) {
      return {
        session: sessionByReference,
        referanceNo: sessionByReference.referanceNo,
        lookup: "reference_no",
      };
    }
  }

  const providerXactId = parseProviderXactIdFromSource(rawData);
  if (providerXactId) {
    const sessionByXact = await PaynetSession.findOne({ providerXactId });
    if (sessionByXact) {
      return {
        session: sessionByXact,
        referanceNo: sessionByXact.referanceNo,
        lookup: "provider_xact_id",
      };
    }
  }

  const providerOrderId = parseProviderOrderIdFromSource(rawData);
  if (providerOrderId) {
    const sessionByOrderId = await PaynetSession.findOne({ providerOrderId });
    if (sessionByOrderId) {
      return {
        session: sessionByOrderId,
        referanceNo: sessionByOrderId.referanceNo,
        lookup: "provider_order_id",
      };
    }
  }

  const providerAuthorizationCode =
    parseProviderAuthorizationCodeFromSource(rawData);
  if (providerAuthorizationCode) {
    const sessionByAuthorizationCode = await PaynetSession.findOne({
      providerAuthorizationCode,
    });
    if (sessionByAuthorizationCode) {
      return {
        session: sessionByAuthorizationCode,
        referanceNo: sessionByAuthorizationCode.referanceNo,
        lookup: "provider_authorization_code",
      };
    }
  }

  if (providerXactId) {
    try {
      const { row } = await checkPaynetTransaction({ xactId: providerXactId });
      const resolvedReferenceNo = String(
        normalizePaynetReference(row) || ""
      ).trim();

      if (resolvedReferenceNo) {
        const sessionFromTransaction = await PaynetSession.findOne({
          referanceNo: resolvedReferenceNo,
        });
        if (sessionFromTransaction) {
          return {
            session: sessionFromTransaction,
            referanceNo: sessionFromTransaction.referanceNo,
            lookup: "transaction_check_xact_id",
          };
        }
      }
    } catch (error) {
      logger.warn(
        {
          referanceNo: normalizedReferenceNo || null,
          providerXactId,
          error: error?.message || error,
        },
        "paynet: callback session resolution via transaction check failed"
      );
    }
  }

  return {
    session: null,
    referanceNo: normalizedReferenceNo,
    lookup: null,
  };
}

async function verifySuccessfulPaynetTransaction({ referanceNo, authCode }) {
  const { row } = await checkPaynetTransaction({
    referenceNo: referanceNo,
    xactId: authCode && authCode !== referanceNo ? authCode : "",
  });

  const transactionSucceeded =
    row?.is_succeed === true ||
    String(row?.is_succeed || "").trim().toLowerCase() === "true";

  if (!transactionSucceeded) {
    throw new Error("Paynet işlem doğrulaması başarısız döndü");
  }

  const normalizedReference = normalizePaynetReference(row);
  if (
    normalizedReference &&
    normalizedReference !== String(referanceNo || "").trim().toLowerCase()
  ) {
    throw new Error("Paynet işlem doğrulamasında referans numarası eşleşmedi");
  }

  return {
    txnId: String(row?.xact_id || authCode || referanceNo).trim(),
    authorizationCode: String(row?.authorization_code || "").trim(),
    amount: roundCurrency(Number(row?.amount || 0)),
    currency: String(row?.currency || "TRY").trim().toUpperCase(),
    installments: Number(row?.instalment || 0) || 0,
    providerRow: row,
  };
}

async function processPaynetPayment(
  referanceNo,
  isSucceed,
  callbackAmount,
  authCode,
  rawData,
  resolvedSession = null
) {
  const paynetSession =
    resolvedSession || (await PaynetSession.findOne({ referanceNo }));
  const resolvedReferanceNo = String(
    paynetSession?.referanceNo || referanceNo || ""
  ).trim();

  if (!paynetSession) {
    return { ok: false, code: "SESSION_NOT_FOUND" };
  }

  // Idempotent: already finalized
  if (paynetSession.order) {
    return { ok: true, orderId: paynetSession.order.toString(), alreadyDone: true };
  }
  if (paynetSession.status === "success") {
    return { ok: true, orderId: null, alreadyDone: true };
  }
  if (paynetSession.status === "failed" || paynetSession.status === "expired") {
    if (isSucceed) {
      await markSessionManualReview(
        paynetSession._id,
        "Paynet başarılı ödeme bildirdi ancak oturum daha önce kapatılmıştı. Sipariş manuel kontrol gerektiriyor.",
        {
          phase: "callback",
          code: "LATE_SUCCESS_AFTER_CLOSED_SESSION",
        }
      );
      return { ok: false, code: "MANUAL_REVIEW" };
    }
    return { ok: false, code: paynetSession.lastError?.code || "ALREADY_FAILED" };
  }
  if (paynetSession.status === "manual_review") {
    return { ok: false, code: "MANUAL_REVIEW" };
  }

  // Mark callback received and clear fingerprint
  const providerOrderId = parseProviderOrderIdFromSource(rawData);
  const providerXactId =
    parseProviderXactIdFromSource(rawData) || String(authCode || "").trim();
  const providerAuthorizationCode =
    parseProviderAuthorizationCodeFromSource(rawData) ||
    String(authCode || "").trim();

  paynetSession.status = "callback_received";
  paynetSession.fingerprintKey = null;
  paynetSession.callbackData = sanitizePaynetCallbackPayload(rawData);
  paynetSession.callbackAt = new Date();
  if (providerOrderId && !paynetSession.providerOrderId) {
    paynetSession.providerOrderId = providerOrderId;
  }
  if (providerXactId && !paynetSession.providerXactId) {
    paynetSession.providerXactId = providerXactId;
  }
  if (providerAuthorizationCode && !paynetSession.providerAuthorizationCode) {
    paynetSession.providerAuthorizationCode = providerAuthorizationCode;
  }
  await paynetSession.save();

  if (!isSucceed) {
    await markSessionFailed(paynetSession._id, "Ödeme işlemi tamamlanamadı.", {
      phase: "callback", code: "PAYMENT_FAILED", releaseReservation: true,
    });
    return { ok: false, code: "PAYMENT_FAILED" };
  }

  let verifiedTransaction = null;
  try {
    verifiedTransaction = await verifySuccessfulPaynetTransaction({
      referanceNo: resolvedReferanceNo,
      authCode,
    });
  } catch (error) {
    await markSessionManualReview(
      paynetSession._id,
      "Paynet işlem sonucu doğrulanamadı. Sipariş manuel kontrol gerektiriyor.",
      {
        phase: "callback",
        code: "PAYNET_VERIFICATION_FAILED",
      }
    );
    return {
      ok: false,
      code: "MANUAL_REVIEW",
      error: error?.message || "Paynet verification failed",
    };
  }

  if (isSessionExpired(paynetSession)) {
    await markSessionManualReview(
      paynetSession._id,
      "Ödeme oturumu süresi dolmuş görünse de Paynet başarılı ödeme bildirdi. Sipariş manuel kontrol gerektiriyor.",
      { phase: "callback", code: "SESSION_EXPIRED_AFTER_PAYMENT" }
    );
    return { ok: false, code: "MANUAL_REVIEW" };
  }

  // For installments: callbackAmount may be higher than expectedTotal (bank surcharge added).
  // isAmountValid allows actual >= expected, so this is fine.
  const expectedTotal = roundCurrency(paynetSession.pricing?.total || 0);
  const verifiedAmount = roundCurrency(
    verifiedTransaction.amount || callbackAmount || expectedTotal
  );
  if (!isAmountValid(expectedTotal, verifiedAmount)) {
    await markSessionManualReview(
      paynetSession._id,
      "Ödeme tutarı doğrulanamadı. Sipariş manuel kontrol gerekiyor.",
      { phase: "callback", code: "AMOUNT_MISMATCH" }
    );
    return { ok: false, code: "MANUAL_REVIEW" };
  }

  try {
    const txResult = await runInMongoTransaction(async (mongoSession) => {
      const currentSession = await PaynetSession.findById(paynetSession._id).session(
        mongoSession
      );
      if (!currentSession) fail(404, "Ödeme oturumu bulunamadı");

      if (currentSession.order) {
        return { orderId: currentSession.order.toString(), shouldSendEmails: false };
      }

      const activeReservedEntries = hasActiveStockReservation(currentSession)
        ? getSessionReservationEntries(currentSession)
        : [];

      const prepared = await buildOrderPreparation({
        userId: currentSession.user?.toString?.() || currentSession.user || null,
        addressSnapshot: currentSession.addressSnapshot,
        items: currentSession.items,
        couponCode: currentSession.couponCode || null,
        reservedStockEntries: activeReservedEntries,
      });

      if (!comparePricingSnapshots(prepared.summary, currentSession.pricing)) {
        return { orderId: null, manualReviewCode: "ORDER_SNAPSHOT_DRIFT" };
      }

      let reservedStockEntries = activeReservedEntries;

      if (!reservedStockEntries.length) {
        const reservationResult = await reservePreparedStock(prepared.details, {
          session: mongoSession,
        });
        reservedStockEntries = reservationResult.stockEntries;

        if (reservedStockEntries.length) {
          currentSession.stockReservation = buildReservationState(currentSession, {
            state: "reserved",
            entries: reservedStockEntries,
            reservedAt: currentSession.stockReservation?.reservedAt || new Date(),
          });
        }
      }

      const order = await finalizeOrder(prepared.details, {
        session: mongoSession,
        note: currentSession.note || "",
        customerSnapshot: currentSession.customer || null,
        invoiceSnapshot: buildInvoiceSnapshot(currentSession.identityNumber),
        applyStockDeductions: false,
        stockUsageEntries: reservedStockEntries,
        statusOverride: "paid",
        paymentOverride: {
          method: "online",
          provider: "paynet",
          txnId: verifiedTransaction.txnId,
          processorOrderId: providerOrderId || resolvedReferanceNo,
          paidAt: new Date(),
          status: "success",
          currency:
            verifiedTransaction.currency ||
            String(currentSession.pricing?.currency || "TRY"),
          amount: verifiedAmount,
          payer: {
            email: currentSession.customer?.email || null,
            name:
              currentSession.customer?.fullName ||
              currentSession.addressSnapshot?.fullName ||
              null,
            providerPayerId: null,
            countryCode: "Turkey",
          },
        },
      });

      currentSession.status = "success";
      currentSession.fingerprintKey = null;
      currentSession.order = order._id;
      currentSession.finalizedAt = new Date();
      currentSession.stockReservation = buildReservationState(currentSession, {
        state: reservedStockEntries.length ? "committed" : "none",
        entries: reservedStockEntries,
        committedAt: reservedStockEntries.length ? new Date() : null,
      });
      currentSession.lastError = null;
      await currentSession.save({ session: mongoSession });

      return {
        orderId: order._id.toString(),
        customerEmail: normalizeEmail(currentSession.customer?.email || ""),
        shouldSendEmails: true,
      };
    });

    if (txResult.manualReviewCode) {
      await markSessionManualReview(
        paynetSession._id,
        "Sipariş özeti ödeme sonrası değişti. Sipariş manuel kontrol gerektiriyor.",
        {
          phase: "finalize",
          code: txResult.manualReviewCode,
        }
      );
      return { ok: false, code: "MANUAL_REVIEW" };
    }

    if (txResult.shouldSendEmails && txResult.orderId) {
      const Order = (await import("../models/Order.js")).default;
      const orderDoc = await Order.findById(txResult.orderId).lean();
      if (orderDoc) {
        await Promise.allSettled([
          sendOrderAdminEmail({ order: orderDoc }),
          sendOrderCustomerEmail({ order: orderDoc }),
          sendOrderReceivedSms(orderDoc),
        ]);
      }
    }

    return {
      ok: true,
      orderId: txResult.orderId,
      customerEmail: txResult.customerEmail || "",
    };
  } catch (error) {
    await markSessionManualReview(
      paynetSession._id,
      error.message || "Sipariş oluşturulamadı.",
      {
        phase: "finalize",
        code: error.code || "FINALIZE_ERROR",
      }
    );
    return { ok: false, code: "MANUAL_REVIEW", error: error.message };
  }
}

// ─── exported handlers ────────────────────────────────────────────────────────

/**
 * Server-to-server notification from Paynet (POST).
 * Returns 200 JSON so Paynet knows the notification was received.
 * Also handles browser POST redirects for compatibility (sends redirect instead of JSON).
 */
export async function handlePaynetCallback(req, res) {
  logger.info(
    {
      method: req.method,
      query: sanitizePaynetCallbackPayload(req.query),
      body: sanitizePaynetCallbackPayload(req.body),
      headers: { "content-type": req.headers["content-type"], accept: req.headers.accept, "user-agent": req.headers["user-agent"] },
    },
    "paynet: callback received"
  );

  const referanceNo = parseReferenceNo(req);
  const baseUrl = resolvePublicBaseUrl();
  const rawData = { ...(req.body || {}), ...(req.query || {}) };
  const resolvedSession = await resolvePaynetSessionFromCallback({
    referanceNo,
    rawData,
  });
  const resolvedReferanceNo = String(
    resolvedSession?.referanceNo || referanceNo || ""
  ).trim();

  if (!resolvedSession?.session && !resolvedReferanceNo) {
    logger.warn(
      {
        referanceNo: referanceNo || null,
        providerOrderId: parseProviderOrderIdFromSource(rawData) || null,
        providerXactId: parseProviderXactIdFromSource(rawData) || null,
        providerAuthorizationCode:
          parseProviderAuthorizationCodeFromSource(rawData) || null,
      },
      "paynet: callback session could not be resolved"
    );
    if (isBrowserRequest(req)) {
      return sendRedirect(res, buildFailedRedirectUrl(baseUrl, "Referans numarası eksik."));
    }
    return res.status(200).json({ ok: false, code: "SESSION_NOT_FOUND" });
  }

  const isSucceed = parseIsSucceed(req);
  const callbackAmount = parseCallbackAmount(req);
  const authCode = parseAuthCode(req, resolvedReferanceNo || referanceNo);

  const result = await processPaynetPayment(
    resolvedReferanceNo,
    isSucceed,
    callbackAmount,
    authCode,
    rawData,
    resolvedSession.session || null
  );

  // Browser redirect (Paynet redirects customer browser here)
  if (isBrowserRequest(req)) {
    if (result.ok && result.orderId) {
      return sendRedirect(
        res,
        buildSuccessRedirectUrl(baseUrl, result.orderId, result.customerEmail)
      );
    }
    if (result.ok && result.alreadyDone) {
      // Order finalized but orderId not in this response — let /return handle it
      const session = await PaynetSession.findOne({
        referanceNo: resolvedReferanceNo,
      }).lean();
      const oid = session?.order?.toString?.();
      if (oid) {
        return sendRedirect(
          res,
          buildSuccessRedirectUrl(baseUrl, oid, session?.customer?.email || "")
        );
      }
    }
    if (result.code === "MANUAL_REVIEW") {
      return sendRedirect(
        res,
        buildReviewRedirectUrl(baseUrl, "Ödeme manuel kontrole alındı.")
      );
    }
    return sendRedirect(
      res,
      buildFailedRedirectUrl(baseUrl, "Ödeme işlemi tamamlanamadı.")
    );
  }

  // Server notification: return JSON
  if (result.ok) {
    return res.status(200).json({ ok: true, orderId: result.orderId || null });
  }
  return res.status(200).json({ ok: false, code: result.code || "ERROR" });
}

/**
 * Browser return handler — Paynet redirects the customer's browser here after payment.
 * Polls briefly for the server notification to finish processing, then redirects.
 */
export async function handlePaynetReturn(req, res) {
  logger.info(
    {
      method: req.method,
      query: sanitizePaynetCallbackPayload(req.query),
      body: sanitizePaynetCallbackPayload(req.body),
    },
    "paynet: return received"
  );

  const referanceNo = parseReferenceNo(req);
  const baseUrl = resolvePublicBaseUrl();
  const returnStatus = String(readCallbackParam(req, "status") || "")
    .trim()
    .toLowerCase();
  const hasXactId =
    readCallbackParam(req, ["xact_id", "transaction_id"]) !== undefined;

  if (!referanceNo) {
    return sendRedirect(res, buildFailedRedirectUrl(baseUrl, "Referans numarası eksik."));
  }

  if (
    ["failed", "error", "cancelled", "canceled"].includes(returnStatus) ||
    (hasReturnErrorSignal(req) && !hasXactId)
  ) {
    const session = await PaynetSession.findOne({ referanceNo });
    if (session && hasActiveStockReservation(session)) {
      await markSessionFailed(session._id, "Ödeme işlemi tamamlanamadı.", {
        phase: "return",
        code: "PAYMENT_FAILED",
        releaseReservation: true,
      });
    }
    return sendRedirect(res, buildFailedRedirectUrl(baseUrl, "Ödeme işlemi tamamlanamadı."));
  }

  if (!hasXactId && !returnStatus) {
    const session = await PaynetSession.findOne({ referanceNo });
    if (session && hasActiveStockReservation(session)) {
      await markSessionFailed(session._id, "Ödeme iptal edildi.", {
        phase: "return",
        code: "PAYMENT_CANCELLED",
        releaseReservation: true,
      });
    }
    return sendRedirect(res, buildFailedRedirectUrl(baseUrl, "Ödeme iptal edildi."));
  }

  // If Paynet also passes is_succeed on the return URL, process the payment here too
  // (handles the case where Paynet uses return_url as the single callback)
  const isSucceedInQuery = shouldProcessReturnPayload(req);

  if (isSucceedInQuery) {
    const isSucceed = parseIsSucceed(req);
    const callbackAmount = parseCallbackAmount(req);
    const authCode = parseAuthCode(req, referanceNo);
    const rawData = { ...(req.body || {}), ...(req.query || {}) };

    const result = await processPaynetPayment(referanceNo, isSucceed, callbackAmount, authCode, rawData);

    if (result.ok && result.orderId) {
      return sendRedirect(
        res,
        buildSuccessRedirectUrl(baseUrl, result.orderId, result.customerEmail)
      );
    }
    if (result.code === "MANUAL_REVIEW") {
      return sendRedirect(
        res,
        buildReviewRedirectUrl(baseUrl, "Ödeme manuel kontrole alındı.")
      );
    }
    if (!result.ok) {
      return sendRedirect(res, buildFailedRedirectUrl(baseUrl, "Ödeme işlemi tamamlanamadı."));
    }
  }

  // Poll briefly: server notification may arrive slightly after browser redirect
  for (let attempt = 0; attempt < 4; attempt++) {
    const session = await PaynetSession.findOne({ referanceNo }).lean();

    if (!session) {
      return sendRedirect(res, buildFailedRedirectUrl(baseUrl, "Ödeme oturumu bulunamadı."));
    }

    if (session.order) {
      return sendRedirect(
        res,
        buildSuccessRedirectUrl(
          baseUrl,
          session.order.toString(),
          session.customer?.email || ""
        )
      );
    }

    if (session.status === "failed" || session.status === "expired") {
      return sendRedirect(
        res,
        buildFailedRedirectUrl(baseUrl, session.lastError?.message || "Ödeme tamamlanamadı.")
      );
    }

    if (session.status === "manual_review") {
      return sendRedirect(
        res,
        buildReviewRedirectUrl(
          baseUrl,
          session.lastError?.message || "Ödeme manuel kontrole alındı."
        )
      );
    }

    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  // Server notification didn't arrive within ~3.6s — redirect to a pending page
  // so the customer isn't stuck. The notification will still arrive and create the order.
  return sendRedirect(
    res,
    `${baseUrl}/checkout/success?status=pending&ref=${encodeURIComponent(referanceNo)}`
  );
}

/**
 * Admin-only config check: shows which URLs to set in the Paynet panel
 * and the last few PaynetSession records for debugging.
 */
export async function handlePaynetConfigCheck(req, res) {
  const config = assertPaynetConfigured();
  const { publicBaseUrl, sandbox, baseUrl } = config;
  const recentSessions = await PaynetSession.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select("referanceNo status callbackData callbackAt createdAt pricing.total lastError paymentUrl")
    .lean();

  return res.json({
    environment: {
      mode: sandbox ? "sandbox" : "live",
      baseUrl,
      publicBaseUrl,
      posType: config.posType,
      addCommissionToAmount: config.addCommissionToAmount,
      ratioCode: config.ratioCode || null,
      agentId: config.agentId || null,
      installments: config.installments || null,
      noInstallment: config.noInstallment,
      multiPayment: config.multiPayment,
    },
    panelSettings: {
      bildirim_url: `${publicBaseUrl}/api/payments/paynet/callback`,
      donus_url: `${publicBaseUrl}/api/payments/paynet/return`,
      note: "Bu iki URL'i Paynet panelindeki 'Bildirim URL' ve 'Dönüş URL' alanlarına girin.",
    },
    apiSends: {
      pos_type: config.posType,
      addcomission_to_amount: config.addCommissionToAmount,
      ratio_code: config.ratioCode || null,
      agent_id: config.agentId || null,
      installments: config.installments || null,
      no_instalment: config.noInstallment,
      multi_payment: config.multiPayment,
      confirmation_url: `${publicBaseUrl}/api/payments/paynet/callback`,
      return_url: `${publicBaseUrl}/api/payments/paynet/return`,
      succeed_url: `${publicBaseUrl}/api/payments/paynet/return?ref=<reference_no>&status=success`,
      error_url: `${publicBaseUrl}/api/payments/paynet/return?ref=<reference_no>&status=failed`,
    },
    recentSessions: recentSessions.map((s) => ({
      referanceNo: s.referanceNo,
      status: s.status,
      total: s.pricing?.total,
      createdAt: s.createdAt,
      callbackAt: s.callbackAt,
      callbackDataKeys: s.callbackData ? Object.keys(s.callbackData) : null,
      lastError: s.lastError,
      paymentUrlExists: Boolean(s.paymentUrl),
    })),
  });
}
