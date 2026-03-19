import mongoose from "mongoose";
import Product from "../models/Product.js";
import SetModel from "../models/Set.js";
import Category from "../models/Category.js";
import StackedDiscount from "../models/StackedDiscount.js";

const TARGET_POPULATE = [
  { path: "targets.products", select: "name slug price images" },
  { path: "targets.sets", select: "name slug price images" },
  { path: "targets.categories", select: "name slug" },
];

function parseBooleanInput(value, field = "active") {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  throw new Error(`${field} alanı true/false olmalı`);
}

async function validateObjectIds(ids = [], model, label = "item") {
  if (!Array.isArray(ids) || !ids.length) return [];

  const deduped = Array.from(
    new Set(
      ids
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
  const objectIds = deduped.map((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error(`${label} içinde geçersiz id var`);
    }
    return new mongoose.Types.ObjectId(value);
  });

  const docs = await model.find({ _id: { $in: objectIds } }, { _id: 1 }).lean();
  if (docs.length !== objectIds.length) {
    throw new Error(`Seçilen ${label} kayıtlarından bazıları bulunamadı`);
  }

  return objectIds;
}

function normalizeTiers(rawTiers = []) {
  const tiers = (Array.isArray(rawTiers) ? rawTiers : [])
    .map((tier) => ({
      quantity: Math.max(0, Math.floor(Number(tier?.quantity || 0))),
      percentage: Number(tier?.percentage || 0),
    }))
    .filter(
      (tier) =>
        Number.isFinite(tier.quantity) &&
        tier.quantity >= 2 &&
        Number.isFinite(tier.percentage) &&
        tier.percentage > 0 &&
        tier.percentage <= 100
    )
    .sort((left, right) => left.quantity - right.quantity);

  if (!tiers.length) {
    throw new Error("En az bir katlanan indirim kademesi girin");
  }

  for (let index = 0; index < tiers.length; index += 1) {
    const current = tiers[index];
    const previous = tiers[index - 1];
    if (!previous) continue;
    if (current.quantity === previous.quantity) {
      throw new Error("Aynı ürün adedi için birden fazla kademe olamaz");
    }
    if (current.percentage <= previous.percentage) {
      throw new Error("Katlanan indirim yüzdeleri artarak ilerlemeli");
    }
  }

  return tiers.map((tier) => ({
    quantity: tier.quantity,
    percentage: Math.round(tier.percentage * 100) / 100,
  }));
}

function normalizeRef(item) {
  if (!item) return null;
  if (typeof item === "string") return { id: item, name: "" };
  const id = item._id?.toString?.() || item.id?.toString?.();
  return {
    id,
    name: item.name || item.title || "",
    label: item.name || item.title || "",
    slug: item.slug || null,
    image: item.images?.[0]?.url || null,
  };
}

function shapeTargets(list = []) {
  return list.map((item) => normalizeRef(item)).filter((item) => item && item.id);
}

function shapeStackedDiscount(doc) {
  const plain = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!plain) {
    return {
      id: null,
      active: false,
      allowCouponStacking: true,
      allowDiscountStacking: true,
      targets: { products: [], sets: [], categories: [] },
      tiers: [],
      createdAt: null,
      updatedAt: null,
    };
  }

  return {
    id: plain._id?.toString?.() || plain.id || null,
    active: plain.active !== false,
    allowCouponStacking: plain.allowCouponStacking !== false,
    allowDiscountStacking: plain.allowDiscountStacking !== false,
    targets: {
      products: shapeTargets(plain.targets?.products),
      sets: shapeTargets(plain.targets?.sets),
      categories: shapeTargets(plain.targets?.categories),
    },
    tiers: Array.isArray(plain.tiers)
      ? plain.tiers.map((tier) => ({
          quantity: Number(tier.quantity || 0),
          percentage: Number(tier.percentage || 0),
        }))
      : [],
    createdAt: plain.createdAt || null,
    updatedAt: plain.updatedAt || null,
  };
}

export async function getPublicStackedDiscount(req, res) {
  try {
    const doc = await StackedDiscount.findOne({ singleton: "stacked_discount" })
      .populate(TARGET_POPULATE)
      .lean();
    res.json({ stackedDiscount: shapeStackedDiscount(doc) });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Katlanan indirim yüklenemedi",
    });
  }
}

export async function getManageStackedDiscount(req, res) {
  try {
    const doc = await StackedDiscount.findOne({ singleton: "stacked_discount" })
      .populate(TARGET_POPULATE);
    res.json({ stackedDiscount: shapeStackedDiscount(doc) });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Katlanan indirim yüklenemedi",
    });
  }
}

export async function upsertStackedDiscount(req, res) {
  try {
    const {
      active,
      allowCouponStacking,
      allowDiscountStacking,
      products = [],
      sets = [],
      categories = [],
      tiers = [],
    } = req.body || {};

    const [productIds, setIds, categoryIds] = await Promise.all([
      validateObjectIds(products, Product, "ürün"),
      validateObjectIds(sets, SetModel, "set"),
      validateObjectIds(categories, Category, "kategori"),
    ]);

    if (!productIds.length && !setIds.length && !categoryIds.length) {
      throw new Error("En az bir ürün, set veya kategori seçin");
    }

    const normalizedTiers = normalizeTiers(tiers);
    const doc = await StackedDiscount.getSingleton();
    const parsedActive = parseBooleanInput(active, "active");
    const parsedAllowCouponStacking = parseBooleanInput(
      allowCouponStacking,
      "allowCouponStacking"
    );
    const parsedAllowDiscountStacking = parseBooleanInput(
      allowDiscountStacking,
      "allowDiscountStacking"
    );

    doc.active = parsedActive ?? doc.active ?? false;
    doc.allowCouponStacking =
      parsedAllowCouponStacking ?? doc.allowCouponStacking ?? true;
    doc.allowDiscountStacking =
      parsedAllowDiscountStacking ?? doc.allowDiscountStacking ?? true;
    doc.targets = {
      products: productIds,
      sets: setIds,
      categories: categoryIds,
    };
    doc.tiers = normalizedTiers;

    await doc.save();
    await doc.populate(TARGET_POPULATE);

    res.json({ stackedDiscount: shapeStackedDiscount(doc) });
  } catch (error) {
    res.status(400).json({
      message: error.message || "Katlanan indirim kaydedilemedi",
    });
  }
}
