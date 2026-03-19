import mongoose from "mongoose";
import PrintJob from "../models/PrintJob.js";

const ACTIVE_JOB_STATUSES = ["pending", "processing"];
const COMPLETE_JOB_STATUSES = ["printed"];

function pickUserSnapshot(rawUser) {
  if (!rawUser || typeof rawUser !== "object") return null;
  return {
    id: rawUser._id?.toString?.() || rawUser.id || "",
    firstName: rawUser.firstName || "",
    lastName: rawUser.lastName || "",
    email: rawUser.email || "",
    phone: rawUser.phone || "",
  };
}

function normalizeSelections(selections = []) {
  if (!Array.isArray(selections)) return [];
  return selections.map((selection) => ({
    productId: selection.productId?.toString?.() || selection.productId || "",
    color: selection.color || null,
    size: selection.size || null,
    attribute: selection.attribute || null,
    qtyInSet: Number(selection.qtyInSet || 1) || 1,
  }));
}

export function buildPrintJobSnapshot(order) {
  if (!order) return null;
  return {
    orderNumber: order.orderNumber || order._id?.toString?.() || "",
    createdAt: order.createdAt || new Date(),
    note: order.note || "",
    user: pickUserSnapshot(order.user),
    address: {
      fullName: order.address?.fullName || "",
      phone: order.address?.phone || "",
      country: order.address?.country || "",
      city: order.address?.city || "",
      district: order.address?.district || "",
      postalCode: order.address?.postalCode || "",
      addressLine: order.address?.addressLine || "",
    },
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          kind: item.kind || "product",
          ref: item.ref?.toString?.() || item.ref || "",
          name: item.name || "",
          unitPrice: Number(item.unitPrice || 0) || 0,
          qty: Number(item.qty || 1) || 1,
          image: item.image || "",
          variant: item.variant
            ? {
                color: item.variant.color || null,
                size: item.variant.size || null,
                attribute: item.variant.attribute || null,
              }
            : null,
          selections: normalizeSelections(item.selections),
        }))
      : [],
    subtotal: Number(order.subtotal || 0) || 0,
    coupon: order?.coupon?.code
      ? {
          code: order.coupon.code || null,
          percentage: Number(order.coupon.percentage || 0) || 0,
          discountAmount: Number(order.coupon.discountAmount || 0) || 0,
        }
      : null,
    pricing: order?.pricing
      ? {
          baseSubtotal: Number(order.pricing.baseSubtotal || 0) || 0,
          standardDiscountAmount:
            Number(order.pricing.standardDiscountAmount || 0) || 0,
          stackedDiscountAmount:
            Number(order.pricing.stackedDiscountAmount || 0) || 0,
          couponDiscountAmount:
            Number(order.pricing.couponDiscountAmount || 0) || 0,
          stacked: order.pricing.stacked
            ? {
                percentage: Number(order.pricing.stacked.percentage || 0) || 0,
                quantity: Number(order.pricing.stacked.quantity || 0) || 0,
              }
            : null,
        }
      : null,
    shipping: Number(order.shipping || 0) || 0,
    shippingName: order.shippingName || "Standart Kargo",
    total: Number(order.total || 0) || 0,
  };
}

export function canOrderCreatePrintJob(order) {
  if (!order) return false;
  const paymentStatus = String(order.payment?.status || "").toLowerCase();
  const orderStatus = String(order.status || "").toLowerCase();
  if (paymentStatus !== "success") return false;
  if (["cancelled", "failed"].includes(orderStatus)) return false;
  return true;
}

export function shapePrintJob(job) {
  if (!job) return null;
  const error = job.lastError || null;
  return {
    id: job._id?.toString?.() || job.id || "",
    order: job.order?.toString?.() || job.order || "",
    orderNumber: job.orderNumber || "",
    template: job.template || "order_label_100x150",
    source: job.source || "order_paid",
    status: job.status || "pending",
    attempts: Number(job.attempts || 0) || 0,
    maxAttempts: Number(job.maxAttempts || 0) || 0,
    printer: job.printer || "",
    claimedBy: job.claimedBy || "",
    claimedAt: job.claimedAt || null,
    printedAt: job.printedAt || null,
    nextAttemptAt: job.nextAttemptAt || null,
    requestedBy: job.requestedBy || "",
    lastError: error?.message
      ? {
          message: error.message,
          at: error.at || null,
        }
      : null,
    createdAt: job.createdAt || null,
    updatedAt: job.updatedAt || null,
  };
}

function getPrintAttemptLimit() {
  return Math.max(1, Number(process.env.PRINT_JOB_MAX_ATTEMPTS || 5));
}

function getProcessingTimeoutMs() {
  return Math.max(
    15000,
    Number(process.env.PRINT_JOB_PROCESSING_TIMEOUT_MS || 120000)
  );
}

export async function getLatestPrintJobMap(orderIds = []) {
  const normalizedIds = Array.from(
    new Set(
      orderIds
        .map((orderId) => String(orderId || "").trim())
        .filter(Boolean)
        .filter((orderId) => mongoose.Types.ObjectId.isValid(orderId))
    )
  );
  if (!normalizedIds.length) return new Map();

  const jobs = await PrintJob.find({
    order: { $in: normalizedIds },
  })
    .sort({ createdAt: -1 })
    .lean();

  const map = new Map();
  jobs.forEach((job) => {
    const orderId = String(job.order || "");
    if (!orderId || map.has(orderId)) return;
    map.set(orderId, job);
  });
  return map;
}

export async function findLatestPrintJobForOrder(orderId) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) return null;
  return PrintJob.findOne({ order: orderId }).sort({ createdAt: -1 });
}

export async function cancelOpenPrintJobsForOrder(orderId, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) return 0;
  const query = PrintJob.updateMany(
    {
      order: orderId,
      status: { $in: ACTIVE_JOB_STATUSES },
    },
    {
      $set: {
        status: "cancelled",
        nextAttemptAt: null,
      },
    }
  );
  if (options.session) query.session(options.session);
  const result = await query;
  return Number(result.modifiedCount || 0) || 0;
}

export async function ensurePrintJobForOrder(order, options = {}) {
  if (!order?._id || !order?.orderNumber) return null;

  const force = options.force === true;
  const session = options.session || null;
  const lookup = PrintJob.findOne({ order: order._id }).sort({ createdAt: -1 });
  if (session) lookup.session(session);
  const latest = await lookup;

  if (!force && latest) {
    if (ACTIVE_JOB_STATUSES.includes(latest.status)) return latest;
    if (COMPLETE_JOB_STATUSES.includes(latest.status)) return latest;
    if (latest.status === "failed") return latest;
  }

  if (force && latest && ACTIVE_JOB_STATUSES.includes(latest.status)) {
    await cancelOpenPrintJobsForOrder(order._id, { session });
  }

  const payload = {
    order: order._id,
    orderNumber: order.orderNumber,
    source: options.source || "order_paid",
    status: "pending",
    attempts: 0,
    maxAttempts: getPrintAttemptLimit(),
    printer: options.printer || process.env.PRINT_AGENT_PRINTER_NAME || "",
    nextAttemptAt: new Date(),
    snapshot: buildPrintJobSnapshot(order),
    requestedBy: options.requestedBy || "",
  };

  if (session) {
    return (await PrintJob.create([payload], { session }))[0];
  }
  return PrintJob.create(payload);
}

export async function syncPrintJobsForOrder(order, options = {}) {
  if (!order?._id) return null;

  if (!canOrderCreatePrintJob(order)) {
    await cancelOpenPrintJobsForOrder(order._id, options);
    return null;
  }

  return ensurePrintJobForOrder(order, options);
}

export async function claimNextPendingPrintJob(options = {}) {
  const now = new Date();
  await PrintJob.updateMany(
    {
      status: "processing",
      claimedAt: { $lte: new Date(now.getTime() - getProcessingTimeoutMs()) },
    },
    {
      $set: {
        status: "pending",
        nextAttemptAt: now,
        claimedAt: null,
        claimedBy: "",
      },
    }
  );

  return PrintJob.findOneAndUpdate(
    {
      status: "pending",
      nextAttemptAt: { $lte: now },
    },
    {
      $set: {
        status: "processing",
        claimedBy: options.agentId || "",
        claimedAt: now,
        printer: options.printer || "",
      },
      $inc: { attempts: 1 },
    },
    {
      sort: { nextAttemptAt: 1, createdAt: 1 },
      new: true,
    }
  );
}

export async function markPrintJobPrinted(printJobId, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(printJobId)) return null;
  return PrintJob.findByIdAndUpdate(
    printJobId,
    {
      $set: {
        status: "printed",
        printedAt: new Date(),
        printer: options.printer || "",
      },
    },
    { new: true }
  );
}

export async function markPrintJobFailed(printJobId, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(printJobId)) return null;

  const printJob = await PrintJob.findById(printJobId);
  if (!printJob) return null;

  const now = new Date();
  const retryable = options.retryable !== false;
  const message = String(options.message || "Bilinmeyen yazdırma hatası").trim();
  const maxAttempts = Number(printJob.maxAttempts || getPrintAttemptLimit());
  const attempts = Number(printJob.attempts || 0);

  printJob.lastError = {
    message,
    at: now,
  };
  printJob.printer = options.printer || printJob.printer || "";

  if (retryable && attempts < maxAttempts) {
    const delayMs = Math.min(60000, Math.max(5000, attempts * 5000));
    printJob.status = "pending";
    printJob.claimedAt = null;
    printJob.claimedBy = "";
    printJob.nextAttemptAt = new Date(now.getTime() + delayMs);
  } else {
    printJob.status = "failed";
    printJob.nextAttemptAt = null;
  }

  await printJob.save();
  return printJob;
}
