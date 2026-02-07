import mongoose from "mongoose";
import Order from "../models/Order.js";
import UserDetails from "../models/UserDetails.js";
import Product from "../models/Product.js";
import Set from "../models/Set.js";
import ShippingConfig from "../models/ShippingConfig.js";
import Coupon from "../models/Coupon.js";
import StockItem from "../models/StockItem.js";
import {
  fetchActiveDiscounts,
  computeProductDiscountMap,
  mapDiscountsToSets,
  applyDiscount,
} from "../utils/discountHelpers.js";
import { hydrateProductsWithInventory } from "../utils/stockItemHelpers.js";

const PAYPAL_CURRENCY = (process.env.PAYPAL_CURRENCY || "TRY").toUpperCase();
const PAYPAL_ORDER_TTL_MINUTES = Math.max(
  5,
  Number(process.env.PAYPAL_ORDER_TTL_MINUTES || 30)
);

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

// normalize helpers
function normalize(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.toLowerCase() : null;
}

function shapeOrder(doc) {
  if (!doc) return null;
  const rawUser = doc.user;
  const populatedUser =
    rawUser && typeof rawUser === "object" && "_id" in rawUser ? rawUser : null;
  const userId = populatedUser
    ? populatedUser._id.toString()
    : rawUser?.toString?.() || rawUser;
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
    items: doc.items.map((i) => ({
      kind: i.kind,
      ref: i.ref?.toString?.() || i.ref,
      name: i.name,
      unitPrice: i.unitPrice,
      qty: i.qty,
      image: i.image || "",
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
    subtotal: doc.subtotal,
    shipping: doc.shipping,
    shippingName: doc.shippingName || "Standart Kargo",
    total: doc.total,
    coupon: doc.coupon?.code
      ? {
          code: doc.coupon.code,
          percentage: doc.coupon.percentage,
          discountAmount: doc.coupon.discountAmount,
          minSubtotal: doc.coupon.minSubtotal,
        }
      : null,
    status: doc.status,
    payment: doc.payment,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
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
      ? Set.find({ _id: { $in: setIds } }).populate("products.product")
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
  const catalogNeedMap = new Map();
  const setNeedMap = new Map();

  for (const raw of normalizedItems) {
    const qty = Math.max(1, Number(raw.qty || 1));
    if (raw.kind === "product") {
      const p = await ensureProductLoaded(pMap, raw.id);
      if (!p)
        fail(404, "Ürün bulunamadı: " + raw.id, { productId: raw.id });

      const discount = productDiscountMap.get(String(p._id)) || null;
      const { finalPrice } = applyDiscount(Number(p.price || 0), discount);
      const safePrice = roundCurrency(finalPrice);

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

      orderItems.push({
        kind: "product",
        ref: p._id,
        name: p.name,
        unitPrice: safePrice,
        qty,
        image: p.images?.[0]?.url || "",
        selections: [],
        variant: variantInfo.variant,
      });
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
      const { finalPrice } = applyDiscount(Number(s.price || 0), discount);
      const safePrice = roundCurrency(finalPrice);

      const normalizedSelections = rawSelections.map((sel) => ({
        productId: String(sel.productId),
        color: sel.color ?? null,
        size: sel.size ?? null,
        attribute: sel.attribute ?? null,
        qtyInSet: Math.max(1, Number(sel.qtyInSet || 1)),
      }));

      const multiplier = qty;
      for (const sel of normalizedSelections) {
        const pid = sel.productId;
        if (!setNeedMap.has(pid)) setNeedMap.set(pid, new Map());
        const vkey = makeVariantKey(sel);
        const current = setNeedMap.get(pid).get(vkey) || 0;
        setNeedMap.get(pid).set(vkey, current + sel.qtyInSet * multiplier);
      }

      orderItems.push({
        kind: "set",
        ref: s._id,
        name: s.name,
        unitPrice: safePrice,
        qty,
        image: s.images?.[0]?.url || "",
        selections: normalizedSelections,
      });
    } else {
      fail(400, "Geçersiz ürün tipi");
    }
  }

  for (const [pid, variants] of setNeedMap.entries()) {
    const prod = await ensureProductLoaded(pMap, pid);
    if (!prod) {
      fail(400, "Seçim ürünü eksik: " + pid, { productId: pid });
    }
    const inv = Array.isArray(prod.inventory) ? prod.inventory : [];
    for (const [vkey, needed] of variants.entries()) {
      const idx = inv.findIndex((row) => variantKeyOf(row) === vkey);
      const row = idx >= 0 ? inv[idx] : null;
      const available = getInventoryStock(row, "set");
      if (available < needed) {
        fail(400, "Seçim için yetersiz stok", {
          productId: pid,
          variant: decodeVariantKey(vkey),
          needed,
          available,
        });
      }
    }
  }

  for (const [pid, variants] of catalogNeedMap.entries()) {
    const prod = await ensureProductLoaded(pMap, pid);
    if (!prod) {
      fail(400, "Katalog stoku için ürün bulunamadı: " + pid, {
        productId: pid,
      });
    }
    const inv = Array.isArray(prod.inventory) ? prod.inventory : [];
    for (const [vkey, entry] of variants.entries()) {
      if (entry.index < 0) continue;
      const row =
        inv[entry.index] ||
        inv.find((candidate) => variantKeyOf(candidate) === vkey);
      if (!row) {
        fail(400, "Ürün için varyant bulunamadı", {
          productId: pid,
          variant: decodeVariantKey(vkey),
        });
      }
      const available = getInventoryStock(row, "catalog");
      if (available < entry.qty) {
        fail(400, "Ürün için yeterli stok yok", {
          productId: pid,
          variant: decodeVariantKey(vkey),
          needed: entry.qty,
          available,
        });
      }
    }
  }

  const subtotal = roundCurrency(
    orderItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
  );

  const shippingConfig = await ShippingConfig.getSingleton();
  const threshold = Number(shippingConfig?.freeThreshold || 0);
  const feeRaw = Number(shippingConfig?.fee || 0);
  const shipping = subtotal >= threshold ? 0 : Math.max(0, feeRaw);
  const shippingName = shippingConfig?.name || "Standart Kargo";

  let couponSummary = null;
  let couponDiscountAmount = 0;
  const normalizedCoupon = couponCode ? normalizeCode(couponCode) : null;
  if (normalizedCoupon) {
    const now = new Date();
    const coupon = await Coupon.findOne({
      code: normalizedCoupon,
      active: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    }).lean();

    if (!coupon) {
      fail(400, "Kupon bulunamadı veya pasif", { code: normalizedCoupon });
    }

    if (subtotal < (coupon.minSubtotal || 0)) {
      fail(400, "Kupon için minimum ara toplam " + coupon.minSubtotal, {
        reason: "minSubtotal",
        minSubtotal: coupon.minSubtotal,
      });
    }

    couponDiscountAmount = roundCurrency(
      (subtotal * Number(coupon.percentage || 0)) / 100
    );
    couponSummary = {
      code: coupon.code,
      percentage: coupon.percentage,
      minSubtotal: coupon.minSubtotal || 0,
      discountAmount: couponDiscountAmount,
    };
  }

  const discountedSubtotal = Math.max(0, subtotal - couponDiscountAmount);
  const total = roundCurrency(discountedSubtotal + shipping);

  const summary = {
    items: summarizeOrderItems(orderItems),
    subtotal,
    shipping,
    shippingName,
    discountAmount: couponDiscountAmount,
    total,
    coupon: couponSummary,
    currency: PAYPAL_CURRENCY,
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
      catalogNeedMap,
      setNeedMap,
      productMap: pMap,
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
    catalogNeedMap,
    setNeedMap,
    productMap,
    productStockMap,
  } = prepared;

  if (!orderItems || orderItems.length === 0) {
    fail(400, "Sepet boş");
  }

  const orderNumber = options.orderNumber || (await createOrderNumber());

  const stockUsage = new Map();

  function queueStockUsage(productId, variantKey, amount) {
    const qty = Math.max(0, Math.floor(Number(amount) || 0));
    if (qty <= 0) return;
    const pid = String(productId);
    const key = String(variantKey || "");
    const stockBucket = productStockMap?.get(pid);
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
    };
    current.qty += qty;
    stockUsage.set(stockId, current);
  }

  for (const [pid, variants] of catalogNeedMap.entries()) {
    if (!variants.size) continue;
    const pidStr = String(pid);
    for (const [vkey, entry] of variants.entries()) {
      const qty = Number(entry?.qty || 0);
      if (qty <= 0) continue;
      if (entry?.index === undefined || Number(entry.index) < 0) continue;
      queueStockUsage(pidStr, vkey, qty);
    }
  }

  for (const [pid, variants] of setNeedMap.entries()) {
    if (!variants.size) continue;
    const pidStr = String(pid);
    for (const [vkey, needed] of variants.entries()) {
      const qty = Number(needed || 0);
      if (qty <= 0) continue;
      queueStockUsage(pidStr, vkey, qty);
    }
  }

  for (const usage of stockUsage.values()) {
    const result = await StockItem.findOneAndUpdate(
      { _id: usage.id, qtyOnHand: { $gte: usage.qty } },
      { $inc: { qtyOnHand: -usage.qty } },
      { new: true }
    ).lean();

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
  }


  let payment;
  let status = options.statusOverride || "pending";

  if (options.paymentOverride) {
    payment = {
      method: options.paymentOverride.method || "paypal",
      txnId: options.paymentOverride.txnId || "",
      processorOrderId: options.paymentOverride.processorOrderId || "",
      paidAt: options.paymentOverride.paidAt || null,
      status: options.paymentOverride.status || "pending",
      simulation:
        options.paymentOverride.simulation !== undefined
          ? options.paymentOverride.simulation
          : null,
      currency:
        options.paymentOverride.currency ||
        options.currency ||
        PAYPAL_CURRENCY,
      amount: Number(options.paymentOverride.amount || total || 0),
      payer: options.paymentOverride.payer || null,
    };
  } else {
    const simulation = options.simulation || null;
    const method = options.paymentMethod || "cod";
    if (simulation === "success") {
      payment = {
        method,
        status: "success",
        simulation: "success",
        paidAt: new Date(),
        currency: options.currency || PAYPAL_CURRENCY,
        amount: total,
      };
      status = "paid";
    } else {
      payment = {
        method,
        status: "pending",
        simulation,
        currency: options.currency || PAYPAL_CURRENCY,
        amount: total,
      };
    }
  }

  const order = await Order.create({
    orderNumber,
    user: userId,
    items: orderItems,
    address: addressSnap,
    subtotal,
    shipping,
    shippingName,
    total,
    status,
    payment,
    coupon: couponSummary,
  });

  return order;
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
    const userId = req.userId;
    const {
      addressId,
      items = [],
      couponCode = null,
    } = req.body || {};

    const { details } = await buildOrderPreparation({
      userId,
      addressId,
      items,
      couponCode,
    });

    const order = await finalizeOrder(details, {
      userId,
      currency: PAYPAL_CURRENCY,
    });

    res.status(201).json({ order: shapeOrder(order) });
  } catch (err) {
    if (err.status) {
      const payload = { message: err.message || "İstek başarısız" };
      if (err.extra) payload.details = err.extra;
      return res.status(err.status).json(payload);
    }
    res.status(500).json({ message: err.message || "Sipariş oluşturulamadı" });
  }
}


function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase();
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
  finalizeOrder,
  shapeOrder,
  summarizeOrderItems,
  normalizeCode,
  roundCurrency,
  PAYPAL_CURRENCY,
  PAYPAL_ORDER_TTL_MINUTES,
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

function getInventoryStock(row, pool = "catalog") {
  if (!row) return 0;
  if (pool === "set") {
    if (typeof row?.stockSet === "number") return Number(row.stockSet) || 0;
  } else {
    if (typeof row?.stockCatalog === "number")
      return Number(row.stockCatalog) || 0;
  }
  if (typeof row?.stock === "number") return Number(row.stock) || 0;
  return 0;
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
    res.json({ orders: list.map(shapeOrder) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Siparişler alınamadı" });
  }
}

/** GET /api/orders/:id */
export async function getOrder(req, res) {
  try {
    const o = await Order.findOne({ _id: req.params.id, user: req.userId });
    if (!o) return res.status(404).json({ message: "Sipariş bulunamadı" });
    res.json({ order: shapeOrder(o) });
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

    res.json({
      orders: items.map(shapeOrder),
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

async function findOrderByIdOrNumber(idOrNumber) {
  if (isObjectIdLike(idOrNumber)) {
    const byId = await Order.findById(idOrNumber);
    if (byId) return byId;
  }
  return Order.findOne({ orderNumber: idOrNumber });
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
    res.json({ order: shapeOrder(order) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Sipariş alınamadı" });
  }
}

/** Admin: PATCH /api/orders/:id/status */
export async function updateOrderStatus(req, res) {
  try {
    const order = await findOrderByIdOrNumber(req.params.id);
    if (!order) return res.status(404).json({ message: "Sipariş bulunamadı" });

    const { status, paymentMethod, paymentTxnId, markPaid } = req.body || {};

    if (status !== undefined) {
      const allowed = ["pending", "paid", "shipped", "completed", "cancelled"];
      const nextStatus = String(status).toLowerCase();
      if (!allowed.includes(nextStatus)) {
        return res.status(400).json({ message: "Geçersiz durum" });
      }
      order.status = nextStatus;
    }

    if (paymentMethod !== undefined) {
      order.payment.method = String(paymentMethod) || "cod";
    }

    if (paymentTxnId !== undefined) {
      order.payment.txnId = String(paymentTxnId);
    }

    const markPaidBool = toBoolean(markPaid);

    if (markPaidBool === true || status === "paid") {
      order.payment.paidAt = order.payment.paidAt || new Date();
      order.payment.status = "success";
    }
    if (markPaidBool === false) {
      order.payment.paidAt = null;
      order.payment.status = "pending";
    }

    await order.save();
    res.json({ order: shapeOrder(order) });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Sipariş güncellenemedi" });
  }
}
