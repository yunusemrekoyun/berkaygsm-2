import mongoose from "mongoose";
import Discount from "../models/Discount.js";

function isDiscountActive(discount) {
  const now = Date.now();
  if (!discount.active) return false;
  if (discount.startsAt && new Date(discount.startsAt).getTime() > now) return false;
  if (discount.endsAt && new Date(discount.endsAt).getTime() < now) return false;
  return true;
}

export async function fetchActiveDiscounts() {
  const discounts = await Discount.find({ active: true }).lean();
  return discounts.filter(isDiscountActive);
}

export function mapDiscountsToProducts(discounts, productContexts) {
  const result = new Map();
  const productIdSet = new Set(Object.keys(productContexts));

  discounts.forEach((discount) => {
    const { products = [], categories = [] } = discount.appliesTo || {};
    const productIds = new Set((products || []).map((id) => id.toString()));
    const categoryIds = new Set((categories || []).map((id) => id.toString()));

    productIdSet.forEach((productId) => {
      const context = productContexts[productId];
      if (!context) return;
      const matchesProduct = productIds.has(productId);
      const matchesCategory = context.categories?.some((id) => categoryIds.has(id));
      if (!matchesProduct && !matchesCategory) return;

      const current = result.get(productId);
      if (!current || discount.percentage > current.percentage) {
        result.set(productId, {
          id: discount._id.toString(),
          name: discount.name,
          percentage: discount.percentage,
          description: discount.description || "",
          allowCouponStacking: discount.allowCouponStacking !== false,
          allowStackedDiscountStacking:
            discount.allowStackedDiscountStacking !== false,
        });
      }
    });
  });

  return result;
}

function toId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === "object") {
    if (value._id) return value._id.toString();
    if (value.id) return value.id.toString();
  }
  return null;
}

function collectCategoryIdsFromProduct(doc) {
  const ids = new Set();
  if (!doc) return ids;
  const raw = doc.category;
  const mainId = toId(raw);
  if (mainId) ids.add(mainId);

  if (raw && typeof raw === "object") {
    const ancestors = raw.ancestors || raw.ancestorIds || raw.path || [];
    if (Array.isArray(ancestors)) {
      ancestors.forEach((entry) => {
        const ancestorId = toId(entry);
        if (ancestorId) ids.add(ancestorId);
      });
    }
  }

  return ids;
}

export function buildProductContexts(products = []) {
  const map = {};
  products.forEach((product) => {
    const id = toId(product?._id ?? product?.id ?? product);
    if (!id) return;
    const categories = Array.from(collectCategoryIdsFromProduct(product));
    map[id] = { categories };
  });
  return map;
}

export function computeProductDiscountMap(discounts, products = []) {
  if (!discounts?.length || !products?.length) return new Map();
  const contexts = buildProductContexts(products);
  if (!Object.keys(contexts).length) return new Map();
  return mapDiscountsToProducts(discounts, contexts);
}

export function mapDiscountsToSets(discounts, setIds) {
  const result = new Map();
  const setIdSet = new Set(setIds.map((id) => id.toString()));

  discounts.forEach((discount) => {
    const { sets = [] } = discount.appliesTo || {};
    const setTargets = new Set((sets || []).map((id) => id.toString()));
    setIdSet.forEach((setId) => {
      if (!setTargets.has(setId)) return;
      const current = result.get(setId);
      if (!current || discount.percentage > current.percentage) {
        result.set(setId, {
          id: discount._id.toString(),
          name: discount.name,
          percentage: discount.percentage,
          description: discount.description || "",
          allowCouponStacking: discount.allowCouponStacking !== false,
          allowStackedDiscountStacking:
            discount.allowStackedDiscountStacking !== false,
        });
      }
    });
  });

  return result;
}

export function applyDiscount(price, discount) {
  if (!discount) return {
    finalPrice: price,
    discount: null,
  };
  const final = Math.max(0, price - (price * discount.percentage) / 100);
  return {
    finalPrice: Math.round(final * 100) / 100,
    discount,
  };
}
