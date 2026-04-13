import mongoose from "mongoose";
import PrintJob from "../models/PrintJob.js";
import Product from "../models/Product.js";

const ACTIVE_JOB_STATUSES = ["pending", "processing"];
const COMPLETE_JOB_STATUSES = ["printed"];

export const PRINT_JOB_TEMPLATES = [
  "customer_receipt_100x150",
  "seller_receipt_100x150",
];

const DEFAULT_PRINT_TEMPLATE = PRINT_JOB_TEMPLATES[0];

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

function collectSelectionProductIds(items = []) {
  const ids = new Set();
  items.forEach((item) => {
    if (!Array.isArray(item?.selections)) return;
    item.selections.forEach((selection) => {
      const productId = String(selection?.productId || "").trim();
      if (productId && mongoose.Types.ObjectId.isValid(productId)) {
        ids.add(productId);
      }
    });
  });
  return Array.from(ids);
}

async function buildSelectionProductNameMap(items = [], options = {}) {
  const ids = collectSelectionProductIds(items);
  if (!ids.length) return new Map();
  const query = Product.find({ _id: { $in: ids } }).select("name");
  if (options.session) query.session(options.session);
  const products = await query.lean();
  return new Map(
    products.map((product) => [
      product?._id?.toString?.() || "",
      product?.name || "",
    ])
  );
}

function normalizeSelections(selections = [], productNameMap = new Map()) {
  if (!Array.isArray(selections)) return [];
  return selections.map((selection) => {
    const productId =
      selection?.productId?.toString?.() || selection?.productId || "";
    return {
      productId,
      productName: productNameMap.get(String(productId || "")) || "",
      color: selection?.color || null,
      size: selection?.size || null,
      attribute: selection?.attribute || null,
      qtyInSet: Number(selection?.qtyInSet || 1) || 1,
    };
  });
}

function normalizeItemPricing(pricing = null) {
  if (!pricing || typeof pricing !== "object") return null;
  return {
    baseUnitPrice: Number(pricing.baseUnitPrice || 0) || 0,
    standard: pricing.standard
      ? {
          discountId:
            pricing.standard.discountId?.toString?.() ||
            pricing.standard.discountId ||
            null,
          name: pricing.standard.name || "",
          percentage: Number(pricing.standard.percentage || 0) || 0,
          amount: Number(pricing.standard.amount || 0) || 0,
          removedBy: pricing.standard.removedBy || null,
        }
      : null,
    stacked: pricing.stacked
      ? {
          stackedDiscountId:
            pricing.stacked.stackedDiscountId?.toString?.() ||
            pricing.stacked.stackedDiscountId ||
            null,
          percentage: Number(pricing.stacked.percentage || 0) || 0,
          quantity: Number(pricing.stacked.quantity || 0) || 0,
          amount: Number(pricing.stacked.amount || 0) || 0,
          disabledByCoupon: pricing.stacked.disabledByCoupon === true,
        }
      : null,
    coupon: pricing.coupon
      ? {
          code: pricing.coupon.code || null,
          percentage: Number(pricing.coupon.percentage || 0) || 0,
          amount: Number(pricing.coupon.amount || 0) || 0,
        }
      : null,
  };
}

function normalizeAccountingStockUsage(stockUsage = []) {
  if (!Array.isArray(stockUsage)) return [];
  return stockUsage.map((entry) => ({
    stockItemId:
      entry?.stockItemId?.toString?.() || entry?.stockItemId || "",
    productId: entry?.productId?.toString?.() || entry?.productId || "",
    color: entry?.color ?? null,
    size: entry?.size ?? null,
    attribute: entry?.attribute ?? null,
    qty: Number(entry?.qty || 1) || 1,
    source: entry?.source || "product",
    sku: entry?.sku || "",
    previousQtyOnHand:
      Number.isFinite(Number(entry?.previousQtyOnHand))
        ? Number(entry.previousQtyOnHand)
        : null,
    remainingQtyOnHand:
      Number.isFinite(Number(entry?.remainingQtyOnHand))
        ? Number(entry.remainingQtyOnHand)
        : null,
    productName: entry?.productName || "",
    image: entry?.image || "",
  }));
}

export async function buildPrintJobSnapshot(order, options = {}) {
  if (!order) return null;

  const selectionProductNameMap = await buildSelectionProductNameMap(
    order.items,
    options
  );

  return {
    orderNumber: order.orderNumber || order._id?.toString?.() || "",
    createdAt: order.createdAt || new Date(),
    note: order.note || "",
    status: order.status || "pending",
    customerEmail:
      order.customer?.email ||
      order.user?.email ||
      order.payment?.payer?.email ||
      "",
    user: pickUserSnapshot(order.user),
    customer: {
      fullName: order.customer?.fullName || "",
      email: order.customer?.email || "",
      phone: order.customer?.phone || "",
      isGuest: order.customer?.isGuest === true,
    },
    address: {
      fullName: order.address?.fullName || "",
      phone: order.address?.phone || "",
      country: order.address?.country || "",
      city: order.address?.city || "",
      district: order.address?.district || "",
      postalCode: order.address?.postalCode || "",
      addressLine: order.address?.addressLine || "",
    },
    payment: {
      method: order.payment?.method || "",
      provider: order.payment?.provider || null,
      status: order.payment?.status || "",
      paidAt: order.payment?.paidAt || null,
      currency: order.payment?.currency || "TRY",
      amount: Number(order.payment?.amount || order.total || 0) || 0,
      txnId: order.payment?.txnId || "",
    },
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          kind: item.kind || "product",
          ref: item.ref?.toString?.() || item.ref || "",
          name: item.name || "",
          unitPrice: Number(item.unitPrice || 0) || 0,
          originalUnitPrice: Number(item.originalUnitPrice || 0) || 0,
          qty: Number(item.qty || 1) || 1,
          image: item.image || "",
          variant: item.variant
            ? {
                color: item.variant.color || null,
                size: item.variant.size || null,
                attribute: item.variant.attribute || null,
              }
            : null,
          pricing: normalizeItemPricing(item.pricing),
          selections: normalizeSelections(
            item.selections,
            selectionProductNameMap
          ),
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
    accounting: {
      stockApplied: order.accounting?.stockApplied === true,
      couponConsumed: order.accounting?.couponConsumed === true,
      stockUsage: normalizeAccountingStockUsage(order.accounting?.stockUsage),
      accountedAt: order.accounting?.accountedAt || null,
    },
  };
}

export function canOrderCreatePrintJob(order) {
  if (!order) return false;
  const paymentStatus = String(order.payment?.status || "").toLowerCase();
  const orderStatus = String(order.status || "").toLowerCase();
  if (paymentStatus !== "success") return false;
  return ["paid", "shipped", "completed"].includes(orderStatus);
}

export function shapePrintJob(job) {
  if (!job) return null;
  const error = job.lastError || null;
  return {
    id: job._id?.toString?.() || job.id || "",
    order: job.order?.toString?.() || job.order || "",
    orderNumber: job.orderNumber || "",
    template: job.template || DEFAULT_PRINT_TEMPLATE,
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
  const lookup = PrintJob.find({
    order: order._id,
    template: { $in: PRINT_JOB_TEMPLATES },
  }).sort({ createdAt: -1 });
  if (session) lookup.session(session);
  const existingJobs = await lookup;

  const latestByTemplate = new Map();
  existingJobs.forEach((job) => {
    const template = String(job?.template || "").trim();
    if (!template || latestByTemplate.has(template)) return;
    latestByTemplate.set(template, job);
  });

  if (force) {
    await cancelOpenPrintJobsForOrder(order._id, { session });
  }

  const snapshot = await buildPrintJobSnapshot(order, { session });
  const ensuredJobs = [];

  for (const template of PRINT_JOB_TEMPLATES) {
    const latest = latestByTemplate.get(template) || null;

    if (!force && latest) {
      if (ACTIVE_JOB_STATUSES.includes(latest.status)) {
        ensuredJobs.push(latest);
        continue;
      }
      if (COMPLETE_JOB_STATUSES.includes(latest.status)) {
        ensuredJobs.push(latest);
        continue;
      }
      if (latest.status === "failed") {
        ensuredJobs.push(latest);
        continue;
      }
    }

    const payload = {
      order: order._id,
      orderNumber: order.orderNumber,
      template,
      source: options.source || "order_paid",
      status: "pending",
      attempts: 0,
      maxAttempts: getPrintAttemptLimit(),
      printer: options.printer || process.env.PRINT_AGENT_PRINTER_NAME || "",
      nextAttemptAt: new Date(),
      snapshot,
      requestedBy: options.requestedBy || "",
    };

    let createdJob = null;
    if (session) {
      createdJob = (await PrintJob.create([payload], { session }))[0];
    } else {
      createdJob = await PrintJob.create(payload);
    }
    ensuredJobs.push(createdJob);
  }

  return (
    ensuredJobs.find((job) => job?.template === DEFAULT_PRINT_TEMPLATE) ||
    ensuredJobs[0] ||
    null
  );
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
  const message = String(options.message || "Bilinmeyen yazdirma hatasi").trim();
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
