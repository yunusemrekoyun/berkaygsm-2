import crypto from "crypto";
import User from "../models/User.js";
import PaymentSession from "../models/PaymentSession.js";
import {
  buildOrderPreparation,
  buildPreparedStockUsageEntries,
  finalizeOrder,
  normalizeCode,
  releaseReservedStock,
  reservePreparedStock,
  roundCurrency,
  runInMongoTransaction,
} from "./orderController.js";
import { sendPaymentManualReviewAdminEmail } from "../services/emailService.js";
import {
  assertIyzicoConfigured,
  getIyzicoCallbackUrl,
  getIyzicoConfig,
} from "../config/iyzico.js";
import {
  buildIyzicoCallbackRedirectUrl,
  initializeIyzicoCheckoutForm,
  normalizeIyzicoPrice,
  retrieveIyzicoCheckoutForm,
  validateIyzicoHppWebhookSignature,
} from "../services/iyzicoService.js";

function fail(status, message, extra = null) {
  const error = new Error(message);
  error.status = status;
  if (extra) error.extra = extra;
  throw error;
}

function padTwo(value) {
  return String(value).padStart(2, "0");
}

function formatIyzicoDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return formatIyzicoDate(new Date());
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(
    date.getDate()
  )} ${padTwo(date.getHours())}:${padTwo(date.getMinutes())}:${padTwo(
    date.getSeconds()
  )}`;
}

function sanitizeDigits(value) {
  return String(value || "").replace(/\D+/g, "");
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
  if (!raw) return { name: "", surname: "" };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { name: parts[0], surname: "-" };
  return {
    name: parts[0],
    surname: parts.slice(1).join(" "),
  };
}

function mapCountry(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Turkey";
  const normalized = raw.toLocaleLowerCase("tr-TR");
  if (["turkiye", "türkiye", "turkey"].includes(normalized)) return "Turkey";
  return raw;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
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
    const allowedHosts = new Set(["localhost", "127.0.0.1", "ceplife.com", "www.ceplife.com", "staging.ceplife.com"]);
    const configuredHost = normalizeAbsoluteOrigin(getIyzicoConfig().publicBaseUrl);
    if (configuredHost) {
      try {
        allowedHosts.add(new URL(configuredHost).hostname.toLowerCase());
      } catch {
        // ignore malformed host
      }
    }
    const envHosts = String(process.env.IYZICO_ALLOWED_RETURN_HOSTS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    envHosts.forEach((allowedHost) => allowedHosts.add(allowedHost));

    return allowedHosts.has(host);
  } catch {
    return false;
  }
}

function resolveReturnOrigin(req) {
  const candidates = [req.headers.origin, req.headers.referer, req.headers.referrer];

  for (const candidate of candidates) {
    const normalized = normalizeAbsoluteOrigin(candidate);
    if (normalized && isAllowedReturnOrigin(normalized)) {
      return normalized;
    }
  }

  try {
    const config = assertIyzicoConfigured();
    return config.publicBaseUrl || "";
  } catch {
    return "";
  }
}

function getSessionReturnOrigin(sessionDoc, req) {
  const candidate = String(sessionDoc?.returnOrigin || "").trim();
  if (candidate && isAllowedReturnOrigin(candidate)) return candidate;
  return resolveReturnOrigin(req);
}

function sortObjectList(values = [], buildKey) {
  return [...values].sort((left, right) => buildKey(left).localeCompare(buildKey(right)));
}

function normalizeSessionVariant(variant = null) {
  if (!variant || typeof variant !== "object") return null;
  return {
    color: variant.color ?? null,
    size: variant.size ?? null,
    attribute: variant.attribute ?? null,
  };
}

function normalizeSessionSelections(selections = []) {
  return sortObjectList(
    (Array.isArray(selections) ? selections : []).map((selection) => ({
      productId: String(selection?.productId || "").trim(),
      color: selection?.color ?? null,
      size: selection?.size ?? null,
      attribute: selection?.attribute ?? null,
      qtyInSet: Math.max(1, Number(selection?.qtyInSet || 1) || 1),
    })),
    (selection) =>
      [
        selection.productId,
        String(selection.color || ""),
        String(selection.size || ""),
        String(selection.attribute || ""),
        String(selection.qtyInSet || 1),
      ].join("|")
  );
}

function normalizeFingerprintItems(items = []) {
  return sortObjectList(
    (Array.isArray(items) ? items : []).map((item) => ({
      kind: item?.kind === "set" ? "set" : "product",
      id: String(item?.id || item?.ref || "").trim(),
      qty: Math.max(1, Number(item?.qty || 1) || 1),
      variant: normalizeSessionVariant(item?.variant),
      selections: normalizeSessionSelections(item?.selections),
    })),
    (item) =>
      [
        item.kind,
        item.id,
        String(item.qty || 1),
        JSON.stringify(item.variant || {}),
        JSON.stringify(item.selections || []),
      ].join("|")
  );
}

function normalizeAddressSnapshot(addressSnap = null) {
  if (!addressSnap || typeof addressSnap !== "object") return null;
  return {
    fullName: String(addressSnap.fullName || "").trim(),
    phone: String(addressSnap.phone || "").trim(),
    country: String(addressSnap.country || "").trim(),
    city: String(addressSnap.city || "").trim(),
    district: String(addressSnap.district || "").trim(),
    postalCode: String(addressSnap.postalCode || "").trim(),
    addressLine: String(addressSnap.addressLine || "").trim(),
  };
}

function normalizePricingSnapshot(pricing = null) {
  if (!pricing || typeof pricing !== "object") return null;
  return {
    currency: String(pricing.currency || "TRY").trim().toUpperCase(),
    subtotal: roundCurrency(Number(pricing.subtotal || 0)),
    shipping: roundCurrency(Number(pricing.shipping || 0)),
    discountAmount: roundCurrency(Number(pricing.discountAmount || 0)),
    total: roundCurrency(Number(pricing.total || 0)),
  };
}

function buildPaymentSessionFingerprint({
  userId,
  addressSnapshot,
  items,
  couponCode,
  note,
  pricing,
  returnOrigin,
  identityNumber,
}) {
  const payload = {
    userId: String(userId || "").trim(),
    addressSnapshot: normalizeAddressSnapshot(addressSnapshot),
    items: normalizeFingerprintItems(items),
    couponCode: normalizeCode(couponCode || ""),
    note: String(note || "").trim(),
    pricing: normalizePricingSnapshot(pricing),
    returnOrigin: normalizeAbsoluteOrigin(returnOrigin),
    identityNumber: normalizeIdentityNumber(identityNumber),
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function assertInitializeResponseCorrelation(result, { conversationId }) {
  const responseConversationId = String(result?.conversationId || "").trim();
  const responseToken = String(result?.token || "").trim();

  if (!responseConversationId || responseConversationId !== String(conversationId || "").trim()) {
    fail(502, "Iyzico initialize yanıtı beklenen oturumla eşleşmiyor", {
      phase: "initialize",
      code: "IYZICO_CONVERSATION_MISMATCH",
    });
  }

  if (!responseToken) {
    fail(502, "Iyzico initialize yanıtında token eksik", {
      phase: "initialize",
      code: "IYZICO_TOKEN_MISSING",
    });
  }
}

function assertRetrieveResponseCorrelation(sessionDoc, retrieveResult) {
  const expectedConversationId = String(sessionDoc?.conversationId || "").trim();
  const expectedBasketId = String(sessionDoc?.basketId || "").trim();
  const expectedToken = String(sessionDoc?.token || "").trim();
  const receivedConversationId = String(retrieveResult?.conversationId || "").trim();
  const receivedBasketId = String(retrieveResult?.basketId || "").trim();
  const receivedToken = String(retrieveResult?.token || "").trim();

  if (
    !receivedConversationId ||
    !receivedBasketId ||
    !receivedToken ||
    receivedConversationId !== expectedConversationId ||
    receivedBasketId !== expectedBasketId ||
    receivedToken !== expectedToken
  ) {
    fail(502, "Iyzico ödeme sonucu beklenen oturumla eşleşmiyor", {
      phase: "retrieve",
      code: "IYZICO_RESPONSE_MISMATCH",
    });
  }
}

function buildActiveFingerprintKey(userId, fingerprint) {
  const uid = String(userId || "").trim();
  const fp = String(fingerprint || "").trim();
  if (!uid || !fp) return null;
  return `${uid}:${fp}`;
}

function comparePricingSnapshots(left, right) {
  const leftSnapshot = normalizePricingSnapshot(left);
  const rightSnapshot = normalizePricingSnapshot(right);
  if (!leftSnapshot || !rightSnapshot) return false;
  return (
    leftSnapshot.currency === rightSnapshot.currency &&
    leftSnapshot.subtotal === rightSnapshot.subtotal &&
    leftSnapshot.shipping === rightSnapshot.shipping &&
    leftSnapshot.discountAmount === rightSnapshot.discountAmount &&
    leftSnapshot.total === rightSnapshot.total
  );
}

function isPaymentSessionExpired(sessionDoc, now = new Date()) {
  const expiresAt = sessionDoc?.expiresAt ? new Date(sessionDoc.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() <= now.getTime();
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

function buildSessionReservationState(sessionDoc, overrides = {}) {
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

function isDuplicateKeyError(error) {
  return Number(error?.code) === 11000;
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

async function notifyManualReviewIfNeeded(sessionId) {
  if (!sessionId) return { ok: false, skipped: true };

  const claimedSession = await PaymentSession.findOneAndUpdate(
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
    await PaymentSession.findByIdAndUpdate(sessionId, {
      $set: {
        "manualReviewNotification.state": "sent",
        "manualReviewNotification.sentAt": new Date(),
        "manualReviewNotification.lastError": "",
      },
    });
    return result;
  }

  await PaymentSession.findByIdAndUpdate(sessionId, {
    $set: {
      "manualReviewNotification.state": "pending",
      "manualReviewNotification.lastError": String(
        result?.error || "mail-send-failed"
      ),
    },
  });

  return result;
}

async function releasePaymentSessionReservation(
  sessionDoc,
  { session = null, at = new Date() } = {}
) {
  if (!hasActiveStockReservation(sessionDoc)) return false;

  const entries = getSessionReservationEntries(sessionDoc);
  await releaseReservedStock(entries, { session });
  sessionDoc.stockReservation = buildSessionReservationState(sessionDoc, {
    state: "released",
    entries,
    releasedAt: at,
    committedAt: null,
  });
  return true;
}

function buildConversationId(userId) {
  const random = crypto.randomBytes(6).toString("hex");
  return `cf_${String(userId)}_${Date.now()}_${random}`;
}

function truncateText(value, max = 120) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.length > max ? raw.slice(0, max) : raw;
}

function resolveCategoryPair(categoryDoc, fallbackPrimary) {
  if (!categoryDoc || typeof categoryDoc !== "object") {
    return {
      category1: fallbackPrimary,
      category2: fallbackPrimary,
    };
  }
  const name = truncateText(categoryDoc.name || fallbackPrimary || "Genel", 50);
  const parentName = truncateText(categoryDoc.parent?.name || name, 50);
  return {
    category1: parentName || name,
    category2: name || parentName || fallbackPrimary || "Genel",
  };
}

function buildBasketItems(prepared) {
  const {
    orderItems = [],
    productMap,
    setMap,
    shipping = 0,
    shippingName = "Kargo",
  } = prepared || {};

  const basketItems = orderItems.map((item, index) => {
    const baseLineTotal = roundCurrency(
      Number(item.unitPrice || 0) * Math.max(1, Number(item.qty || 1))
    );
    const couponAmount = roundCurrency(Number(item?.pricing?.coupon?.amount || 0));
    const lineTotal = roundCurrency(Math.max(0, baseLineTotal - couponAmount));
    const isSet = item.kind === "set";
    const refId = String(item.ref || "");
    const sourceDoc = isSet ? setMap?.get(refId) : productMap?.get(refId);
    const categoryPair = resolveCategoryPair(
      sourceDoc?.category || null,
      isSet ? "Set" : "Ürün"
    );
    return {
      id: `${index + 1}-${refId || index + 1}`,
      price: lineTotal,
      name: truncateText(
        `${item.name}${Number(item.qty || 1) > 1 ? ` x${item.qty}` : ""}`,
        100
      ),
      category1: categoryPair.category1,
      category2: categoryPair.category2,
      itemType: "PHYSICAL",
    };
  });

  const normalizedShipping = roundCurrency(Number(shipping || 0));
  if (normalizedShipping > 0) {
    basketItems.push({
      id: "shipping",
      price: normalizedShipping,
      name: truncateText(shippingName || "Kargo", 100),
      category1: "Kargo",
      category2: "Teslimat",
      itemType: "VIRTUAL",
    });
  }

  return basketItems;
}

function buildSessionItems(orderItems = []) {
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
      ? item.selections.map((selection) => ({
          productId: selection.productId,
          color: selection.color ?? null,
          size: selection.size ?? null,
          attribute: selection.attribute ?? null,
          qtyInSet: Math.max(1, Number(selection.qtyInSet || 1) || 1),
        }))
      : [],
  }));
}

async function loadBuyer(userId) {
  const user = await User.findById(userId).select(
    "firstName lastName fullName email phone createdAt updatedAt"
  );
  if (!user) fail(404, "Kullanıcı bulunamadı");
  return user;
}

function buildBuyerPayload({ user, addressSnap, identityNumber, ip }) {
  const fallbackName = splitFullName(addressSnap?.fullName || "");
  const name = truncateText(user.firstName || fallbackName.name || "Müşteri", 50);
  const surname = truncateText(user.lastName || fallbackName.surname || "-", 50);
  const phone = normalizePhone(addressSnap?.phone || user.phone || "");
  if (!phone) {
    fail(400, "Iyzico için teslimat adresinde geçerli telefon numarası gerekli");
  }

  return {
    id: String(user._id),
    name,
    surname,
    identityNumber: normalizeIdentityNumber(identityNumber),
    email: String(user.email || "").trim().toLowerCase(),
    gsmNumber: phone,
    registrationDate: formatIyzicoDate(user.createdAt),
    lastLoginDate: formatIyzicoDate(user.updatedAt || new Date()),
    registrationAddress: truncateText(addressSnap?.addressLine || "-", 400),
    city: truncateText(addressSnap?.city || "-", 50),
    country: truncateText(mapCountry(addressSnap?.country || "Turkey"), 50),
    zipCode: truncateText(addressSnap?.postalCode || "34000", 20),
    ip: String(ip || "127.0.0.1"),
  };
}

function buildPaymentSnapshotFromRetrieveResult(retrieveResult, paymentStatus) {
  return {
    paymentId: String(retrieveResult.paymentId || ""),
    paymentStatus,
    fraudStatus:
      retrieveResult.fraudStatus === undefined
        ? null
        : Number(retrieveResult.fraudStatus),
    installment: Number(retrieveResult.installment || 1) || 1,
    price: roundCurrency(normalizeIyzicoPrice(retrieveResult.price)),
    paidPrice: roundCurrency(normalizeIyzicoPrice(retrieveResult.paidPrice)),
    cardType: String(retrieveResult.cardType || ""),
    cardAssociation: String(retrieveResult.cardAssociation || ""),
    cardFamily: String(retrieveResult.cardFamily || ""),
    binNumber: String(retrieveResult.binNumber || ""),
    lastFourDigits: String(retrieveResult.lastFourDigits || ""),
    authCode: String(retrieveResult.authCode || ""),
    hostReference: String(retrieveResult.hostReference || ""),
  };
}

function buildAddressPayload(addressSnap) {
  return {
    address: truncateText(addressSnap?.addressLine || "-", 400),
    zipCode: truncateText(addressSnap?.postalCode || "34000", 20),
    contactName: truncateText(addressSnap?.fullName || "Müşteri", 100),
    city: truncateText(addressSnap?.city || "-", 50),
    country: truncateText(mapCountry(addressSnap?.country || "Turkey"), 50),
  };
}

async function markSessionFailure(sessionId, message, extra = {}) {
  const payload = {
    status: extra.status || "failed",
    activeFingerprintKey: null,
    lastError: {
      phase: extra.phase || "payment",
      code: extra.code || "",
      message: message || "Ödeme tamamlanamadı",
    },
  };
  if (payload.status === "manual_review") {
    payload.manualReviewNotification = buildPendingManualReviewNotification();
  }
  if (extra.releaseReservation) {
    await runInMongoTransaction(async (mongoSession) => {
      const currentSession = await PaymentSession.findById(sessionId).session(
        mongoSession
      );
      if (!currentSession) return;

      await releasePaymentSessionReservation(currentSession, {
        session: mongoSession,
      });

      currentSession.status = payload.status;
      currentSession.activeFingerprintKey = null;
      currentSession.lastError = payload.lastError;
      if (payload.manualReviewNotification) {
        currentSession.manualReviewNotification = payload.manualReviewNotification;
      }
      if (extra.payment) currentSession.payment = extra.payment;
      await currentSession.save({ session: mongoSession });
    });
    if (payload.status === "manual_review") {
      await notifyManualReviewIfNeeded(sessionId);
    }
    return;
  }

  if (extra.payment) payload.payment = extra.payment;
  await PaymentSession.findByIdAndUpdate(sessionId, payload);
  if (payload.status === "manual_review") {
    await notifyManualReviewIfNeeded(sessionId);
  }
}

async function expireInitializedSessions(
  now = new Date(),
  { userId = null, limit = 50 } = {}
) {
  const query = {
    status: "initialized",
    expiresAt: { $lte: now },
  };
  if (userId) query.user = userId;

  const expiredSessions = await PaymentSession.find(query)
    .select("_id")
    .sort({ expiresAt: 1, createdAt: 1 })
    .limit(Math.max(1, Number(limit || 0) || 50))
    .lean();

  for (const sessionDoc of expiredSessions) {
    await markSessionFailure(
      sessionDoc._id,
      "Ödeme oturumu süresi doldu.",
      {
        status: "expired",
        phase: "initialize",
        code: "SESSION_EXPIRED",
        releaseReservation: true,
      }
    );
  }
}

async function finalizePaymentSession(sessionDoc, retrieveResult, source) {
  if (!sessionDoc) fail(404, "Ödeme oturumu bulunamadı");
  if (sessionDoc.order) {
    return {
      status: "success",
      orderId: sessionDoc.order?.toString?.() || sessionDoc.order,
    };
  }

  const paymentStatus = String(retrieveResult.paymentStatus || "").toUpperCase();
  const paymentSnapshot = buildPaymentSnapshotFromRetrieveResult(
    retrieveResult,
    paymentStatus
  );
  if (paymentStatus !== "SUCCESS") {
    await markSessionFailure(
      sessionDoc._id,
      "Ödeme tamamlanamadı",
      {
        phase: source,
        code: paymentStatus || "PAYMENT_FAILED",
        payment: paymentSnapshot,
        releaseReservation: true,
      }
    );
    return { status: "failed" };
  }

  if (isPaymentSessionExpired(sessionDoc)) {
    await markSessionFailure(
      sessionDoc._id,
      "Ödeme oturumu süresi dolduğu için sipariş otomatik oluşturulmadı. Sipariş manuel kontrole alındı.",
      {
        status: "manual_review",
        phase: "verification",
        code: "SESSION_EXPIRED",
        payment: paymentSnapshot,
      }
    );
    return { status: "manual_review" };
  }

  const expectedTotal = roundCurrency(sessionDoc.pricing?.total || 0);
  const retrievedPrice = paymentSnapshot.price;
  const retrievedPaidPrice = paymentSnapshot.paidPrice;
  if (expectedTotal !== retrievedPrice || expectedTotal !== retrievedPaidPrice) {
    await markSessionFailure(
      sessionDoc._id,
      "Ödeme tutarı doğrulanamadı. Sipariş manuel kontrole alındı.",
      {
        status: "manual_review",
        phase: "verification",
        code: "AMOUNT_MISMATCH",
        payment: paymentSnapshot,
      }
    );
    return { status: "manual_review" };
  }

  try {
    const transactionResult = await runInMongoTransaction(async (mongoSession) => {
      const currentSession = await PaymentSession.findById(sessionDoc._id).session(
        mongoSession
      );
      if (!currentSession) fail(404, "Ödeme oturumu bulunamadı");
      if (currentSession.order) {
        return { orderId: currentSession.order?.toString?.() || currentSession.order };
      }

      const prepared = await buildOrderPreparation({
        userId: currentSession.user?.toString?.() || currentSession.user,
        addressSnapshot: currentSession.addressSnapshot,
        items: currentSession.items,
        couponCode: currentSession.couponCode || null,
      });

      if (!comparePricingSnapshots(prepared.summary, currentSession.pricing)) {
        currentSession.status = "manual_review";
        currentSession.activeFingerprintKey = null;
        currentSession.payment = paymentSnapshot;
        currentSession.manualReviewNotification =
          buildPendingManualReviewNotification();
        currentSession.lastError = {
          phase: "verification",
          code: "ORDER_SNAPSHOT_DRIFT",
          message:
            "Sipariş özeti ödeme sonrası değiştiği için sipariş manuel kontrole alındı.",
        };
        await currentSession.save({ session: mongoSession });
        return {
          orderId: null,
          manualReview: true,
          manualReviewSessionId:
            currentSession._id?.toString?.() || String(currentSession._id),
        };
      }

      const fraudStatus =
        retrieveResult.fraudStatus === undefined
          ? null
          : Number(retrieveResult.fraudStatus);

      let reservedStockEntries = hasActiveStockReservation(currentSession)
        ? getSessionReservationEntries(currentSession)
        : [];

      if (!reservedStockEntries.length) {
        const reservationResult = await reservePreparedStock(prepared.details, {
          session: mongoSession,
        });
        reservedStockEntries = reservationResult.stockEntries;

        if (reservedStockEntries.length) {
          currentSession.stockReservation = buildSessionReservationState(
            currentSession,
            {
              state: "reserved",
              entries: reservedStockEntries,
              reservedAt: currentSession.stockReservation?.reservedAt || new Date(),
              releasedAt: null,
              committedAt: null,
            }
          );
        }
      }

      const order = await finalizeOrder(prepared.details, {
        session: mongoSession,
        note: currentSession.note || "",
        applyStockDeductions: false,
        stockUsageEntries: reservedStockEntries,
        statusOverride: fraudStatus === 1 ? "paid" : "pending",
        paymentOverride: {
          method: "online",
          provider: "iyzico",
          txnId: String(retrieveResult.paymentId || ""),
          processorOrderId: String(currentSession.conversationId || ""),
          paidAt: new Date(),
          status: "success",
          currency: String(
            retrieveResult.currency || currentSession.pricing?.currency || "TRY"
          ),
          amount: retrievedPaidPrice,
          payer: {
            email: null,
            name: currentSession.addressSnapshot?.fullName || null,
            providerPayerId: null,
            countryCode: mapCountry(
              currentSession.addressSnapshot?.country || "Turkey"
            ),
          },
        },
      });

      currentSession.status = "success";
      currentSession.activeFingerprintKey = null;
      currentSession.order = order._id;
      currentSession.finalizedAt = new Date();
      currentSession.payment = {
        ...paymentSnapshot,
        fraudStatus,
      };
      currentSession.stockReservation = buildSessionReservationState(
        currentSession,
        {
          state: reservedStockEntries.length ? "committed" : "none",
          entries: reservedStockEntries,
          committedAt: reservedStockEntries.length ? new Date() : null,
          releasedAt: null,
        }
      );
      currentSession.lastError = null;
      await currentSession.save({ session: mongoSession });

      return {
        orderId: order._id?.toString?.() || String(order._id),
        manualReview: false,
      };
    });

    if (transactionResult.manualReview) {
      await notifyManualReviewIfNeeded(
        transactionResult.manualReviewSessionId || sessionDoc._id
      );
      return { status: "manual_review" };
    }

    return {
      status: "success",
      orderId: transactionResult.orderId,
    };
  } catch (error) {
    await markSessionFailure(
      sessionDoc._id,
      error.message || "Sipariş finalize edilemedi",
      {
        status: "manual_review",
        phase: "finalize",
        code: error.code || "",
      }
    );
    return { status: "manual_review" };
  }
}

function resolveToken(req) {
  return String(req.body?.token || req.query?.token || "").trim();
}

export async function initializeIyzicoPayment(req, res) {
  try {
    const config = assertIyzicoConfigured();
    const identityNumber = req.body?.identityNumber || "";
    const couponCode = normalizeCode(req.body?.couponCode || "");
    const note = String(req.body?.note || "").trim();
    const prepared = await buildOrderPreparation({
      userId: req.userId,
      addressId: req.body?.addressId,
      addressSnapshot: req.body?.addressSnapshot || null,
      items: req.body?.items || [],
      couponCode: couponCode || null,
    });
    const requiredStockEntries = buildPreparedStockUsageEntries(prepared.details);
    const sessionItems = buildSessionItems(prepared.details.orderItems);
    const returnOrigin = resolveReturnOrigin(req);
    const fingerprint = buildPaymentSessionFingerprint({
      userId: req.userId,
      addressSnapshot: prepared.details.addressSnap,
      items: sessionItems,
      couponCode,
      note,
      pricing: prepared.summary,
      returnOrigin,
      identityNumber,
    });
    const activeFingerprintKey = buildActiveFingerprintKey(req.userId, fingerprint);
    const now = new Date();

    await expireInitializedSessions(now, { limit: 50 });

    const existingSession = await PaymentSession.findOne({
      user: req.userId,
      fingerprint,
      status: "initialized",
      order: null,
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .lean();

    const existingReservationEntries = getSessionReservationEntries(existingSession);
    const canReuseExistingSession =
      existingSession?.checkoutUrl &&
      existingSession?.token &&
      (String(existingSession?.stockReservation?.state || "none") === "reserved" ||
        (!requiredStockEntries.length && !existingReservationEntries.length));

    if (canReuseExistingSession) {
      return res.json({
        payment: {
          provider: "iyzico",
          mode: config.sandbox ? "sandbox" : "live",
          checkoutUrl: existingSession.checkoutUrl,
          token: existingSession.token,
          reused: true,
        },
        sessionId:
          existingSession._id?.toString?.() || String(existingSession._id),
        summary: prepared.summary,
      });
    }

    const user = await loadBuyer(req.userId);
    const conversationId = buildConversationId(req.userId);
    const basketId = conversationId;
    const buyer = buildBuyerPayload({
      user,
      addressSnap: prepared.details.addressSnap,
      identityNumber,
      ip: req.ip,
    });
    const shippingAddress = buildAddressPayload(prepared.details.addressSnap);
    const billingAddress = buildAddressPayload(prepared.details.addressSnap);

    const initPayload = {
      locale: config.locale,
      conversationId,
      price: prepared.summary.total,
      paidPrice: prepared.summary.total,
      currency: prepared.summary.currency,
      basketId,
      paymentGroup: "PRODUCT",
      callbackUrl: getIyzicoCallbackUrl(),
      enabledInstallments: config.enabledInstallments,
      buyer,
      shippingAddress,
      billingAddress,
      basketItems: buildBasketItems({
        ...prepared.details,
        setMap: prepared.details.setMap,
      }),
    };

    const initializeResult = await initializeIyzicoCheckoutForm(initPayload);
    assertInitializeResponseCorrelation(initializeResult, { conversationId });

    const paymentSession = await runInMongoTransaction(async (mongoSession, tx) => {
      const reservationResult = await reservePreparedStock(prepared.details, {
        session: mongoSession,
      });
      const reservationEntries = reservationResult.stockEntries;
      const createdAt = new Date();
      try {
        const [createdSession] = await PaymentSession.create(
          [
            {
              provider: "iyzico",
              mode: config.sandbox ? "sandbox" : "live",
              status: "initialized",
              user: req.userId,
              conversationId,
              basketId,
              token: initializeResult.token,
              fingerprint,
              activeFingerprintKey,
              returnOrigin,
              checkoutUrl: initializeResult.paymentPageUrl,
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
              stockReservation: buildSessionReservationState(null, {
                state: reservationEntries.length ? "reserved" : "none",
                entries: reservationEntries,
                reservedAt: reservationEntries.length ? createdAt : null,
                releasedAt: null,
                committedAt: null,
              }),
              expiresAt: new Date(
                Date.now() + config.sessionTtlMinutes * 60 * 1000
              ),
            },
          ],
          mongoSession ? { session: mongoSession } : {}
        );
        return createdSession;
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          if (!tx?.atomic && reservationEntries.length) {
            await releaseReservedStock(reservationEntries);
          }
          throw error;
        }

        if (!tx?.atomic && reservationEntries.length) {
          await releaseReservedStock(reservationEntries);
        }

        const existing = await PaymentSession.findOne({
          activeFingerprintKey,
          status: "initialized",
          order: null,
          expiresAt: { $gt: new Date() },
        }).session(mongoSession);

        if (existing?.checkoutUrl && existing?.token) {
          return existing;
        }

        throw error;
      }
    });

    const sessionCheckoutUrl = String(
      paymentSession?.checkoutUrl || initializeResult.paymentPageUrl || ""
    ).trim();
    const sessionToken = String(
      paymentSession?.token || initializeResult.token || ""
    ).trim();

    return res.json({
      payment: {
        provider: "iyzico",
        mode: config.sandbox ? "sandbox" : "live",
        checkoutUrl: sessionCheckoutUrl,
        token: sessionToken,
        reused: sessionToken !== String(initializeResult.token || "").trim(),
      },
      sessionId: paymentSession._id?.toString?.() || String(paymentSession._id),
      summary: prepared.summary,
    });
  } catch (error) {
    if (error?.status) {
      const payload = { message: error.message || "Ödeme başlatılamadı" };
      if (error.extra) payload.details = error.extra;
      return res.status(error.status).json(payload);
    }
    return res
      .status(500)
      .json({ message: error.message || "Ödeme başlatılamadı" });
  }
}

export async function handleIyzicoCallback(req, res) {
  const token = resolveToken(req);
  if (!token) {
    return sendRedirect(
      res,
      buildIyzicoCallbackRedirectUrl({
        baseUrl: resolveReturnOrigin(req),
        status: "failed",
        message: "Iyzico token bilgisi eksik.",
      })
    );
  }

  try {
    const paymentSession = await PaymentSession.findOne({ token });
    if (!paymentSession) {
      return sendRedirect(
        res,
        buildIyzicoCallbackRedirectUrl({
          baseUrl: resolveReturnOrigin(req),
          status: "failed",
          message: "Ödeme oturumu bulunamadı.",
        })
      );
    }

    const returnOrigin = getSessionReturnOrigin(paymentSession, req);

    if (paymentSession.order) {
      return sendRedirect(
        res,
        buildIyzicoCallbackRedirectUrl({
          baseUrl: returnOrigin,
          orderId: paymentSession.order?.toString?.() || paymentSession.order,
          status: "success",
        })
      );
    }

    if (paymentSession.status === "manual_review") {
      return sendRedirect(
        res,
        buildIyzicoCallbackRedirectUrl({
          baseUrl: returnOrigin,
          status: "review",
          message:
            paymentSession.lastError?.message ||
            "Odeme manuel kontrole alindi.",
        })
      );
    }

    if (paymentSession.status === "failed") {
      return sendRedirect(
        res,
        buildIyzicoCallbackRedirectUrl({
          baseUrl: returnOrigin,
          status: "failed",
          message:
            paymentSession.lastError?.message || "Odeme tamamlanamadi.",
        })
      );
    }

    paymentSession.status = "callback_received";
    paymentSession.activeFingerprintKey = null;
    paymentSession.callbackAt = new Date();
    await paymentSession.save();

    let finalized;
    try {
      const retrieveResult = await retrieveIyzicoCheckoutForm({
        locale: assertIyzicoConfigured().locale,
        conversationId: paymentSession.conversationId,
        token,
      });
      assertRetrieveResponseCorrelation(paymentSession, retrieveResult);

      finalized = await finalizePaymentSession(
        paymentSession,
        retrieveResult,
        "callback"
      );
    } catch (error) {
      await markSessionFailure(
        paymentSession._id,
        "Ödeme sonucu doğrulanamadı. Sipariş manuel kontrole alındı.",
        {
          status: "manual_review",
          phase: "callback",
          code: error?.code || "CALLBACK_RETRIEVE_FAILED",
        }
      );

      return sendRedirect(
        res,
        buildIyzicoCallbackRedirectUrl({
          baseUrl: returnOrigin,
          status: "review",
          message:
            "Ödeme alındı ancak sonuç doğrulaması sırasında sorun oluştu. Sipariş manuel kontrole alındı.",
        })
      );
    }

    if (finalized.status === "success") {
      return sendRedirect(
        res,
        buildIyzicoCallbackRedirectUrl({
          baseUrl: returnOrigin,
          orderId: finalized.orderId,
          status: "success",
        })
      );
    }

    if (finalized.status === "manual_review") {
      return sendRedirect(
        res,
        buildIyzicoCallbackRedirectUrl({
          baseUrl: returnOrigin,
          status: "review",
          message:
            "Odeme alindi ancak siparis manuel kontrole alindi. Kisa sure icinde durum guncellenecek.",
        })
      );
    }

    return sendRedirect(
      res,
      buildIyzicoCallbackRedirectUrl({
        baseUrl: returnOrigin,
        status: "failed",
        message: "Odeme tamamlanamadi.",
      })
    );
  } catch (error) {
    return sendRedirect(
      res,
      buildIyzicoCallbackRedirectUrl({
        baseUrl: resolveReturnOrigin(req),
        status: "failed",
        message: error.message || "Odeme sonucu alınamadi.",
      })
    );
  }
}

export async function handleIyzicoWebhook(req, res) {
  try {
    const signature =
      req.headers["x-iyz-signature-v3"] ||
      req.headers["X-IYZ-SIGNATURE-V3"] ||
      "";

    const valid = validateIyzicoHppWebhookSignature(req.body, signature);
    if (!valid) {
      return res.status(401).json({ message: "Geçersiz webhook imzası" });
    }

    const token = String(req.body?.token || "").trim();
    const conversationId = String(req.body?.paymentConversationId || "").trim();
    const paymentSession = await PaymentSession.findOne(
      token ? { token } : { conversationId }
    );

    if (!paymentSession) {
      return res.status(200).json({ ok: true });
    }

    if (
      paymentSession.order ||
      paymentSession.status === "failed" ||
      paymentSession.status === "manual_review"
    ) {
      return res.status(200).json({ ok: true });
    }

    paymentSession.status = "webhook_received";
    paymentSession.activeFingerprintKey = null;
    paymentSession.webhookAt = new Date();
    await paymentSession.save();

    const status = String(req.body?.status || "").toUpperCase();
    if (status !== "SUCCESS") {
      await markSessionFailure(
        paymentSession._id,
        "Iyzico webhook odemeyi basarisiz bildirdi.",
        {
          phase: "webhook",
          code: status || "WEBHOOK_FAILURE",
          releaseReservation: true,
        }
      );
      return res.status(200).json({ ok: true });
    }

    try {
      const retrieveResult = await retrieveIyzicoCheckoutForm({
        locale: assertIyzicoConfigured().locale,
        conversationId: paymentSession.conversationId,
        token: paymentSession.token,
      });
      assertRetrieveResponseCorrelation(paymentSession, retrieveResult);

      await finalizePaymentSession(paymentSession, retrieveResult, "webhook");
    } catch (error) {
      await markSessionFailure(
        paymentSession._id,
        "Webhook sonrası ödeme doğrulanamadı. Sipariş manuel kontrole alındı.",
        {
          status: "manual_review",
          phase: "webhook",
          code: error?.code || "WEBHOOK_RETRIEVE_FAILED",
        }
      );
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res
      .status(error?.status || 500)
      .json({ message: error.message || "Webhook işlenemedi" });
  }
}
