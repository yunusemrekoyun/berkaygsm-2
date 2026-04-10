import mongoose from "mongoose";
import Order from "../models/Order.js";
import UserDetails from "../models/UserDetails.js";
import Product from "../models/Product.js";
import SetModel from "../models/Set.js";
import ShippingConfig from "../models/ShippingConfig.js";
import StockItem from "../models/StockItem.js";
import PrintJob from "../models/PrintJob.js";
import {
  consumeCouponAfterSuccess,
  normalizeCouponCodeInput,
  restoreCouponAfterReversal,
  resolveCouponOrderContext,
} from "../utils/couponEngine.js";
import {
  fetchActiveDiscounts,
  computeProductDiscountMap,
  mapDiscountsToSets,
} from "../utils/discountHelpers.js";
import { hydrateProductsWithInventory } from "../utils/stockItemHelpers.js";
import { calculateCartPricing } from "../../utils/pricingEngine.js";
import { getStackedDiscountConfig } from "../services/stackedDiscountService.js";
import {
  buildPricingLineFromProduct,
  buildPricingLineFromSet,
} from "../utils/pricingLineHelpers.js";
import {
  findLatestPrintJobForOrder,
  getLatestPrintJobMap,
  shapePrintJob,
  syncPrintJobsForOrder,
} from "../services/printJobService.js";
import { maybeCreateLowStockNotification } from "../services/adminNotificationService.js";
import {
  sendOrderShippedEmail,
} from "../services/emailService.js";
import {
  buildOrderCouponContext,
  buildOrderStockUsageEntries,
  deriveOrderAccountingState,
  shouldOrderHaveAccountingEffects,
} from "../utils/orderAccounting.js";

const PAYMENT_CURRENCY = (process.env.PAYMENT_CURRENCY || "TRY").toUpperCase();

function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(-4).toUpperCase();
  return `AYY-${y}${m}${d}-${rand}`;
}

async function createOrderNumber() {
  for (let i = 0; i < 6; i += 1) {
    const candidate = generateOrderNumber();
    const exists = await Order.exists({ orderNumber: candidate });
    if (!exists) return candidate;
  }
  throw new Error("Benzersiz sipariş numarası üretilemedi");
}

function toBoolean(value) {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

async function runInMongoTransaction(work) {
  const session = await mongoose.startSession();
  let result = null;
  try {
    try {
      await session.withTransaction(async () => {
        result = await work(session, { atomic: true });
      });
    } catch (error) {
      const message = String(error?.message || "");
      const transactionUnsupported =
        message.includes("Transaction numbers are only allowed") ||
        message.includes("Transaction support is not available");
      if (!transactionUnsupported) throw error;
      result = await work(null, { atomic: false });
    }
    return result;
  } finally {
    await session.endSession();
  }
}

// normalize helpers
function normalize(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.toLowerCase() : null;
}

function shapeOrder(doc, printJob = null) {
  if (!doc) return null;
  const rawUser = doc.user;
  const populatedUser =
    rawUser && typeof rawUser === "object" && "_id" in rawUser ? rawUser : null;
  const userId = populatedUser
    ? populatedUser._id.toString()
    : rawUser?.toString?.() || rawUser;
  const customerSnapshot =
    doc.customer && typeof doc.customer === "object" ? doc.customer : null;
  const customerFullName =
    String(customerSnapshot?.fullName || "").trim() ||
    [populatedUser?.firstName, populatedUser?.lastName].filter(Boolean).join(" ") ||
    String(doc.address?.fullName || "").trim();
  const customerEmail =
    String(customerSnapshot?.email || "").trim() ||
    String(populatedUser?.email || "").trim() ||
    String(doc.payment?.payer?.email || "").trim();
  const customerPhone =
    String(customerSnapshot?.phone || "").trim() ||
    String(doc.address?.phone || "").trim() ||
    String(populatedUser?.phone || "").trim();
  return {
    id: doc._id.toString(),
    orderNumber: doc.orderNumber || doc._id.toString(),
    user: populatedUser
      ? {
          id: userId,
          firstName: populatedUser.firstName || "",
          lastName: populatedUser.lastName || "",
          email: populatedUser.email || "",
          phone: populatedUser.phone || "",
        }
      : userId,
    customer: {
      fullName: customerFullName,
      email: customerEmail,
      phone: customerPhone,
      isGuest: customerSnapshot?.isGuest === true || !userId,
    },
    items: doc.items.map((i) => ({
      kind: i.kind,
      ref: i.ref?.toString?.() || i.ref,
      name: i.name,
      unitPrice: i.unitPrice,
      originalUnitPrice: i.originalUnitPrice ?? i.unitPrice,
      qty: i.qty,
      image: i.image || "",
      pricing: i.pricing
        ? {
            baseUnitPrice: i.pricing.baseUnitPrice ?? i.originalUnitPrice ?? i.unitPrice,
            standard: i.pricing.standard
              ? {
                  discountId:
                    i.pricing.standard.discountId?.toString?.() ||
                    i.pricing.standard.discountId ||
                    null,
                  name: i.pricing.standard.name || "",
                  percentage: i.pricing.standard.percentage || 0,
                  amount: i.pricing.standard.amount || 0,
                  removedBy: i.pricing.standard.removedBy || null,
                }
              : null,
            stacked: i.pricing.stacked
              ? {
                  stackedDiscountId:
                    i.pricing.stacked.stackedDiscountId?.toString?.() ||
                    i.pricing.stacked.stackedDiscountId ||
                    null,
                  percentage: i.pricing.stacked.percentage || 0,
                  quantity: i.pricing.stacked.quantity || 0,
                  amount: i.pricing.stacked.amount || 0,
                  disabledByCoupon: i.pricing.stacked.disabledByCoupon === true,
                }
              : null,
            coupon: i.pricing.coupon
              ? {
                  code: i.pricing.coupon.code || null,
                  percentage: i.pricing.coupon.percentage || 0,
                  amount: i.pricing.coupon.amount || 0,
                }
              : null,
          }
        : null,
      variant: i.variant
        ? {
            color: i.variant.color || null,
            size: i.variant.size || null,
            attribute: i.variant.attribute || null,
          }
        : null,
      selections:
        Array.isArray(i.selections) && i.selections.length
          ? i.selections.map((s) => ({
              productId: s.productId?.toString?.() || s.productId,
              color: s.color || null,
              size: s.size || null,
              attribute: s.attribute || null,
              qtyInSet: s.qtyInSet || 1,
            }))
          : [],
    })),
    address: doc.address,
    note: doc.note || "",
    subtotal: doc.subtotal,
    shipping: doc.shipping,
    shippingName: doc.shippingName || "Standart Kargo",
    total: doc.total,
    coupon: doc.coupon?.code
      ? {
          couponId: doc.coupon.couponId?.toString?.() || null,
          assignmentId: doc.coupon.assignmentId?.toString?.() || null,
          code: doc.coupon.code,
          template: doc.coupon.template || null,
          audience: doc.coupon.audience || null,
          percentage: doc.coupon.percentage,
          eligibleSubtotal: doc.coupon.eligibleSubtotal || 0,
          discountAmount: doc.coupon.discountAmount,
          minSubtotal: doc.coupon.minSubtotal,
        }
      : null,
    pricing: doc.pricing
      ? {
          baseSubtotal: doc.pricing.baseSubtotal || 0,
          standardDiscountAmount: doc.pricing.standardDiscountAmount || 0,
          stackedDiscountAmount: doc.pricing.stackedDiscountAmount || 0,
          couponDiscountAmount: doc.pricing.couponDiscountAmount || 0,
          stacked: doc.pricing.stacked
            ? {
                stackedDiscountId:
                  doc.pricing.stacked.stackedDiscountId?.toString?.() ||
                  doc.pricing.stacked.stackedDiscountId ||
                  null,
                quantity: doc.pricing.stacked.quantity || 0,
                eligibleQuantity: doc.pricing.stacked.eligibleQuantity || 0,
                percentage: doc.pricing.stacked.percentage || 0,
                eligibleSubtotal: doc.pricing.stacked.eligibleSubtotal || 0,
                discountAmount: doc.pricing.stacked.discountAmount || 0,
                allowCouponStacking:
                  doc.pricing.stacked.allowCouponStacking !== false,
                allowDiscountStacking:
                  doc.pricing.stacked.allowDiscountStacking !== false,
                disabledByCoupon:
                  doc.pricing.stacked.disabledByCoupon === true,
              }
            : null,
        }
      : null,
    status: doc.status,
    payment: doc.payment,
    printJob: shapePrintJob(printJob || doc.printJob || null),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function shapeCustomerOrder(doc) {
  const shaped = shapeOrder(doc, null);
  if (!shaped) return shaped;
  delete shaped.printJob;
  return shaped;
}

// --- Public (kimlik doğrulamasız) response için maskeleme yardımcıları ---

function maskEmail(email) {
  const raw = String(email || "").trim();
  if (!raw) return "";
  const atIdx = raw.indexOf("@");
  if (atIdx < 0) return `${raw.slice(0, 2)}***`;
  const local = raw.slice(0, atIdx);
  const domain = raw.slice(atIdx);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***${domain}`;
}

function maskPhone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  if (raw.length <= 5) return "***";
  return `${raw.slice(0, 3)}****${raw.slice(-2)}`;
}

/**
 * Kimlik doğrulaması olmadan halka açık sipariş takibinde kullanılan şekillendirici.
 * Tam adres satırı, telefon ve email maskeli döner; admin ve kullanıcı görünümleri etkilenmez.
 */
function shapePublicOrder(doc) {
  const shaped = shapeCustomerOrder(doc);
  if (!shaped) return shaped;

  if (shaped.customer) {
    shaped.customer = {
      ...shaped.customer,
      email: maskEmail(shaped.customer.email),
      phone: maskPhone(shaped.customer.phone),
    };
  }

  if (shaped.address) {
    shaped.address = {
      ...shaped.address,
      phone: maskPhone(shaped.address.phone),
      // Tam adres satırı public response'da gizlenir; şehir/ilçe yeterlidir.
      addressLine: shaped.address.addressLine ? "***" : "",
    };
  }

  return shaped;
}

async function resolveAddressSnapshot({
  userId,
  addressId,
  fallbackSnapshot = null,
}) {
  if (addressId && mongoose.Types.ObjectId.isValid(addressId)) {
    const details = await UserDetails.findOne({ user: userId });
    const addr = details?.addresses?.id(addressId);
    if (addr) {
      return {
        fullName: addr.fullName,
        phone: addr.phone,
        country: addr.country,
        city: addr.city,
        district: addr.district,
        postalCode: addr.postalCode,
        addressLine: addr.addressLine,
      };
    }
  }
  if (fallbackSnapshot) {
    return {
      fullName: fallbackSnapshot.fullName || "",
      phone: fallbackSnapshot.phone || "",
      country: fallbackSnapshot.country || "",
      city: fallbackSnapshot.city || "",
      district: fallbackSnapshot.district || "",
      postalCode: fallbackSnapshot.postalCode || "",
      addressLine: fallbackSnapshot.addressLine || "",
    };
  }
  fail(404, "Adres bulunamadı");
}

function sanitizeCheckoutItemsInput(rawItems = []) {
  if (!Array.isArray(rawItems)) return [];
  const list = [];
  for (const raw of rawItems) {
    if (!raw) continue;
    const inferredKind =
      raw.kind ||
      (raw.setId ? "set" : raw.productId || raw.ref ? "product" : "product");
    const kind = String(inferredKind).toLowerCase() === "set" ? "set" : "product";
    const idCandidate =
      raw.id ||
      raw.ref ||
      raw._id ||
      (kind === "product" ? raw.productId : raw.setId);
    const id = idCandidate ? String(idCandidate).trim() : "";
    if (!id) continue;
    const qtyRaw =
      raw.qty ??
      raw.quantity ??
      raw.count ??
      raw.amount ??
      raw.q ??
      1;
    const qty = Math.max(1, Number(qtyRaw) || 1);

    if (kind === "set") {
      const selectionsSource = Array.isArray(raw.selections)
        ? raw.selections
        : Array.isArray(raw.items)
        ? raw.items
        : [];
      const selections = selectionsSource
        .map((sel) => {
          const productId =
            sel?.productId ||
            sel?.id ||
            sel?._id ||
            sel?.ref ||
            sel?.product?._id ||
            sel?.productId?._id;
          if (!productId) return null;
          return {
            productId: String(productId),
            color: sanitizeVariantValue(sel?.color ?? sel?.colour ?? null),
            size: sanitizeVariantValue(sel?.size ?? null),
            attribute: sanitizeVariantValue(
              sel?.attribute ?? sel?.attributeValue ?? null
            ),
            qtyInSet: Math.max(
              1,
              Number(sel?.qtyInSet ?? sel?.qty ?? sel?.quantity ?? 1) || 1
            ),
          };
        })
        .filter(Boolean);

      list.push({
        kind,
        id,
        qty,
        selections,
      });
      continue;
    }

    const variant = raw.variant && typeof raw.variant === "object" ? raw.variant : {};
    const sanitizedVariant = {
      color: sanitizeVariantValue(
        variant.color ??
          variant.colour ??
          raw.color ??
          raw.colour ??
          variant.selectedColor ??
          null
      ),
      size: sanitizeVariantValue(variant.size ?? raw.size ?? null),
      attribute: sanitizeVariantValue(
        variant.attribute ??
          variant.attributeValue ??
          raw.attribute ??
          raw.attributeValue ??
          null
      ),
    };

    list.push({
      kind,
      id,
      qty,
      variant: sanitizedVariant,
      color: sanitizedVariant.color,
      size: sanitizedVariant.size,
      attribute: sanitizedVariant.attribute,
    });
  }
  return list;
}

function summarizeOrderItems(orderItems = []) {
  return orderItems.map((item) => ({
    kind: item.kind,
    ref: item.ref?.toString?.() || String(item.ref),
    name: item.name,
    unitPrice: item.unitPrice,
    qty: item.qty,
  }));
}

function buildProductStockComboKey(variant = {}) {
  return `p|${normalize(variant.color) || ""}|${normalize(variant.size) || ""}|${
    normalize(variant.attribute) || ""
  }`;
}

function resolveExpectedSetSelections(setDoc) {
  return (Array.isArray(setDoc?.products) ? setDoc.products : []).map(
    (entry, index) => ({
      index,
      productId:
        entry?.product?._id?.toString?.() ||
        entry?.product?.id?.toString?.() ||
        entry?.product?.toString?.() ||
        null,
      qtyInSet: Math.max(1, Number(entry?.quantity || 1) || 1),
      productName: entry?.product?.name || "",
    })
  );
}

function validateSetSelections(setDoc, rawSelections = []) {
  const expectedSelections = resolveExpectedSetSelections(setDoc);
  if (!expectedSelections.length) {
    fail(400, "Set içeriği boş olduğu için siparişe eklenemez", {
      setId: String(setDoc?._id || ""),
    });
  }

  if (rawSelections.length !== expectedSelections.length) {
    fail(400, "Set içeriği seçimleri eksik veya geçersiz", {
      setId: String(setDoc?._id || ""),
      expectedCount: expectedSelections.length,
      receivedCount: rawSelections.length,
    });
  }

  const remainingSelections = rawSelections.map((selection, index) => ({
    selection,
    index,
    used: false,
  }));

  return expectedSelections.map((expected, index) => {
    const match = remainingSelections.find((entry) => {
      if (entry.used) return false;
      const receivedProductId = String(entry.selection?.productId || "").trim();
      const receivedQtyInSet = Math.max(
        1,
        Number(entry.selection?.qtyInSet || 1) || 1
      );
      return (
        receivedProductId &&
        receivedProductId === expected.productId &&
        receivedQtyInSet === expected.qtyInSet
      );
    });

    if (!match) {
      const productMatch = remainingSelections.find((entry) => {
        if (entry.used) return false;
        return String(entry.selection?.productId || "").trim() === expected.productId;
      });

      if (productMatch) {
        const receivedQtyInSet = Math.max(
          1,
          Number(productMatch.selection?.qtyInSet || 1) || 1
        );
        fail(400, "Set ürün adedi set tanımıyla eşleşmiyor", {
          setId: String(setDoc?._id || ""),
          index,
          productId: expected.productId,
          expectedQtyInSet: expected.qtyInSet,
          receivedQtyInSet,
        });
      }

      fail(400, "Set seçimi set tanımıyla eşleşmiyor", {
        setId: String(setDoc?._id || ""),
        index,
        expectedProductId: expected.productId,
        receivedProductId: null,
      });
    }

    match.used = true;
    const selection = match.selection;
    const receivedProductId = String(selection?.productId || "").trim();

    return {
      productId: expected.productId,
      productName: expected.productName,
      qtyInSet: expected.qtyInSet,
      color: selection?.color ?? null,
      size: selection?.size ?? null,
      attribute: selection?.attribute ?? null,
    };
  });
}

function buildStockUsageSnapshot(stockUsage = new Map()) {
  return Array.from(stockUsage.values()).map((usage) => {
    const variant = decodeVariantKey(usage.variantKey);
    return {
      productId: usage.productId,
      color: variant.color,
      size: variant.size,
      attribute: variant.attribute,
      qty: usage.qty,
      source: usage.source || "product",
      productName: usage.productName || "",
      image: usage.image || "",
    };
  });
}

function buildPreparedStockUsageEntries(prepared = {}) {
  const {
    catalogNeedMap,
    setNeedMap,
    productMap,
  } = prepared;

  const entries = new Map();

  function pushEntry(productId, variantKey, qty, source) {
    const pid = String(productId || "").trim();
    const amount = Math.max(0, Math.floor(Number(qty || 0) || 0));
    const key = String(variantKey || "").trim();
    if (!pid || !key || amount <= 0) return;

    const entryKey = `${pid}::${key}`;
    const variant = decodeVariantKey(key);
    const product = productMap?.get(pid) || null;
    const current = entries.get(entryKey) || {
      productId: pid,
      color: variant.color,
      size: variant.size,
      attribute: variant.attribute,
      qty: 0,
      source: source === "set_selection" ? "set_selection" : "product",
      productName: product?.name || "",
      image: product?.images?.[0]?.url || "",
    };

    current.qty += amount;
    if (source === "set_selection") current.source = "set_selection";
    entries.set(entryKey, current);
  }

  for (const [pid, variants] of catalogNeedMap?.entries?.() || []) {
    for (const [vkey, entry] of variants.entries()) {
      const index = Number(entry?.index);
      if (!Number.isFinite(index) || index < 0) continue;
      pushEntry(pid, vkey, entry?.qty, "product");
    }
  }

  for (const [pid, variants] of setNeedMap?.entries?.() || []) {
    for (const [vkey, qty] of variants.entries()) {
      pushEntry(pid, vkey, qty, "set_selection");
    }
  }

  return Array.from(entries.values());
}

function setOrderAccounting(order, values = {}) {
  if (!order || typeof order !== "object") return;
  order.accounting = {
    ...(order.accounting && typeof order.accounting === "object"
      ? order.accounting.toObject?.() || order.accounting
      : {}),
    ...values,
  };
}

async function rollbackCreatedOrderArtifacts(orderId) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) return;
  await Promise.all([
    PrintJob.deleteMany({ order: orderId }),
    Order.deleteOne({ _id: orderId }),
  ]);
}

async function syncOrderPrintJobsSafely(order, options = {}) {
  try {
    return await syncPrintJobsForOrder(order, options);
  } catch (error) {
    console.error("Failed to sync print jobs for order", {
      orderId: order?._id?.toString?.() || "",
      error: error?.message || error,
    });
    return null;
  }
}

async function restoreStockUsageSnapshot(stockEntries = [], session = null) {
  const normalizedEntries = Array.isArray(stockEntries) ? stockEntries : [];
  if (!normalizedEntries.length) return;

  const ops = normalizedEntries
    .map((entry) => {
      const productId = String(entry?.productId || "").trim();
      if (!mongoose.Types.ObjectId.isValid(productId)) return null;
      const variant = {
        color: entry?.color ?? null,
        size: entry?.size ?? null,
        attribute: entry?.attribute ?? null,
      };
      const qty = Math.max(1, Math.floor(Number(entry?.qty || 0) || 0));
      if (qty <= 0) return null;

      return {
        updateOne: {
          filter: {
            ownerModel: "Product",
            owner: new mongoose.Types.ObjectId(productId),
            comboKey: buildProductStockComboKey(variant),
          },
          update: {
            $setOnInsert: {
              ownerModel: "Product",
              owner: new mongoose.Types.ObjectId(productId),
              comboKey: buildProductStockComboKey(variant),
            },
            $set: {
              color: variant.color,
              size: variant.size,
              attributeValue: variant.attribute,
              isActive: true,
            },
            $inc: { qtyOnHand: qty },
          },
          upsert: true,
        },
      };
    })
    .filter(Boolean);

  if (!ops.length) return;
  await StockItem.bulkWrite(ops, { ordered: false, ...(session ? { session } : {}) });
}

async function applyOrderStockAccounting(order, options = {}) {
  const session = options.session || null;
  const strictMissingStock = options.strictMissingStock === true;
  const stockEntries = Array.isArray(options.stockEntries)
    ? options.stockEntries
    : buildOrderStockUsageEntries(order);
  if (!stockEntries.length) {
    return { applied: false, stockEntries: [] };
  }

  const productIds = Array.from(
    new Set(
      stockEntries
        .map((entry) => String(entry?.productId || "").trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  );

  if (!productIds.length) {
    return { applied: false, stockEntries: [] };
  }

  const stockRowsQuery = StockItem.find({
    ownerModel: "Product",
    owner: { $in: productIds },
    isActive: true,
  }).lean();
  if (session) stockRowsQuery.session(session);
  const stockRows = await stockRowsQuery;

  const buckets = new Map();
  stockRows.forEach((row) => {
    const ownerId = String(row.owner || "");
    if (!ownerId) return;
    if (!buckets.has(ownerId)) {
      buckets.set(ownerId, { rows: [], itemMap: new Map() });
    }
    const bucket = buckets.get(ownerId);
    bucket.rows.push(row);
    bucket.itemMap.set(variantKeyOf(row), row);
  });

  const appliedUsage = [];

  for (const entry of stockEntries) {
    const productId = String(entry?.productId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(productId)) continue;

    const qty = Math.max(1, Math.floor(Number(entry?.qty || 0) || 0));
    if (qty <= 0) continue;

    const variant = {
      color: entry?.color ?? null,
      size: entry?.size ?? null,
      attribute: entry?.attribute ?? null,
    };
    const variantKey = makeVariantKey(variant);
    const bucket = buckets.get(productId);

    if (!bucket || bucket.rows.length === 0) {
      if (entry?.source === "set_selection" || strictMissingStock) {
        fail(
          409,
          entry?.source === "set_selection"
            ? "Set secimi için stok satiri bulunamadi"
            : "Ürün için stok kaydı bulunamadı",
          {
            productId,
            variant,
          }
        );
      }
      continue;
    }

    const previousRow = bucket.itemMap.get(variantKey) || null;
    if (!previousRow) {
      fail(409, "Siparis varyanti için stok satiri bulunamadi", {
        productId,
        variant,
      });
    }

    const updateQuery = StockItem.findOneAndUpdate(
      { _id: previousRow._id, qtyOnHand: { $gte: qty } },
      { $inc: { qtyOnHand: -qty } },
      { new: true }
    );
    if (session) updateQuery.session(session);
    const nextRow = await updateQuery.lean();

    if (!nextRow) {
      fail(409, "Yetersiz stok", {
        productId,
        variant,
        requested: qty,
      });
    }

    bucket.itemMap.set(variantKey, nextRow);
    appliedUsage.push({
      productId,
      color: variant.color,
      size: variant.size,
      attribute: variant.attribute,
      qty,
      source: entry?.source || "product",
      productName: entry?.productName || "",
      image: entry?.image || "",
    });

    await maybeCreateLowStockNotification({
      ownerModel: "Product",
      owner: productId,
      stockItemId: nextRow._id,
      comboKey: nextRow.comboKey,
      color: nextRow.color,
      size: nextRow.size,
      attributeValue: nextRow.attributeValue,
      previousQty: previousRow?.qtyOnHand,
      qtyOnHand: nextRow.qtyOnHand,
      productName: entry?.productName || "",
      image: entry?.image || "",
      session,
    });
  }

  return {
    applied: appliedUsage.length > 0,
    stockEntries: appliedUsage,
  };
}

async function reservePreparedStock(prepared, options = {}) {
  const stockEntries = buildPreparedStockUsageEntries(prepared);
  if (!stockEntries.length) {
    return { applied: false, stockEntries: [] };
  }

  return applyOrderStockAccounting(
    {},
    {
      session: options.session || null,
      stockEntries,
      strictMissingStock: true,
    }
  );
}

async function releaseReservedStock(stockEntries = [], options = {}) {
  return restoreStockUsageSnapshot(stockEntries, options.session || null);
}

async function hydrateMissingProductStockBuckets(
  productStockMap,
  productIds = []
) {
  if (!Array.isArray(productIds) || !productIds.length) return;
  const targetMap =
    productStockMap instanceof Map ? productStockMap : new Map();

  const missing = Array.from(
    new Set(
      productIds
        .map((id) => String(id || "").trim())
        .filter(Boolean)
        .filter((id) => !targetMap.has(id))
    )
  ).filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (!missing.length) return;

  const rows = await StockItem.find({
    ownerModel: "Product",
    owner: { $in: missing },
    isActive: true,
  }).lean();

  rows.forEach((row) => {
    const owner = String(row.owner || "");
    if (!owner) return;
    if (!targetMap.has(owner)) {
      targetMap.set(owner, {
        items: [],
        itemMap: new Map(),
      });
    }
    const bucket = targetMap.get(owner);
    bucket.items.push(row);
    bucket.itemMap.set(variantKeyOf(row), row);
  });
}

function mergeVariantNeed(targetMap, productId, variantKey, qty, source) {
  const pid = String(productId || "").trim();
  const key = String(variantKey || "").trim();
  const amount = Math.max(0, Number(qty || 0));
  if (!pid || !key || amount <= 0) return;

  if (!targetMap.has(pid)) targetMap.set(pid, new Map());
  const bucket = targetMap.get(pid);
  const current = bucket.get(key) || {
    totalQty: 0,
    directQty: 0,
    setQty: 0,
  };
  current.totalQty += amount;
  if (source === "set") current.setQty += amount;
  else current.directQty += amount;
  bucket.set(key, current);
}

async function validateCombinedTrackedStock({
  productMap,
  productStockMap,
  catalogNeedMap,
  setNeedMap,
}) {
  const combinedNeedMap = new Map();

  for (const [pid, variants] of catalogNeedMap.entries()) {
    for (const [vkey, entry] of variants.entries()) {
      mergeVariantNeed(combinedNeedMap, pid, vkey, entry?.qty, "product");
    }
  }

  for (const [pid, variants] of setNeedMap.entries()) {
    for (const [vkey, qty] of variants.entries()) {
      mergeVariantNeed(combinedNeedMap, pid, vkey, qty, "set");
    }
  }

  for (const [pid, variants] of combinedNeedMap.entries()) {
    const prod = await ensureProductLoaded(productMap, pid);
    if (!prod) {
      fail(400, "Stok doğrulaması için ürün bulunamadı", { productId: pid });
    }

    const inventory = Array.isArray(prod.inventory) ? prod.inventory : [];
    const stockBucket = productStockMap?.get(pid) || null;

    for (const [variantKey, requirement] of variants.entries()) {
      const stockDoc = stockBucket?.itemMap?.get(variantKey) || null;
      const inventoryRow =
        inventory.find((row) => variantKeyOf(row) === variantKey) || null;

      if (!stockDoc && !inventoryRow) {
        fail(400, "Ürün için varyant bulunamadı", {
          productId: pid,
          variant: decodeVariantKey(variantKey),
        });
      }

      const available = stockDoc
        ? Math.max(0, Math.floor(Number(stockDoc.qtyOnHand || 0) || 0))
        : Math.max(
            0,
            Math.floor(
              Number(
                inventoryRow?.stockCatalog ??
                  inventoryRow?.stock ??
                  inventoryRow?.qtyOnHand ??
                  0
              ) || 0
            )
          );

      if (available < requirement.totalQty) {
        const hasDirect = requirement.directQty > 0;
        const hasSet = requirement.setQty > 0;
        const message =
          hasDirect && hasSet
            ? "Ürün ve set toplamı için yeterli stok yok"
            : hasSet
              ? "Seçim için yetersiz stok"
              : "Ürün için yeterli stok yok";

        fail(400, message, {
          productId: pid,
          variant: decodeVariantKey(variantKey),
          needed: requirement.totalQty,
          available,
          directQty: requirement.directQty,
          setQty: requirement.setQty,
        });
      }
    }
  }
}

async function buildOrderPreparation({
  userId,
  addressId,
  addressSnapshot = null,
  items = [],
  couponCode = null,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    fail(400, "Sepet boş");
  }
  if (!addressSnapshot && !mongoose.Types.ObjectId.isValid(addressId)) {
    fail(400, "Geçersiz adres id");
  }

  const normalizedItems = sanitizeCheckoutItemsInput(items);
  if (!normalizedItems.length) {
    fail(400, "Sepet boş");
  }

  const addressSnap = await resolveAddressSnapshot({
    userId,
    addressId,
    fallbackSnapshot: addressSnapshot,
  });

  const productLineIds = normalizedItems
    .filter(
      (x) => x.kind === "product" && mongoose.Types.ObjectId.isValid(x.id)
    )
    .map((x) => x.id);

  const setIds = normalizedItems
    .filter(
      (x) => x.kind === "set" && mongoose.Types.ObjectId.isValid(x.id)
    )
    .map((x) => x.id);

  const selectionProductIds = [];
  for (const item of normalizedItems) {
    if (item.kind !== "set") continue;
    if (!Array.isArray(item.selections) || item.selections.length === 0) {
      fail(400, "Set seçimleri zorunlu");
    }
    for (const sel of item.selections) {
      if (!mongoose.Types.ObjectId.isValid(sel.productId)) {
        fail(400, "Geçersiz seçim productId");
      }
      selectionProductIds.push(sel.productId);
    }
  }

  const allProductIds = Array.from(
    new Set([...productLineIds, ...selectionProductIds])
  );

  const [products, sets] = await Promise.all([
    allProductIds.length
      ? Product.find({ _id: { $in: allProductIds } }).populate("category")
      : [],
    setIds.length
      ? SetModel.find({ _id: { $in: setIds } })
          .populate("products.product")
          .populate("category")
      : [],
  ]);

  const productStockMap = await hydrateProductsWithInventory(products);

  const pMap = new Map(products.map((p) => [String(p._id), p]));
  const sMap = new Map(sets.map((s) => [String(s._id), s]));

  const activeDiscounts = await fetchActiveDiscounts();
  const productDiscountMap =
    activeDiscounts.length && products.length
      ? computeProductDiscountMap(activeDiscounts, products)
      : new Map();
  const setDiscountMap =
    activeDiscounts.length && sets.length
      ? mapDiscountsToSets(
          activeDiscounts,
          sets.map((set) => set._id)
        )
      : new Map();

  const orderItems = [];
  const pricingLines = [];
  const catalogNeedMap = new Map();
  const setNeedMap = new Map();

  for (const raw of normalizedItems) {
    const qty = Math.max(1, Number(raw.qty || 1));
    if (raw.kind === "product") {
      const p = await ensureProductLoaded(pMap, raw.id);
      if (!p)
        fail(404, "Ürün bulunamadı: " + raw.id, { productId: raw.id });

      if (!Array.isArray(p.inventory) || p.inventory.length === 0) {
        fail(409, "Ürün için stok kaydı bulunamadı", {
          productId: String(p._id),
        });
      }

      const discount = productDiscountMap.get(String(p._id)) || null;

      const variantInfo = resolveCatalogVariant(p, raw);
      if (variantInfo.status === "missing") {
        fail(400, "Ürün için varyant seçimi gerekli", {
          productId: String(p._id),
        });
      }
      if (variantInfo.status === "invalid") {
        fail(400, "Ürün için bu varyant mevcut değil", {
          productId: String(p._id),
          variant: variantInfo.variant,
        });
      }

      if (
        typeof variantInfo.index === "number" &&
        variantInfo.index >= 0 &&
        variantInfo.key
      ) {
        const pid = String(p._id);
        if (!catalogNeedMap.has(pid)) catalogNeedMap.set(pid, new Map());
        const bucket = catalogNeedMap.get(pid);
        const entry = bucket.get(variantInfo.key) || {
          qty: 0,
          index: variantInfo.index,
          variant: variantInfo.variant,
        };
        entry.qty += qty;
        bucket.set(variantInfo.key, entry);
      }

      const lineId = `line-${orderItems.length}`;
      orderItems.push({
        lineId,
        kind: "product",
        ref: p._id,
        name: p.name,
        unitPrice: roundCurrency(Number(p.price || 0)),
        originalUnitPrice: roundCurrency(Number(p.price || 0)),
        qty,
        image: p.images?.[0]?.url || "",
        selections: [],
        variant: variantInfo.variant,
        pricing: null,
      });
      pricingLines.push(
        buildPricingLineFromProduct({
          product: p,
          qty,
          discount,
          extra: { lineId },
        })
      );
    } else if (raw.kind === "set") {
      const s = sMap.get(String(raw.id));
      if (!s) fail(404, "Set bulunamadı: " + raw.id, { setId: raw.id });

      const rawSelections = Array.isArray(raw.selections)
        ? raw.selections
        : [];
      if (rawSelections.length === 0) {
        fail(400, "Set seçimleri zorunlu");
      }

      const discount = setDiscountMap.get(String(s._id)) || null;

      const normalizedSelections = validateSetSelections(
        s,
        rawSelections
      ).map((selection) => ({
        productId: String(selection.productId),
        color: selection.color ?? null,
        size: selection.size ?? null,
        attribute: selection.attribute ?? null,
        qtyInSet: selection.qtyInSet,
      }));

      const multiplier = qty;
      for (const sel of normalizedSelections) {
        const pid = sel.productId;
        if (!setNeedMap.has(pid)) setNeedMap.set(pid, new Map());
        const vkey = makeVariantKey(sel);
        const current = setNeedMap.get(pid).get(vkey) || 0;
        setNeedMap.get(pid).set(vkey, current + sel.qtyInSet * multiplier);
      }

      const lineId = `line-${orderItems.length}`;
      orderItems.push({
        lineId,
        kind: "set",
        ref: s._id,
        name: s.name,
        unitPrice: roundCurrency(Number(s.price || 0)),
        originalUnitPrice: roundCurrency(Number(s.price || 0)),
        qty,
        image: s.images?.[0]?.url || "",
        selections: normalizedSelections,
        pricing: null,
      });
      pricingLines.push(
        buildPricingLineFromSet({
          setDoc: s,
          qty,
          discount,
          extra: { lineId },
        })
      );
    } else {
      fail(400, "Geçersiz ürün tipi");
    }
  }

  await validateCombinedTrackedStock({
    productMap: pMap,
    productStockMap,
    catalogNeedMap,
    setNeedMap,
  });

  let couponSummary = null;
  let couponContext = null;
  let couponDoc = null;
  const normalizedCoupon = couponCode
    ? normalizeCouponCodeInput(couponCode)
    : null;
  if (normalizedCoupon) {
    const resolvedCoupon = await resolveCouponOrderContext({
      userId,
      couponCode: normalizedCoupon,
    });
    couponContext = resolvedCoupon.context;
    couponDoc = resolvedCoupon.coupon;
  }

  const stackedDiscount = await getStackedDiscountConfig();
  const pricing = calculateCartPricing({
    lines: pricingLines,
    stackedDiscount,
    coupon: couponDoc,
  });

  if (normalizedCoupon && (!pricing.coupon?.applicable || pricing.coupon.discountAmount <= 0)) {
    if (
      Number(pricing.coupon?.eligibleSubtotal || 0) <
      Number(pricing.coupon?.minSubtotal || 0)
    ) {
      fail(400, `Kupon için minimum ara toplam ${pricing.coupon.minSubtotal} olmalı`, {
        reason: "minSubtotal",
        minSubtotal: pricing.coupon.minSubtotal,
        eligibleSubtotal: pricing.coupon.eligibleSubtotal || 0,
      });
    }
    fail(400, "Kupon bu sepet için uygulanamıyor", {
      reason: "notApplicable",
      eligibleSubtotal: pricing.coupon?.eligibleSubtotal || 0,
    });
  }

  const pricedLineMap = new Map(
    (pricing.lines || []).map((line) => [String(line.lineId), line])
  );

  orderItems.forEach((item) => {
    const pricedLine = pricedLineMap.get(String(item.lineId || ""));
    if (!pricedLine) return;
    item.unitPrice = roundCurrency(pricedLine.unitPriceBeforeCoupon);
    item.originalUnitPrice = roundCurrency(pricedLine.baseUnitPrice);
    item.pricing = {
      baseUnitPrice: roundCurrency(pricedLine.baseUnitPrice),
      standard: pricedLine.standardDiscount
        ? {
            discountId: pricedLine.standardDiscount.id || null,
            name: pricedLine.standardDiscount.name || "",
            percentage: pricedLine.standardDiscount.percentage || 0,
            amount: roundCurrency(pricedLine.standardDiscountAmount || 0),
            removedBy: pricedLine.standardDiscountRemovedBy || null,
          }
        : null,
      stacked: pricing.stacked
        ? {
            stackedDiscountId: pricing.stacked.id || null,
            percentage: pricedLine.stackedDiscountApplied
              ? pricedLine.stackedDiscountTier?.percentage || 0
              : 0,
            quantity: pricedLine.stackedDiscountApplied
              ? pricedLine.stackedDiscountTier?.quantity || 0
              : 0,
            amount: roundCurrency(pricedLine.stackedDiscountAmount || 0),
            disabledByCoupon: pricing.stacked.disabledByCoupon === true,
          }
        : null,
      coupon: pricing.coupon?.applicable
        ? {
            code: pricing.coupon.code || null,
            percentage: pricing.coupon.percentage || 0,
            amount: roundCurrency(pricedLine.couponDiscountAmount || 0),
          }
        : null,
    };
    delete item.lineId;
  });

  const subtotal = roundCurrency(Number(pricing.subtotalBeforeCoupon || 0));
  const couponDiscountAmount = roundCurrency(
    Number(pricing.coupon?.discountAmount || 0)
  );

  if (pricing.coupon?.applicable) {
    couponSummary = {
      couponId: couponContext?.couponId || null,
      assignmentId: couponContext?.assignmentId || null,
      code: pricing.coupon.code,
      percentage: pricing.coupon.percentage || 0,
      minSubtotal: pricing.coupon.minSubtotal || 0,
      eligibleSubtotal: pricing.coupon.eligibleSubtotal || 0,
      template: pricing.coupon.template || null,
      audience: pricing.coupon.audience || null,
      discountAmount: couponDiscountAmount,
    };
  }

  const shippingConfig = await ShippingConfig.getSingleton();
  const threshold = Number(shippingConfig?.freeThreshold || 0);
  const feeRaw = Number(shippingConfig?.fee || 0);
  const shipping = subtotal >= threshold ? 0 : Math.max(0, feeRaw);
  const shippingName = shippingConfig?.name || "Standart Kargo";
  const total = roundCurrency(
    Math.max(0, subtotal - couponDiscountAmount) + shipping
  );

  const pricingSummary = {
    baseSubtotal: roundCurrency(Number(pricing.baseSubtotal || 0)),
    standardDiscountAmount: roundCurrency(
      Number(pricing.standardDiscountAmount || 0)
    ),
    stackedDiscountAmount: roundCurrency(
      Number(pricing.stackedDiscountAmount || 0)
    ),
    couponDiscountAmount,
    stacked: pricing.stacked
      ? {
          stackedDiscountId: pricing.stacked.id || null,
          quantity: pricing.stacked.quantity || 0,
          eligibleQuantity: pricing.stacked.eligibleQuantity || 0,
          percentage: pricing.stacked.percentage || 0,
          eligibleSubtotal: pricing.stacked.eligibleSubtotal || 0,
          discountAmount: pricing.stacked.discountAmount || 0,
          allowCouponStacking: pricing.stacked.allowCouponStacking !== false,
          allowDiscountStacking:
            pricing.stacked.allowDiscountStacking !== false,
          disabledByCoupon: pricing.stacked.disabledByCoupon === true,
        }
      : null,
  };

  const summary = {
    items: summarizeOrderItems(orderItems),
    subtotal,
    baseSubtotal: pricingSummary.baseSubtotal,
    standardDiscountAmount: pricingSummary.standardDiscountAmount,
    stackedDiscountAmount: pricingSummary.stackedDiscountAmount,
    shipping,
    shippingName,
    discountAmount: couponDiscountAmount,
    total,
    coupon: couponSummary,
    pricing: pricingSummary,
    currency: PAYMENT_CURRENCY,
  };

  return {
    summary,
    details: {
      userId,
      addressSnap,
      orderItems,
      subtotal,
      shipping,
      shippingName,
      total,
      couponSummary,
      couponContext,
      pricingSummary,
      catalogNeedMap,
      setNeedMap,
      productMap: pMap,
      setMap: sMap,
      productStockMap,
    },
    normalizedItems,
  };
}

async function finalizeOrder(prepared, options = {}) {
  const {
    userId,
    addressSnap,
    orderItems,
    subtotal,
    shipping,
    shippingName,
    total,
    couponSummary,
    couponContext,
    pricingSummary,
    catalogNeedMap,
    setNeedMap,
    productMap,
    productStockMap,
  } = prepared;

  if (!orderItems || orderItems.length === 0) {
    fail(400, "Sepet boş");
  }

  const orderNumber = options.orderNumber || (await createOrderNumber());
  const applyStockDeductions = options.applyStockDeductions !== false;
  const providedStockUsageEntries = Array.isArray(options.stockUsageEntries)
    ? buildOrderStockUsageEntries({
        accounting: { stockUsage: options.stockUsageEntries },
      })
    : [];
  const orderNote =
    typeof options.note === "string" ? options.note.trim() : "";
  const session = options.session || null;

  const stockUsage = new Map();

  if (applyStockDeductions) {
    const requiredProductIds = Array.from(
      new Set([
        ...catalogNeedMap.keys(),
        ...setNeedMap.keys(),
      ].map((id) => String(id || "").trim()).filter(Boolean))
    );
    await hydrateMissingProductStockBuckets(productStockMap, requiredProductIds);
  }

  async function ensureStockBucketForProduct(productId) {
    const pid = String(productId || "").trim();
    if (!pid) return null;

    const existingBucket = productStockMap?.get(pid);
    if (existingBucket?.itemMap instanceof Map) {
      return existingBucket;
    }

    const rowsQuery = StockItem.find({
      ownerModel: "Product",
      owner: pid,
      isActive: true,
    });
    if (session) rowsQuery.session(session);
    const rows = await rowsQuery.lean();

    if (rows.length) {
      const bucket = { items: [], itemMap: new Map() };
      rows.forEach((row) => {
        bucket.items.push(row);
        bucket.itemMap.set(variantKeyOf(row), row);
      });
      productStockMap.set(pid, bucket);
      return bucket;
    }

    const product = productMap?.get(pid) || null;
    const inventory = Array.isArray(product?.inventory) ? product.inventory : [];
    if (!inventory.length) return null;

    const syntheticRows = inventory
      .map((row) => ({
        _id: row?.stockItemId || row?._id || null,
        color: row?.color ?? null,
        size: row?.size ?? null,
        attributeValue: row?.attributeValue ?? row?.attribute ?? null,
        qtyOnHand:
          Number(row?.stockCatalog ?? row?.stock ?? 0) || 0,
      }))
      .filter((row) => row._id);

    if (!syntheticRows.length) return null;

    const bucket = { items: [], itemMap: new Map() };
    syntheticRows.forEach((row) => {
      bucket.items.push(row);
      bucket.itemMap.set(variantKeyOf(row), row);
    });
    productStockMap.set(pid, bucket);
    return bucket;
  }

  async function queueStockUsage(productId, variantKey, amount) {
    const qty = Math.max(0, Math.floor(Number(amount) || 0));
    if (qty <= 0) return;
    const pid = String(productId);
    const key = String(variantKey || "");
    const stockBucket = await ensureStockBucketForProduct(pid);
    if (!stockBucket) {
      fail(400, "Ürün için stok bulunamadı", { productId: pid });
    }
    const stockDoc = stockBucket.itemMap.get(key);
    if (!stockDoc) {
      fail(400, "Ürün için varyant bulunamadı", {
        productId: pid,
        variant: decodeVariantKey(key),
      });
    }
    const stockId = stockDoc._id?.toString?.();
    if (!stockId) {
      fail(500, "Stok kalemi kimliği eksik", { productId: pid });
    }
    const current = stockUsage.get(stockId) || {
      id: stockId,
      productId: pid,
      variantKey: key,
      qty: 0,
      source: "product",
      productName: productMap?.get(pid)?.name || "",
      image: productMap?.get(pid)?.images?.[0]?.url || "",
    };
    current.qty += qty;
    stockUsage.set(stockId, current);
  }

  if (applyStockDeductions) {
    for (const [pid, variants] of catalogNeedMap.entries()) {
      if (!variants.size) continue;
      const pidStr = String(pid);
      for (const [vkey, entry] of variants.entries()) {
        const qty = Number(entry?.qty || 0);
        if (qty <= 0) continue;
        if (entry?.index === undefined || Number(entry.index) < 0) continue;
        await queueStockUsage(pidStr, vkey, qty);
      }
    }

    for (const [pid, variants] of setNeedMap.entries()) {
      if (!variants.size) continue;
      const pidStr = String(pid);
      for (const [vkey, needed] of variants.entries()) {
        const qty = Number(needed || 0);
        if (qty <= 0) continue;
        await queueStockUsage(pidStr, vkey, qty);
        const stockDoc = Array.from(stockUsage.values()).find(
          (usage) => usage.productId === pidStr && usage.variantKey === vkey
        );
        if (stockDoc) stockDoc.source = "set_selection";
      }
    }

    for (const usage of stockUsage.values()) {
      const previousRow =
        productStockMap?.get(usage.productId)?.itemMap?.get(usage.variantKey) || null;
      const query = StockItem.findOneAndUpdate(
        { _id: usage.id, qtyOnHand: { $gte: usage.qty } },
        { $inc: { qtyOnHand: -usage.qty } },
        { new: true }
      );
      if (session) query.session(session);
      const result = await query.lean();

      if (!result) {
        fail(409, "Yetersiz stok", {
          productId: usage.productId,
          variant: decodeVariantKey(usage.variantKey),
          requested: usage.qty,
        });
      }

      const bucket = productStockMap?.get(usage.productId);
      if (bucket) {
        bucket.itemMap.set(usage.variantKey, result);
      }

      const product = productMap?.get(usage.productId) || null;
      await maybeCreateLowStockNotification({
        ownerModel: "Product",
        owner: usage.productId,
        stockItemId: result._id,
        comboKey: result.comboKey,
        color: result.color,
        size: result.size,
        attributeValue: result.attributeValue,
        previousQty: previousRow?.qtyOnHand,
        qtyOnHand: result.qtyOnHand,
        productName: product?.name || "",
        productSlug: product?.slug || "",
        image: product?.images?.[0]?.url || "",
        session,
      });
    }
  }

  const accountingStockUsage = applyStockDeductions
    ? buildStockUsageSnapshot(stockUsage)
    : providedStockUsageEntries;

  let payment;
  let status = options.statusOverride || "pending";

  if (options.paymentOverride) {
    payment = {
      method: options.paymentOverride.method || "online",
      provider: options.paymentOverride.provider || null,
      txnId: options.paymentOverride.txnId || "",
      processorOrderId: options.paymentOverride.processorOrderId || "",
      paidAt: options.paymentOverride.paidAt || null,
      status: options.paymentOverride.status || "pending",
      currency:
        options.paymentOverride.currency ||
        options.currency ||
        PAYMENT_CURRENCY,
      amount: Number(options.paymentOverride.amount || total || 0),
      payer: options.paymentOverride.payer || null,
    };
  } else {
    const method = options.paymentMethod || "online";
    const provider = options.paymentProvider || null;
    const paymentStatus = options.paymentStatus || "pending";
    payment = {
      method,
      provider,
      status: paymentStatus,
      paidAt:
        paymentStatus === "success" ? options.paidAt || new Date() : null,
      currency: options.currency || PAYMENT_CURRENCY,
      amount: total,
    };
    status =
      paymentStatus === "success"
        ? options.statusOverride || "paid"
        : options.statusOverride || "pending";
  }

  const orderPayload = {
    orderNumber,
    user: userId || null,
    customer: {
      fullName:
        String(options.customerSnapshot?.fullName || "").trim() ||
        String(addressSnap?.fullName || "").trim(),
      email: String(options.customerSnapshot?.email || "").trim(),
      phone:
        String(options.customerSnapshot?.phone || "").trim() ||
        String(addressSnap?.phone || "").trim(),
      isGuest: options.customerSnapshot?.isGuest === true || !userId,
    },
    items: orderItems,
    address: addressSnap,
    note: orderNote,
    subtotal,
    shipping,
    shippingName,
    total,
    status,
    payment,
    coupon: couponSummary,
    pricing: pricingSummary,
    accounting: {
      stockApplied: accountingStockUsage.length > 0,
      couponConsumed: Boolean(
        (status === "paid" || payment?.status === "success") &&
          couponContext?.couponId
      ),
      stockUsage: accountingStockUsage,
      accountedAt:
        accountingStockUsage.length > 0 ||
        Boolean(
          (status === "paid" || payment?.status === "success") &&
            couponContext?.couponId
        )
          ? new Date()
          : null,
      revertedAt: null,
    },
  };

  const shouldConsumeCoupon =
    status === "paid" || payment?.status === "success";

  let order = null;
  try {
    order = session
      ? (await Order.create([orderPayload], { session }))[0]
      : await Order.create(orderPayload);

    if (shouldConsumeCoupon && couponContext?.couponId) {
      await consumeCouponAfterSuccess({
        userId,
        couponContext,
        orderId: order._id,
        session,
      });
    }

    await syncOrderPrintJobsSafely(order, { session });

    return order;
  } catch (error) {
    if (!session) {
      try {
        if (order?._id) {
          await rollbackCreatedOrderArtifacts(order._id);
        }
        if (shouldConsumeCoupon && couponContext?.couponId) {
          await restoreCouponAfterReversal({
            userId,
            couponContext,
          });
        }
        if (accountingStockUsage.length) {
          await restoreStockUsageSnapshot(accountingStockUsage);
        }
      } catch (rollbackError) {
        console.error("Failed to rollback order side effects", {
          orderId: order?._id?.toString?.() || "",
          error: rollbackError?.message || rollbackError,
        });
      }
    }
    throw error;
  }
}

/**
 * POST /api/orders
 * Body: {
 *   addressId: string,
 *   items: [{
 *     kind: "product"|"set",
 *     id: "<ObjectId>",
 *     qty: number,
 *     // kind === 'set' için zorunlu:
 *     selections?: [{ productId, color, size, attribute, qtyInSet }]
 *   }],
 *   couponCode?: string
 * }
 * Not: Fiyat güvenliği için backend fiyatı DB'den çeker.
 */
export async function createOrder(req, res) {
  try {
    return res.status(503).json({
      code: "DIRECT_ORDER_CREATION_DISABLED",
      message:
        "Doğrudan sipariş oluşturma kapalı. Checkout akışı Iyzico ödeme oturumu üzerinden ilerlemeli.",
    });
  } catch (err) {
    if (err.status) {
      const payload = { message: err.message || "İstek başarısız" };
      if (err.extra || err.details) payload.details = err.extra || err.details;
      return res.status(err.status).json(payload);
    }
    res.status(500).json({ message: err.message || "Sipariş oluşturulamadı" });
  }
}


function normalizeCode(code) {
  return String(code || "")
    .trim();
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function makeVariantKey(sel) {
  return [
    normalize(sel.color) || "",
    normalize(sel.size) || "",
    normalize(sel.attribute) || "",
  ].join("||");
}

function variantKeyOf(row) {
  return [
    normalize(row?.color) || "",
    normalize(row?.size) || "",
    normalize(row?.attributeValue) || "",
  ].join("||");
}

export {
  buildOrderPreparation,
  buildPreparedStockUsageEntries,
  finalizeOrder,
  reservePreparedStock,
  releaseReservedStock,
  shapeOrder,
  summarizeOrderItems,
  normalizeCode,
  roundCurrency,
  PAYMENT_CURRENCY,
  runInMongoTransaction,
};

function fail(status, message, extra = null) {
  const error = new Error(message);
  error.status = status;
  if (extra && Object.keys(extra || {}).length) {
    error.extra = extra;
  }
  throw error;
}

function sanitizeVariantValue(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function normalizeVariantInput(raw) {
  const variant =
    raw?.variant && typeof raw.variant === "object" ? raw.variant : {};
  return {
    color: sanitizeVariantValue(
      variant.color ??
        variant.colour ??
        raw.color ??
        raw.colour ??
        variant.selectedColor ??
        null
    ),
    size: sanitizeVariantValue(variant.size ?? raw.size ?? null),
    attribute: sanitizeVariantValue(
      variant.attribute ??
        variant.attributeValue ??
        raw.attribute ??
        raw.attributeValue ??
        null
    ),
  };
}

function resolveCatalogVariant(product, rawItem) {
  const inventory = Array.isArray(product?.inventory)
    ? product.inventory
    : [];
  const normalized = normalizeVariantInput(rawItem);
  const hasSelection =
    normalized.color !== null ||
    normalized.size !== null ||
    normalized.attribute !== null;

  if (!inventory.length) {
    return {
      status: "ok",
      variant: normalized,
      index: -1,
      key: hasSelection ? makeVariantKey(normalized) : null,
    };
  }

  const candidateKey = makeVariantKey(normalized);

  if (hasSelection) {
    const idx = inventory.findIndex((row) => variantKeyOf(row) === candidateKey);
    if (idx < 0) {
      return {
        status: "invalid",
        variant: normalized,
        index: -1,
        key: candidateKey,
      };
    }
    const row = inventory[idx];
    return {
      status: "ok",
      variant: {
        color: row?.color ?? normalized.color ?? null,
        size: row?.size ?? normalized.size ?? null,
        attribute: row?.attributeValue ?? normalized.attribute ?? null,
      },
      index: idx,
      key: candidateKey,
    };
  }

  if (inventory.length === 1) {
    const row = inventory[0];
    const variant = {
      color: row?.color ?? null,
      size: row?.size ?? null,
      attribute: row?.attributeValue ?? null,
    };
    return {
      status: "ok",
      variant,
      index: 0,
      key: makeVariantKey(variant),
    };
  }

  const uniqueKeys = Array.from(
    new Set(inventory.map((row) => variantKeyOf(row)))
  ).filter(Boolean);

  if (uniqueKeys.length === 1) {
    const key = uniqueKeys[0];
    const idx = inventory.findIndex((row) => variantKeyOf(row) === key);
    const row = inventory[idx];
    const variant = {
      color: row?.color ?? null,
      size: row?.size ?? null,
      attribute: row?.attributeValue ?? null,
    };
    return { status: "ok", variant, index: idx, key };
  }

  return {
    status: "missing",
    variant: normalized,
    index: -1,
    key: candidateKey,
  };
}

function decodeVariantKey(key) {
  const [color = "", size = "", attribute = ""] = String(key || "")
    .split("||")
    .map((part) => part || "");
  return {
    color: color || null,
    size: size || null,
    attribute: attribute || null,
  };
}

async function ensureProductLoaded(map, id) {
  const key = String(id || "").trim();
  if (!key) return null;
  if (map.has(key)) return map.get(key);

  let product = null;
  if (mongoose.Types.ObjectId.isValid(key)) {
    product = await Product.findById(key).populate("category");
  }
  if (!product) {
    product = await Product.findOne({ slug: key }).populate("category");
  }
  if (product) {
    await hydrateProductsWithInventory([product]);
    const normalizedKey = String(product._id);
    map.set(normalizedKey, product);
    if (normalizedKey !== key) {
      map.set(key, product);
    }
  }
  return product;
}


/** GET /api/orders/mine  */
export async function myOrders(req, res) {
  try {
    const list = await Order.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json({
      orders: list.map((order) => shapeCustomerOrder(order)),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Siparişler alınamadı" });
  }
}

/** GET /api/orders/:id */
export async function getOrder(req, res) {
  try {
    let o = null;
    if (isObjectIdLike(req.params.id)) {
      o = await Order.findOne({ _id: req.params.id, user: req.userId });
    }
    if (!o) {
      o = await Order.findOne({
        orderNumber: req.params.id,
        user: req.userId,
      });
    }
    if (!o) return res.status(404).json({ message: "Sipariş bulunamadı" });
    res.json({ order: shapeCustomerOrder(o) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Siparişler alınamadı" });
  }
}

/** GET /api/orders/track/:idOrNumber?email=<customer-email>
 *
 * Public sipariş takibi. Sipariş numarası veya ID yanı sıra müşteri emaili
 * zorunludur; eşleşmezse 404 döner (sipariş varlığı ifşa edilmez).
 * Response `shapePublicOrder` ile maskelenmiş gelir.
 */
export async function trackOrder(req, res) {
  try {
    const emailParam = String(req.query.email || "").trim().toLowerCase();
    if (!emailParam) {
      return res
        .status(400)
        .json({ message: "Sipariş takibi için e-posta adresi gerekli" });
    }

    const order = await findOrderByIdOrNumber(req.params.idOrNumber);
    if (!order) return res.status(404).json({ message: "Sipariş bulunamadı" });

    // Siparişin kayıtlı email adresiyle karşılaştır (customer snapshot → payer).
    const orderEmail = String(
      order.customer?.email ||
        order.payment?.payer?.email ||
        ""
    )
      .trim()
      .toLowerCase();

    if (!orderEmail || emailParam !== orderEmail) {
      // Email eşleşmediğinde sipariş varlığını gizlemek için 404 kullanılır.
      return res.status(404).json({ message: "Sipariş bulunamadı" });
    }

    res.json({ order: shapePublicOrder(order) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Siparişler alınamadı" });
  }
}

/** Admin: GET /api/orders */
export async function listOrders(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.status = String(req.query.status).toLowerCase();
    }
    if (req.query.user && mongoose.Types.ObjectId.isValid(req.query.user)) {
      filter.user = req.query.user;
    }
    if (req.query.q) {
      const q = String(req.query.q).trim();
      if (q) {
        const sanitized = q.replace(/[^a-zA-Z0-9]/g, "");
        const pattern = sanitized.split("").join("[-\\s]*");
        filter.orderNumber = {
          $regex: pattern || q,
          $options: "i",
        };
      }
    }

    const [items, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .populate("user", "firstName lastName email phone")
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);
    const printJobMap = await getLatestPrintJobMap(
      items.map((order) => order._id?.toString?.())
    );

    res.json({
      orders: items.map((order) =>
        shapeOrder(order, printJobMap.get(order._id?.toString?.()))
      ),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Siparişler listelenemedi" });
  }
}

function isObjectIdLike(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function findOrderByIdOrNumber(idOrNumber, session = null) {
  if (isObjectIdLike(idOrNumber)) {
    const byIdQuery = Order.findById(idOrNumber);
    if (session) byIdQuery.session(session);
    const byId = await byIdQuery;
    if (byId) return byId;
  }
  const byNumberQuery = Order.findOne({ orderNumber: idOrNumber });
  if (session) byNumberQuery.session(session);
  return byNumberQuery;
}

/** Admin: GET /api/orders/:id */
export async function adminGetOrder(req, res) {
  try {
    let order = null;
    if (isObjectIdLike(req.params.id)) {
      order = await Order.findById(req.params.id).populate(
        "user",
        "firstName lastName email phone"
      );
    }
    if (!order) {
      order = await Order.findOne({
        orderNumber: req.params.id,
      }).populate("user", "firstName lastName email phone");
    }
    if (!order) return res.status(404).json({ message: "Sipariş bulunamadı" });
    const printJob = await findLatestPrintJobForOrder(order._id);
    res.json({ order: shapeOrder(order, printJob) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Sipariş alınamadı" });
  }
}

/** Admin: PATCH /api/orders/:id/status */
export async function updateOrderStatus(req, res) {
  try {
    const { status, paymentMethod, paymentTxnId, markPaid } = req.body || {};
    const updateResult = await runInMongoTransaction(async (session, tx) => {
      const order = await findOrderByIdOrNumber(req.params.id, session);
      if (!order) {
        fail(404, "Sipariş bulunamadı");
      }

      const rollbackSteps = [];
      const accountingState = deriveOrderAccountingState(order);
      const previousStatus = String(order.status || "").toLowerCase();
      const nextStatusRaw =
        status !== undefined ? String(status).toLowerCase() : undefined;

      if (nextStatusRaw !== undefined) {
        const allowed = ["pending", "paid", "shipped", "completed", "cancelled"];
        if (!allowed.includes(nextStatusRaw)) {
          fail(400, "Geçersiz durum");
        }
        order.status = nextStatusRaw;
      }

      if (paymentMethod !== undefined) {
        order.payment.method = String(paymentMethod) || "online";
      }

      if (paymentTxnId !== undefined) {
        order.payment.txnId = String(paymentTxnId);
      }

      const markPaidBool = toBoolean(markPaid);

      if (markPaidBool === true || nextStatusRaw === "paid") {
        order.payment.paidAt = order.payment.paidAt || new Date();
        order.payment.status = "success";
      }
      if (markPaidBool === false) {
        order.payment.paidAt = null;
        order.payment.status = "pending";
      }

      const nextShouldApplyAccounting = shouldOrderHaveAccountingEffects(order);
      const stockEntries = buildOrderStockUsageEntries(order);
      const couponContext = buildOrderCouponContext(order);
      const orderUserId = order.user?._id?.toString?.() || order.user?.toString?.() || order.user;

      let nextStockApplied = accountingState.stockApplied;
      let nextCouponConsumed = accountingState.couponConsumed;

      const registerRollback = (callback) => {
        if (tx?.atomic === false && typeof callback === "function") {
          rollbackSteps.push(callback);
        }
      };

      try {
        if (nextShouldApplyAccounting && !accountingState.stockApplied) {
          const stockResult = await applyOrderStockAccounting(order, {
            session,
            stockEntries,
          });
          nextStockApplied = stockResult.applied;
          registerRollback(async () => {
            if (stockResult.stockEntries.length) {
              await restoreStockUsageSnapshot(stockResult.stockEntries);
            }
          });
        }

        if (!nextShouldApplyAccounting && accountingState.stockApplied) {
          await restoreStockUsageSnapshot(stockEntries, session);
          nextStockApplied = false;
          registerRollback(async () => {
            if (stockEntries.length) {
              await applyOrderStockAccounting(order, { stockEntries });
            }
          });
        }

        if (
          nextShouldApplyAccounting &&
          couponContext?.couponId &&
          !accountingState.couponConsumed
        ) {
          await consumeCouponAfterSuccess({
            userId: orderUserId,
            couponContext,
            orderId: order._id,
            session,
          });
          nextCouponConsumed = true;
          registerRollback(async () => {
            await restoreCouponAfterReversal({
              userId: orderUserId,
              couponContext,
            });
          });
        }

        if (
          !nextShouldApplyAccounting &&
          couponContext?.couponId &&
          accountingState.couponConsumed
        ) {
          await restoreCouponAfterReversal({
            userId: orderUserId,
            couponContext,
            session,
          });
          nextCouponConsumed = false;
          registerRollback(async () => {
            await consumeCouponAfterSuccess({
              userId: orderUserId,
              couponContext,
              orderId: order._id,
            });
          });
        }

        setOrderAccounting(order, {
          stockApplied: nextStockApplied,
          couponConsumed: nextCouponConsumed,
          stockUsage: stockEntries,
          accountedAt: nextShouldApplyAccounting
            ? accountingState.accountedAt || order.payment?.paidAt || new Date()
            : accountingState.accountedAt || null,
          revertedAt:
            !nextShouldApplyAccounting &&
            (accountingState.stockApplied || accountingState.couponConsumed)
              ? new Date()
              : order.accounting?.revertedAt || null,
        });

        if (session) {
          order.$session(session);
        }
        await order.save();
      } catch (error) {
        if (tx?.atomic === false) {
          for (let index = rollbackSteps.length - 1; index >= 0; index -= 1) {
            try {
              await rollbackSteps[index]();
            } catch (rollbackError) {
              console.error("Failed to rollback order status side effects", {
                orderId: order._id?.toString?.() || "",
                error: rollbackError?.message || rollbackError,
              });
            }
          }
        }
        throw error;
      }

      await syncOrderPrintJobsSafely(order, { session });
      return {
        orderId: order._id?.toString?.() || "",
        shouldSendShippedEmail:
          previousStatus !== "shipped" &&
          String(order.status || "").toLowerCase() === "shipped",
      };
    });

    const order = await Order.findById(updateResult?.orderId || "").populate(
      "user",
      "firstName lastName email phone"
    );
    if (!order) return res.status(404).json({ message: "Sipariş bulunamadı" });

    if (updateResult?.shouldSendShippedEmail) {
      await Promise.allSettled([
        sendOrderShippedEmail({
          order,
          user:
            order.user && typeof order.user === "object" ? order.user : null,
        }),
      ]);
    }

    const printJob = await findLatestPrintJobForOrder(order._id);
    res.json({ order: shapeOrder(order, printJob) });
  } catch (error) {
    if (error?.status) {
      const payload = { message: error.message || "Sipariş güncellenemedi" };
      if (error.extra || error.details) {
        payload.details = error.extra || error.details;
      }
      return res.status(error.status).json(payload);
    }
    res.status(500).json({ message: error.message || "Sipariş güncellenemedi" });
  }
}
