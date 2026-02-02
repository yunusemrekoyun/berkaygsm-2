import mongoose from "mongoose";
import Order from "../models/Order.js";
import PayPalCheckout from "../models/PayPalCheckout.js";
import {
  buildOrderPreparation,
  finalizeOrder,
  shapeOrder,
  normalizeCode,
  roundCurrency,
  PAYPAL_CURRENCY,
  PAYPAL_ORDER_TTL_MINUTES,
} from "./orderController.js";
import {
  paypalCreateOrder,
  paypalCaptureOrder,
  paypalRefundCapture,
  PayPalError,
} from "../services/paypalClient.js";

export async function createPayPalCheckout(req, res) {
  try {
    const userId = req.userId;
    const { addressId, items = [], couponCode = null } = req.body || {};

    const preparation = await buildOrderPreparation({
      userId,
      addressId,
      items,
      couponCode,
    });

    const { summary, details, normalizedItems } = preparation;
    const purchaseUnits = buildPayPalPurchaseUnits(summary, details);
    const paypalOrder = await paypalCreateOrder({
      purchaseUnits,
    });

    const approveLink = Array.isArray(paypalOrder?.links)
      ? paypalOrder.links.find((link) => link.rel === "approve")?.href || null
      : null;

    const draft = await PayPalCheckout.create({
      user: userId,
      paypalOrderId: paypalOrder.id,
      payload: {
        addressId: addressId ? String(addressId) : "",
        items: normalizedItems,
        couponCode: couponCode ? normalizeCode(couponCode) : null,
      },
      addressSnapshot: details.addressSnap,
      summary: {
        subtotal: summary.subtotal,
        shipping: summary.shipping,
        discountAmount: summary.discountAmount,
        shippingName: summary.shippingName,
        total: summary.total,
        currency: summary.currency,
      },
      approveUrl: approveLink,
      expiresAt: new Date(
        Date.now() + PAYPAL_ORDER_TTL_MINUTES * 60 * 1000
      ),
    });

    res.json({
      draftId: draft._id.toString(),
      paypalOrderId: paypalOrder.id,
      approveUrl: approveLink,
      summary,
    });
  } catch (err) {
    if (err instanceof PayPalError || err.status) {
      const status = err.status || 500;
      const payload = {
        message: err.message || "Unable to create PayPal order",
      };
      if (err.data || err.extra) {
        payload.details = err.data || err.extra;
      }
      return res.status(status).json(payload);
    }
    res.status(500).json({
      message: err.message || "Unable to initiate PayPal checkout",
    });
  }
}

export async function capturePayPalCheckout(req, res) {
  try {
    const userId = req.userId;
    const { paypalOrderId, draftId } = req.body || {};

    if (!paypalOrderId) {
      return res.status(400).json({ message: "PayPal order id is required" });
    }
    if (!draftId || !mongoose.Types.ObjectId.isValid(draftId)) {
      return res
        .status(400)
        .json({ message: "Invalid PayPal checkout draft id" });
    }

    const draft = await PayPalCheckout.findOne({ _id: draftId, user: userId });
    if (!draft) {
      return res
        .status(404)
        .json({ message: "PayPal checkout session not found" });
    }

    if (draft.status === "completed" && draft.completedOrder) {
      const existing = await Order.findById(draft.completedOrder);
      if (existing) {
        return res.json({ order: shapeOrder(existing) });
      }
    }

    if (draft.paypalOrderId !== paypalOrderId) {
      return res.status(400).json({ message: "PayPal order mismatch" });
    }

    if (draft.expiresAt && draft.expiresAt.getTime() < Date.now()) {
      draft.status = "expired";
      await draft.save();
      return res
        .status(410)
        .json({ message: "PayPal checkout session expired" });
    }

    const payload = draft.payload || {};
    const preparation = await buildOrderPreparation({
      userId,
      addressId: payload.addressId,
      addressSnapshot: draft.addressSnapshot,
      items: payload.items || [],
      couponCode: payload.couponCode,
    });

    const { summary, details } = preparation;

    if (
      draft.summary?.total !== undefined &&
      draft.summary?.total !== null &&
      Math.abs(Number(summary.total || 0) - Number(draft.summary.total || 0)) >
        0.01
    ) {
      return res.status(409).json({
        message:
          "Order total has changed. Please restart the checkout process.",
      });
    }

    const captureResponse = await paypalCaptureOrder(paypalOrderId);
    const unit = captureResponse?.purchase_units?.[0] || {};
    const capture =
      unit?.payments?.captures?.[0] ||
      unit?.payments?.authorizations?.[0] ||
      null;

    if (!capture) {
      throw new PayPalError(
        500,
        captureResponse,
        "PayPal capture response is missing capture details"
      );
    }

    const captureStatus = capture.status || "PENDING";
    const captureAmount = Number(capture.amount?.value || 0);
    const captureCurrency = (
      capture.amount?.currency_code ||
      summary.currency ||
      PAYPAL_CURRENCY
    ).toUpperCase();

    if (Math.abs(captureAmount - Number(summary.total || 0)) > 0.01) {
      throw new PayPalError(
        409,
        captureResponse,
        "PayPal captured amount does not match order total"
      );
    }

    const paidAt = capture.update_time
      ? new Date(capture.update_time)
      : new Date();

    let orderDoc;
    try {
      orderDoc = await finalizeOrder(details, {
        userId,
        paymentOverride: {
          method: "paypal",
          status: captureStatus === "COMPLETED" ? "success" : "pending",
          txnId: capture.id || "",
          processorOrderId: paypalOrderId,
          paidAt,
          currency: captureCurrency,
          amount: captureAmount,
          simulation: null,
          payer: extractPayPalPayer(captureResponse?.payer),
        },
        statusOverride: captureStatus === "COMPLETED" ? "paid" : "pending",
        currency: captureCurrency,
      });
    } catch (commitError) {
      if (capture.id) {
        try {
          await paypalRefundCapture(
            capture.id,
            capture.amount?.value,
            captureCurrency
          );
        } catch (refundErr) {
          console.error("Failed to auto-refund PayPal capture", refundErr);
        }
      }
      throw commitError;
    }

    draft.status = "completed";
    draft.completedOrder = orderDoc._id;
    draft.completedAt = new Date();
    await draft.save();

    res.json({ order: shapeOrder(orderDoc) });
  } catch (err) {
    if (err instanceof PayPalError || err.status) {
      const status = err.status || 500;
      const payload = {
        message: err.message || "Unable to capture PayPal payment",
      };
      if (err.data || err.extra) {
        payload.details = err.data || err.extra;
      }
      return res.status(status).json(payload);
    }
    res.status(500).json({
      message: err.message || "Unable to finalize PayPal checkout",
    });
  }
}

function buildPayPalPurchaseUnits(summary, details) {
  const currency = (summary?.currency || PAYPAL_CURRENCY).toUpperCase();
  const orderItems = details?.orderItems || [];
  const items = mapOrderItemsToPaypalLineItems(orderItems, currency);

  const breakdown = {
    item_total: {
      currency_code: currency,
      value: formatAmount(summary?.subtotal || 0),
    },
    shipping: {
      currency_code: currency,
      value: formatAmount(summary?.shipping || 0),
    },
  };

  if (summary?.discountAmount > 0) {
    breakdown.discount = {
      currency_code: currency,
      value: formatAmount(summary.discountAmount),
    };
  }

  return [
    {
      reference_id: `PU-${Date.now()}`,
      amount: {
        currency_code: currency,
        value: formatAmount(summary?.total || 0),
        breakdown,
      },
      description: summary?.shippingName || "Order",
      items,
      shipping: {
        name: {
          full_name: (details?.addressSnap?.fullName || "Customer").slice(
            0,
            127
          ),
        },
        address: mapAddressToPaypal(details?.addressSnap),
      },
    },
  ];
}

function formatAmount(value) {
  return roundCurrency(value || 0).toFixed(2);
}

function mapOrderItemsToPaypalLineItems(orderItems, currency) {
  const safeItems = Array.isArray(orderItems) ? orderItems : [];
  if (!safeItems.length) {
    return [
      {
        name: "Order subtotal",
        quantity: "1",
        unit_amount: {
          currency_code: currency,
          value: formatAmount(0),
        },
        category: "PHYSICAL_GOODS",
      },
    ];
  }

  return safeItems.map((item, index) => ({
    name: String(item.name || `Item ${index + 1}`).slice(0, 127),
    quantity: String(Math.max(1, Number(item.qty || 1))),
    unit_amount: {
      currency_code: currency,
      value: formatAmount(item.unitPrice || 0),
    },
    category: "PHYSICAL_GOODS",
    sku: item.ref ? String(item.ref).slice(0, 127) : undefined,
  }));
}

function mapAddressToPaypal(addressSnap = {}) {
  const line = String(addressSnap?.addressLine || "").trim();
  const line1 = line.slice(0, 100) || "Address";
  const line2 = line.length > 100 ? line.slice(100, 200) : "";
  const city =
    String(addressSnap?.city || "Berlin").slice(0, 120) || "Berlin";
  const district = addressSnap?.district
    ? String(addressSnap.district).slice(0, 120)
    : null;
  const postal = String(addressSnap?.postalCode || "").trim() || "00000";
  const countryCode = extractCountryCode(addressSnap?.country);

  const formatted = {
    address_line_1: line1,
    admin_area_2: city,
    postal_code: postal,
    country_code: countryCode,
  };
  if (line2) formatted.address_line_2 = line2;
  if (district) formatted.admin_area_1 = district;
  return formatted;
}

function extractCountryCode(value) {
  if (!value) return "DE";
  const trimmed = String(value).trim();
  if (!trimmed) return "DE";
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const normalized = trimmed.toLowerCase();
  if (normalized.includes("germany") || normalized.includes("deutschland")) {
    return "DE";
  }
  if (normalized.includes("austria") || normalized.includes("österreich")) {
    return "AT";
  }
  if (normalized.includes("switzerland") || normalized.includes("schweiz")) {
    return "CH";
  }
  if (normalized.includes("turkey") || normalized.includes("türkiye")) {
    return "TR";
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function extractPayPalPayer(payer) {
  if (!payer) return null;
  const nameParts = [];
  if (payer.name?.given_name) nameParts.push(payer.name.given_name);
  if (payer.name?.surname) nameParts.push(payer.name.surname);
  const fullName = nameParts.join(" ").trim();
  return {
    email: payer.email_address || null,
    name: fullName || null,
    paypalId: payer.payer_id || null,
    countryCode: payer.address?.country_code || null,
  };
}
