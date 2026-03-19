function toId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id?.toString) return value._id.toString();
    if (value.id?.toString) return value.id.toString();
  }
  return null;
}

export function collectProductCategoryIds(product) {
  const ids = new Set();
  if (!product) return [];

  const category = product.category;
  const mainCategoryId = toId(category);
  if (mainCategoryId) ids.add(mainCategoryId);

  const ancestors = Array.isArray(category?.ancestors) ? category.ancestors : [];
  ancestors.forEach((ancestor) => {
    const ancestorId = toId(ancestor);
    if (ancestorId) ids.add(ancestorId);
  });

  return Array.from(ids);
}

export function buildPricingLineFromProduct({
  product,
  qty = 1,
  discount = null,
  extra = {},
} = {}) {
  if (!product?._id) return null;
  return {
    ...extra,
    kind: "product",
    ref: product._id?.toString?.() || String(product._id),
    qty: Math.max(1, Number(qty || 1) || 1),
    baseUnitPrice: Number(product.price || 0) || 0,
    standardDiscount: discount || null,
    categoryIds: collectProductCategoryIds(product),
  };
}

export function buildPricingLineFromSet({
  setDoc,
  qty = 1,
  discount = null,
  extra = {},
} = {}) {
  if (!setDoc?._id) return null;
  return {
    ...extra,
    kind: "set",
    ref: setDoc._id?.toString?.() || String(setDoc._id),
    qty: Math.max(1, Number(qty || 1) || 1),
    baseUnitPrice: Number(setDoc.price || 0) || 0,
    standardDiscount: discount || null,
    categoryIds: [],
  };
}

