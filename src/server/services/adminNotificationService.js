import mongoose from "mongoose";
import Product from "../models/Product.js";
import AdminNotification from "../models/AdminNotification.js";

export const LOW_STOCK_THRESHOLD = 3;

function applySession(query, session) {
  if (session) query.session(session);
  return query;
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function buildVariantLabel({ color, size, attributeValue }) {
  return [cleanText(color), cleanText(size), cleanText(attributeValue)]
    .filter(Boolean)
    .join(" / ");
}

async function resolveProductSnapshot({
  owner,
  productName,
  productSlug,
  image,
  session,
}) {
  const snapshot = {
    productName: cleanText(productName),
    productSlug: cleanText(productSlug),
    image: cleanText(image),
  };
  if (snapshot.productName && snapshot.productSlug) return snapshot;
  if (!mongoose.Types.ObjectId.isValid(String(owner || ""))) return snapshot;

  const query = Product.findById(owner).select("name slug images");
  const product = await applySession(query, session).lean();
  if (!product) return snapshot;

  return {
    productName: snapshot.productName || cleanText(product.name) || "Ürün",
    productSlug: snapshot.productSlug || cleanText(product.slug),
    image:
      snapshot.image ||
      cleanText(product?.images?.[0]?.url || product?.mainImage || ""),
  };
}

export async function maybeCreateLowStockNotification({
  ownerModel,
  owner,
  stockItemId = null,
  comboKey = "",
  color = null,
  size = null,
  attributeValue = null,
  previousQty,
  qtyOnHand,
  productName = "",
  productSlug = "",
  image = "",
  threshold = LOW_STOCK_THRESHOLD,
  session = null,
}) {
  const previous = asNumber(previousQty, NaN);
  const next = Math.max(0, asNumber(qtyOnHand, 0));

  if (ownerModel !== "Product") return null;
  if (!Number.isFinite(previous) || previous <= threshold || next > threshold) {
    return null;
  }

  const ownerId = String(owner || "").trim();
  if (!mongoose.Types.ObjectId.isValid(ownerId)) return null;

  const normalizedComboKey = cleanText(comboKey);
  const existingQuery = AdminNotification.findOne({
    type: "low_stock",
    ownerModel: "Product",
    owner: ownerId,
    comboKey: normalizedComboKey,
    readAt: null,
  });
  const existing = await applySession(existingQuery, session).lean();
  if (existing) return existing;

  const snapshot = await resolveProductSnapshot({
    owner: ownerId,
    productName,
    productSlug,
    image,
    session,
  });
  const variantLabel = buildVariantLabel({ color, size, attributeValue });
  const productLabel = snapshot.productName || "Ürün";
  const title = "Düşük stok uyarısı";
  const message = variantLabel
    ? `${productLabel} (${variantLabel}) stoğu ${next} adede düştü.`
    : `${productLabel} stoğu ${next} adede düştü.`;

  const payload = {
    type: "low_stock",
    ownerModel: "Product",
    owner: ownerId,
    stockItem:
      stockItemId && mongoose.Types.ObjectId.isValid(String(stockItemId))
        ? stockItemId
        : null,
    comboKey: normalizedComboKey,
    title,
    message,
    data: {
      productName: snapshot.productName || productLabel,
      productSlug: snapshot.productSlug || "",
      image: snapshot.image || "",
      color: cleanText(color) || null,
      size: cleanText(size) || null,
      attributeValue: cleanText(attributeValue) || null,
      variantLabel,
      previousQty: previous,
      qtyOnHand: next,
      threshold,
    },
  };

  if (session) {
    return (await AdminNotification.create([payload], { session }))[0];
  }
  return AdminNotification.create(payload);
}
