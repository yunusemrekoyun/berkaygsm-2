import crypto from "crypto";
import User from "../models/User.js";
import PaymentSession from "../models/PaymentSession.js";
import {
  buildOrderPreparation,
  finalizeOrder,
  normalizeCode,
  roundCurrency,
  runInMongoTransaction,
} from "./orderController.js";
import {
  assertIyzicoConfigured,
  getIyzicoCallbackUrl,
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
    lastError: {
      phase: extra.phase || "payment",
      code: extra.code || "",
      message: message || "Ödeme tamamlanamadı",
    },
  };
  if (extra.payment) payload.payment = extra.payment;
  await PaymentSession.findByIdAndUpdate(sessionId, payload);
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
  if (paymentStatus !== "SUCCESS") {
    await markSessionFailure(
      sessionDoc._id,
      "Ödeme tamamlanamadı",
      {
        phase: source,
        code: paymentStatus || "PAYMENT_FAILED",
        payment: {
          paymentId: String(retrieveResult.paymentId || ""),
          paymentStatus,
          fraudStatus:
            retrieveResult.fraudStatus === undefined
              ? null
              : Number(retrieveResult.fraudStatus),
          installment: Number(retrieveResult.installment || 1) || 1,
          price: normalizeIyzicoPrice(retrieveResult.price),
          paidPrice: normalizeIyzicoPrice(retrieveResult.paidPrice),
          cardType: String(retrieveResult.cardType || ""),
          cardAssociation: String(retrieveResult.cardAssociation || ""),
          cardFamily: String(retrieveResult.cardFamily || ""),
          binNumber: String(retrieveResult.binNumber || ""),
          lastFourDigits: String(retrieveResult.lastFourDigits || ""),
          authCode: String(retrieveResult.authCode || ""),
          hostReference: String(retrieveResult.hostReference || ""),
        },
      }
    );
    return { status: "failed" };
  }

  const expectedTotal = roundCurrency(sessionDoc.pricing?.total || 0);
  const retrievedPrice = roundCurrency(normalizeIyzicoPrice(retrieveResult.price));
  const retrievedPaidPrice = roundCurrency(
    normalizeIyzicoPrice(retrieveResult.paidPrice)
  );
  if (expectedTotal !== retrievedPrice || expectedTotal !== retrievedPaidPrice) {
    await markSessionFailure(
      sessionDoc._id,
      "Ödeme tutarı doğrulanamadı. Sipariş manuel kontrole alındı.",
      {
        status: "manual_review",
        phase: "verification",
        code: "AMOUNT_MISMATCH",
        payment: {
          paymentId: String(retrieveResult.paymentId || ""),
          paymentStatus,
          fraudStatus:
            retrieveResult.fraudStatus === undefined
              ? null
              : Number(retrieveResult.fraudStatus),
          installment: Number(retrieveResult.installment || 1) || 1,
          price: retrievedPrice,
          paidPrice: retrievedPaidPrice,
          cardType: String(retrieveResult.cardType || ""),
          cardAssociation: String(retrieveResult.cardAssociation || ""),
          cardFamily: String(retrieveResult.cardFamily || ""),
          binNumber: String(retrieveResult.binNumber || ""),
          lastFourDigits: String(retrieveResult.lastFourDigits || ""),
          authCode: String(retrieveResult.authCode || ""),
          hostReference: String(retrieveResult.hostReference || ""),
        },
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

      const fraudStatus =
        retrieveResult.fraudStatus === undefined
          ? null
          : Number(retrieveResult.fraudStatus);

      const order = await finalizeOrder(prepared.details, {
        session: mongoSession,
        note: currentSession.note || "",
        statusOverride: fraudStatus === 1 ? "paid" : "pending",
        paymentOverride: {
          method: "online",
          provider: "iyzico",
          txnId: String(retrieveResult.paymentId || ""),
          processorOrderId: String(currentSession.conversationId || ""),
          paidAt: new Date(),
          status: "success",
          currency: String(retrieveResult.currency || currentSession.pricing?.currency || "TRY"),
          amount: retrievedPaidPrice,
          payer: {
            email: null,
            name: currentSession.addressSnapshot?.fullName || null,
            providerPayerId: null,
            countryCode: mapCountry(currentSession.addressSnapshot?.country || "Turkey"),
          },
        },
      });

      currentSession.status = "success";
      currentSession.order = order._id;
      currentSession.finalizedAt = new Date();
      currentSession.payment = {
        paymentId: String(retrieveResult.paymentId || ""),
        paymentStatus,
        fraudStatus,
        installment: Number(retrieveResult.installment || 1) || 1,
        price: retrievedPrice,
        paidPrice: retrievedPaidPrice,
        cardType: String(retrieveResult.cardType || ""),
        cardAssociation: String(retrieveResult.cardAssociation || ""),
        cardFamily: String(retrieveResult.cardFamily || ""),
        binNumber: String(retrieveResult.binNumber || ""),
        lastFourDigits: String(retrieveResult.lastFourDigits || ""),
        authCode: String(retrieveResult.authCode || ""),
        hostReference: String(retrieveResult.hostReference || ""),
      };
      currentSession.lastError = null;
      await currentSession.save({ session: mongoSession });

      return { orderId: order._id?.toString?.() || String(order._id) };
    });

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
    const prepared = await buildOrderPreparation({
      userId: req.userId,
      addressId: req.body?.addressId,
      addressSnapshot: req.body?.addressSnapshot || null,
      items: req.body?.items || [],
      couponCode: couponCode || null,
    });

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

    const paymentSession = await PaymentSession.create({
      provider: "iyzico",
      mode: config.sandbox ? "sandbox" : "live",
      status: "initialized",
      user: req.userId,
      conversationId,
      basketId,
      token: initializeResult.token,
      checkoutUrl: initializeResult.paymentPageUrl,
      addressSnapshot: prepared.details.addressSnap,
      items: buildSessionItems(prepared.details.orderItems),
      couponCode: couponCode || null,
      note: String(req.body?.note || "").trim(),
      pricing: {
        currency: prepared.summary.currency,
        subtotal: prepared.summary.subtotal,
        shipping: prepared.summary.shipping,
        discountAmount: prepared.summary.discountAmount,
        total: prepared.summary.total,
      },
      expiresAt: new Date(
        Date.now() + config.sessionTtlMinutes * 60 * 1000
      ),
    });

    return res.json({
      payment: {
        provider: "iyzico",
        mode: config.sandbox ? "sandbox" : "live",
        checkoutUrl: initializeResult.paymentPageUrl,
        token: initializeResult.token,
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
          status: "failed",
          message: "Ödeme oturumu bulunamadı.",
        })
      );
    }

    if (paymentSession.order) {
      return sendRedirect(
        res,
        buildIyzicoCallbackRedirectUrl({
          orderId: paymentSession.order?.toString?.() || paymentSession.order,
          status: "success",
        })
      );
    }

    if (paymentSession.status === "manual_review") {
      return sendRedirect(
        res,
        buildIyzicoCallbackRedirectUrl({
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
          status: "failed",
          message:
            paymentSession.lastError?.message || "Odeme tamamlanamadi.",
        })
      );
    }

    paymentSession.status = "callback_received";
    paymentSession.callbackAt = new Date();
    await paymentSession.save();

    const retrieveResult = await retrieveIyzicoCheckoutForm({
      locale: assertIyzicoConfigured().locale,
      conversationId: paymentSession.conversationId,
      token,
    });

    const finalized = await finalizePaymentSession(
      paymentSession,
      retrieveResult,
      "callback"
    );

    if (finalized.status === "success") {
      return sendRedirect(
        res,
        buildIyzicoCallbackRedirectUrl({
          orderId: finalized.orderId,
          status: "success",
        })
      );
    }

    if (finalized.status === "manual_review") {
      return sendRedirect(
        res,
        buildIyzicoCallbackRedirectUrl({
          status: "review",
          message:
            "Odeme alindi ancak siparis manuel kontrole alindi. Kisa sure icinde durum guncellenecek.",
        })
      );
    }

    return sendRedirect(
      res,
      buildIyzicoCallbackRedirectUrl({
        status: "failed",
        message: "Odeme tamamlanamadi.",
      })
    );
  } catch (error) {
    return sendRedirect(
      res,
      buildIyzicoCallbackRedirectUrl({
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
        }
      );
      return res.status(200).json({ ok: true });
    }

    const retrieveResult = await retrieveIyzicoCheckoutForm({
      locale: assertIyzicoConfigured().locale,
      conversationId: paymentSession.conversationId,
      token: paymentSession.token,
    });

    await finalizePaymentSession(paymentSession, retrieveResult, "webhook");
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res
      .status(error?.status || 500)
      .json({ message: error.message || "Webhook işlenemedi" });
  }
}
