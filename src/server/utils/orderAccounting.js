function toLower(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeVariantValue(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function makeStockUsageKey(productId, variant) {
  return [
    String(productId || "").trim(),
    normalizeVariantValue(variant?.color) || "",
    normalizeVariantValue(variant?.size) || "",
    normalizeVariantValue(variant?.attribute) || "",
  ].join("::");
}

export function shouldOrderHaveAccountingEffects(order = {}) {
  const paymentStatus = toLower(order?.payment?.status);
  const orderStatus = toLower(order?.status);
  if (paymentStatus !== "success") return false;
  return !["cancelled", "failed"].includes(orderStatus);
}

export function deriveOrderAccountingState(order = {}) {
  const explicit =
    order?.accounting && typeof order.accounting === "object"
      ? order.accounting
      : {};
  const paymentSimulation = toLower(order?.payment?.simulation);
  const shouldApply = shouldOrderHaveAccountingEffects(order);
  const hasCoupon = Boolean(order?.coupon?.couponId || order?.coupon?.code);

  const stockApplied =
    typeof explicit.stockApplied === "boolean"
      ? explicit.stockApplied
      : paymentSimulation === "success"
      ? true
      : paymentSimulation === "failure"
      ? false
      : shouldApply;

  const couponConsumed =
    typeof explicit.couponConsumed === "boolean"
      ? explicit.couponConsumed
      : hasCoupon
      ? paymentSimulation === "success"
        ? true
        : paymentSimulation === "failure"
        ? false
        : shouldApply
      : false;

  return {
    stockApplied,
    couponConsumed,
    accountedAt: explicit.accountedAt || null,
    revertedAt: explicit.revertedAt || null,
  };
}

export function buildOrderCouponContext(order = {}) {
  const coupon = order?.coupon && typeof order.coupon === "object" ? order.coupon : null;
  if (!coupon?.couponId && !coupon?.code) return null;
  return {
    couponId: coupon?.couponId?.toString?.() || coupon?.couponId || null,
    assignmentId:
      coupon?.assignmentId?.toString?.() || coupon?.assignmentId || null,
    code: coupon?.code || "",
    audience: coupon?.audience || "public",
    maxUsesPerUser: 1,
  };
}

function addUsageEntry(targetMap, entry) {
  const productId = String(entry?.productId || "").trim();
  if (!productId) return;

  const variant = {
    color: normalizeVariantValue(entry?.color),
    size: normalizeVariantValue(entry?.size),
    attribute: normalizeVariantValue(entry?.attribute),
  };
  const qty = Math.max(1, Math.floor(Number(entry?.qty || 0) || 0));
  if (qty <= 0) return;

  const key = makeStockUsageKey(productId, variant);
  const current = targetMap.get(key) || {
    productId,
    variant,
    qty: 0,
    source: entry?.source || "product",
    productName: entry?.productName || "",
    image: entry?.image || "",
  };
  current.qty += qty;
  current.source = current.source || entry?.source || "product";
  if (!current.productName && entry?.productName) current.productName = entry.productName;
  if (!current.image && entry?.image) current.image = entry.image;
  targetMap.set(key, current);
}

export function buildOrderStockUsageEntries(order = {}) {
  const explicitUsage = Array.isArray(order?.accounting?.stockUsage)
    ? order.accounting.stockUsage
    : [];
  const entries = new Map();

  if (explicitUsage.length) {
    explicitUsage.forEach((entry) => {
      addUsageEntry(entries, {
        productId: entry?.productId,
        color: entry?.color,
        size: entry?.size,
        attribute: entry?.attribute,
        qty: entry?.qty,
        source: entry?.source || "product",
        productName: entry?.productName || "",
        image: entry?.image || "",
      });
    });
    return Array.from(entries.values());
  }

  const items = Array.isArray(order?.items) ? order.items : [];
  items.forEach((item) => {
    const qty = Math.max(1, Math.floor(Number(item?.qty || 0) || 0));
    if (qty <= 0) return;

    if (String(item?.kind || "product").toLowerCase() === "set") {
      const selections = Array.isArray(item?.selections) ? item.selections : [];
      selections.forEach((selection) => {
        addUsageEntry(entries, {
          productId: selection?.productId,
          color: selection?.color,
          size: selection?.size,
          attribute: selection?.attribute,
          qty: Math.max(1, Number(selection?.qtyInSet || 1) || 1) * qty,
          source: "set_selection",
        });
      });
      return;
    }

    addUsageEntry(entries, {
      productId: item?.ref,
      color: item?.variant?.color,
      size: item?.variant?.size,
      attribute: item?.variant?.attribute,
      qty,
      source: "product",
      productName: item?.name || "",
      image: item?.image || "",
    });
  });

  return Array.from(entries.values());
}
