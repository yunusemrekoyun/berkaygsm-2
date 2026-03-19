import mongoose from "mongoose";
import Discount from "../models/Discount.js";
import Product from "../models/Product.js";
import SetModel from "../models/Set.js";
import Category from "../models/Category.js";
import {
  DEFAULT_LANG,
  normalizeLang,
  resolveTranslation,
  pickLocalizedPayload,
  syncDocTranslations,
  composeResponseTranslations,
} from "../utils/i18n.js";

const TARGET_POPULATE = [
  { path: "appliesTo.products", select: "name slug price images" },
  { path: "appliesTo.sets", select: "name slug price images" },
  { path: "appliesTo.categories", select: "name slug" },
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
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  throw new Error(`${field} alanı true/false olmalı`);
}

function parseNullableDate(value, field) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} geçerli bir tarih olmalı`);
  }
  return parsed;
}

function validateDateRange(startsAt, endsAt) {
  if (startsAt && endsAt && startsAt.getTime() > endsAt.getTime()) {
    throw new Error("Başlangıç tarihi bitiş tarihinden sonra olamaz");
  }
}

function isEffectiveNow({ active, startsAt, endsAt }, now = new Date()) {
  if (!active) return false;
  if (startsAt && startsAt.getTime() > now.getTime()) return false;
  if (endsAt && endsAt.getTime() < now.getTime()) return false;
  return true;
}

function buildDiscountTrTranslation(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    name: plain.name ?? "",
    description: plain.description ?? "",
  };
}

function applyDiscountTrTranslation(doc, translation = {}) {
  if (!translation || typeof translation !== "object") return;
  if (translation.name !== undefined) {
    doc.name = translation.name;
  }
  if (translation.description !== undefined) {
    doc.description = translation.description;
  }
}

async function validateObjectIds(ids = [], model, label = "item") {
  if (!Array.isArray(ids) || !ids.length) return [];

  const uniqueRawIds = [];
  const seen = new Set();
  const objectIds = [];
  for (const value of ids) {
    const raw = String(value ?? "").trim();
    if (!raw) throw new Error(`Empty ${label} id supplied`);
    if (seen.has(raw)) continue;
    seen.add(raw);
    uniqueRawIds.push(raw);
    let objectId;
    try {
      objectId = new mongoose.Types.ObjectId(raw);
    } catch {
      throw new Error(`Invalid ${label} id supplied (${raw})`);
    }
    objectIds.push(objectId);
  }

  const docs = await model.find({ _id: { $in: objectIds } }, { _id: 1 }).lean();
  if (docs.length !== objectIds.length) {
    const existing = new Set(docs.map((d) => d._id.toString()));
    const missing = uniqueRawIds
      .filter((id) => !existing.has(id));
    throw new Error(
      missing.length
        ? `The following ${label}(s) were not found: ${missing.join(", ")}`
        : `Selected ${label}s were not found`
    );
  }

  return objectIds;
}

async function collectDescendantCategoryIds(categoryIds = []) {
  if (!categoryIds.length) return [];
  const normalizedIds = categoryIds.map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  const [categories, descendants] = await Promise.all([
    Category.find({ _id: { $in: normalizedIds } }, { _id: 1 }).lean(),
    Category.find({ ancestors: { $in: normalizedIds } }, { _id: 1 }).lean(),
  ]);

  const allIds = [
    ...categories.map((d) => d._id.toString()),
    ...descendants.map((d) => d._id.toString()),
  ];
  return Array.from(new Set(allIds));
}

async function collectProductsForCategories(categoryIds) {
  if (!categoryIds.length) return [];
  const allCategoryIds = await collectDescendantCategoryIds(categoryIds);
  if (!allCategoryIds.length) return [];
  const products = await Product.find(
    {
      category: {
        $in: allCategoryIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    },
    { _id: 1 }
  ).lean();
  return products.map((p) => p._id.toString());
}

async function expandCoverage({ products = [], sets = [], categories = [] }) {
  const coverageProducts = new Set(products.map((id) => id.toString()));
  const coverageSets = new Set(sets.map((id) => id.toString()));
  const coverageCategories = new Set(categories.map((id) => id.toString()));

  if (categories.length) {
    const descCategories = await collectDescendantCategoryIds(categories);
    descCategories.forEach((id) => coverageCategories.add(id));
    const productIds = await collectProductsForCategories(categories);
    productIds.forEach((id) => coverageProducts.add(id));
  }

  return {
    products: Array.from(coverageProducts),
    sets: Array.from(coverageSets),
    categories: Array.from(coverageCategories),
  };
}

function intersectValues(source = [], target = []) {
  if (!source.length || !target.length) return [];
  const lookup = new Set(source);
  return target.filter((value) => lookup.has(value));
}

async function computeConflicts(
  { products, sets, categories },
  existingDiscounts
) {
  const newCoverage = await expandCoverage({ products, sets, categories });
  if (
    !newCoverage.products.length &&
    !newCoverage.sets.length &&
    !newCoverage.categories.length
  )
    return [];

  const conflicts = [];
  for (const discount of existingDiscounts) {
    const coverage = await expandCoverage({
      products: discount.appliesTo?.products || [],
      sets: discount.appliesTo?.sets || [],
      categories: discount.appliesTo?.categories || [],
    });

    const overlappingProducts = intersectValues(
      newCoverage.products,
      coverage.products
    );
    const overlappingSets = intersectValues(newCoverage.sets, coverage.sets);
    const overlappingCategories = intersectValues(
      newCoverage.categories,
      coverage.categories
    );

    if (
      overlappingProducts.length ||
      overlappingSets.length ||
      overlappingCategories.length
    ) {
      conflicts.push({
        discount,
        products: overlappingProducts,
        sets: overlappingSets,
        categories: overlappingCategories,
      });
    }
  }

  return conflicts;
}

function serializeConflicts(conflicts) {
  return conflicts.map((entry) => ({
    id: entry.discount._id,
    name: entry.discount.name,
    percentage: entry.discount.percentage,
    productIds: entry.products,
    setIds: entry.sets,
    categoryIds: entry.categories,
  }));
}

export async function listDiscounts(req, res) {
  const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
  const discounts = await Discount.find()
    .sort({ createdAt: -1 })
    .populate(TARGET_POPULATE);
  res.json({
    discounts: discounts.map((discountDoc) => {
      const localized = resolveTranslation(discountDoc, lang);
      if (localized.appliesTo) {
        localized.appliesTo = {
          ...localized.appliesTo,
          products: (discountDoc.appliesTo?.products || []).map((item) =>
            item && typeof item === "object"
              ? resolveTranslation(item, lang)
              : item
          ),
          sets: (discountDoc.appliesTo?.sets || []).map((item) =>
            item && typeof item === "object"
              ? resolveTranslation(item, lang)
              : item
          ),
          categories: (discountDoc.appliesTo?.categories || []).map((item) =>
            item && typeof item === "object"
              ? resolveTranslation(item, lang)
              : item
          ),
        };
      }
      const translations = composeResponseTranslations(
        discountDoc,
        buildDiscountTrTranslation
      );
      return shapeDiscount(
        localized,
        { includeTranslations: true },
        translations
      );
    }),
  });
}

export async function createDiscount(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    if (lang !== DEFAULT_LANG) {
      return res.status(400).json({
        message:
          "New discounts must be created in the default language (tr). Please switch to TR to create the discount, then translate it via the update endpoint.",
      });
    }

    const {
      name,
      description = "",
      percentage,
      products = [],
      sets = [],
      categories = [],
      active,
      allowCouponStacking,
      allowStackedDiscountStacking,
      startsAt,
      endsAt,
      resolve = null,
    } = req.body;

    if (!name || percentage === undefined)
      return res
        .status(400)
        .json({ message: "Ad ve yüzde gerekli" });

    const parsedPercentage = Number(percentage);
    if (
      !Number.isFinite(parsedPercentage) ||
      parsedPercentage <= 0 ||
      parsedPercentage > 100
    )
      return res
        .status(400)
        .json({ message: "Yüzde 1-100 arasında olmalı" });

    const parsedActive = parseBooleanInput(active, "active");
    const parsedAllowCouponStacking = parseBooleanInput(
      allowCouponStacking,
      "allowCouponStacking"
    );
    const parsedAllowStackedDiscountStacking = parseBooleanInput(
      allowStackedDiscountStacking,
      "allowStackedDiscountStacking"
    );
    const parsedStartsAt = parseNullableDate(startsAt, "startsAt");
    const parsedEndsAt = parseNullableDate(endsAt, "endsAt");
    validateDateRange(parsedStartsAt, parsedEndsAt);
    const effectiveNow = isEffectiveNow({
      active: parsedActive ?? true,
      startsAt: parsedStartsAt ?? null,
      endsAt: parsedEndsAt ?? null,
    });

    const productIds = await validateObjectIds(products, Product, "product");
    const setIds = await validateObjectIds(sets, SetModel, "set");
    const categoryIds = await validateObjectIds(
      categories,
      Category,
      "category"
    );

    if (!productIds.length && !setIds.length && !categoryIds.length)
      return res.status(400).json({ message: "En az bir hedef seçin" });

    const now = new Date();
    let conflicts = [];
    if (effectiveNow) {
      const allActiveFlagged = await Discount.find({ active: true }).lean();
      const activeDiscounts = allActiveFlagged.filter((d) => {
        const startsOk = !d.startsAt || new Date(d.startsAt) <= now;
        const endsOk = !d.endsAt || new Date(d.endsAt) >= now;
        return startsOk && endsOk;
      });

      // --- FAST PATH: aynı ürüne aktif indirim var mı? (startsAt NULL dahil)
      if (productIds.length) {
        const directOverlap = await Discount.exists({
          active: true,
          $and: [
            { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
            { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
          ],
          "appliesTo.products": { $in: productIds },
        });
        if (directOverlap && !resolve) {
          return res.status(409).json({
            message: "İndirim çakışmaları tespit edildi",
            conflicts: [
              {
                id: null,
                name: "Existing discount",
                percentage: null,
                productIds: productIds.map(String),
                setIds: [],
                categoryIds: [],
              },
            ],
          });
        }
      }

      conflicts = await computeConflicts(
        { products: productIds, sets: setIds, categories: categoryIds },
        activeDiscounts
      );

      if (conflicts.length && !resolve)
        return res.status(409).json({
          message: "İndirim çakışmaları tespit edildi",
          conflicts: serializeConflicts(conflicts),
        });
    }

    // Çakışma çözümü
    let finalProducts = productIds;
    let finalSets = setIds;
    let finalCategories = categoryIds;

    if (conflicts.length && resolve) {
      const conflictingProductSet = new Set(
        conflicts.flatMap((e) => e.products)
      );
      const conflictingSetIds = new Set(conflicts.flatMap((e) => e.sets));
      const conflictingCategoryIds = new Set(
        conflicts.flatMap((e) => e.categories)
      );

      if (resolve === "skip") {
        finalProducts = finalProducts.filter(
          (id) => !conflictingProductSet.has(id.toString())
        );
        finalSets = finalSets.filter(
          (id) => !conflictingSetIds.has(id.toString())
        );
        finalCategories = finalCategories.filter(
          (id) => !conflictingCategoryIds.has(id.toString())
        );
        if (
          !finalProducts.length &&
          !finalSets.length &&
          !finalCategories.length
        )
          return res
            .status(400)
            .json({ message: "Çakışmalar çıkarıldıktan sonra hedef kalmadı" });
      } else if (resolve === "overwrite") {
        const conflictIds = conflicts.map((e) => e.discount._id);
        await Discount.updateMany(
          { _id: { $in: conflictIds } },
          { $set: { active: false } }
        );
      } else if (resolve === "cancel")
        return res.status(200).json({ cancelled: true });
    }

    const discount = new Discount({
      name,
      description,
      percentage: parsedPercentage,
      appliesTo: {
        products: finalProducts,
        sets: finalSets,
        categories: finalCategories,
      },
      active: parsedActive ?? true,
      allowCouponStacking: parsedAllowCouponStacking ?? true,
      allowStackedDiscountStacking:
        parsedAllowStackedDiscountStacking ?? true,
      startsAt: parsedStartsAt ?? null,
      endsAt: parsedEndsAt ?? null,
    });

    // ✅ BURASI EKLENDİ
    const incomingTranslations = pickLocalizedPayload(req.body);
    syncDocTranslations(
      discount,
      incomingTranslations,
      buildDiscountTrTranslation,
      applyDiscountTrTranslation
    );

    await discount.save();
    await discount.populate(TARGET_POPULATE);

    const localized = resolveTranslation(discount, lang);
    if (localized.appliesTo) {
      localized.appliesTo = {
        ...localized.appliesTo,
        products: (discount.appliesTo?.products || []).map((item) =>
          item && typeof item === "object"
            ? resolveTranslation(item, lang)
            : item
        ),
        sets: (discount.appliesTo?.sets || []).map((item) =>
          item && typeof item === "object"
            ? resolveTranslation(item, lang)
            : item
        ),
        categories: (discount.appliesTo?.categories || []).map((item) =>
          item && typeof item === "object"
            ? resolveTranslation(item, lang)
            : item
        ),
      };
    }
    const translations = composeResponseTranslations(
      discount,
      buildDiscountTrTranslation
    );

    res.status(201).json({
      discount: shapeDiscount(
        localized,
        { includeTranslations: true },
        translations
      ),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function updateDiscount(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const { id } = req.params;
    const discount = await Discount.findById(id);
    if (!discount)
      return res.status(404).json({ message: "İndirim bulunamadı" });

    const {
      name,
      description,
      percentage,
      products,
      sets,
      categories,
      active,
      allowCouponStacking,
      allowStackedDiscountStacking,
      startsAt,
      endsAt,
      resolve = null,
    } = req.body;

    // ✅ TEK TANE incomingTranslations BURADA
    const incomingTranslations = pickLocalizedPayload(req.body);
    const ensureLangBucket = () => {
      const bucketLang = normalizeLang(lang);
      incomingTranslations[bucketLang] = {
        ...(incomingTranslations[bucketLang] || {}),
      };
      return incomingTranslations[bucketLang];
    };

    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (lang === DEFAULT_LANG) {
        discount.name = normalizedName;
      } else {
        ensureLangBucket().name = normalizedName;
      }
    }
    if (description !== undefined) {
      const normalizedDescription =
        description == null ? "" : String(description);
      if (lang === DEFAULT_LANG) {
        discount.description = normalizedDescription;
      } else {
        ensureLangBucket().description = normalizedDescription;
      }
    }
    if (percentage !== undefined) {
      const parsed = Number(percentage);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100)
        return res
          .status(400)
          .json({ message: "Yüzde 1-100 arasında olmalı" });
      discount.percentage = parsed;
    }
    const parsedActive = parseBooleanInput(active, "active");
    if (parsedActive !== undefined) discount.active = parsedActive;
    const parsedAllowCouponStacking = parseBooleanInput(
      allowCouponStacking,
      "allowCouponStacking"
    );
    if (parsedAllowCouponStacking !== undefined) {
      discount.allowCouponStacking = parsedAllowCouponStacking;
    }
    const parsedAllowStackedDiscountStacking = parseBooleanInput(
      allowStackedDiscountStacking,
      "allowStackedDiscountStacking"
    );
    if (parsedAllowStackedDiscountStacking !== undefined) {
      discount.allowStackedDiscountStacking =
        parsedAllowStackedDiscountStacking;
    }
    const parsedStartsAt = parseNullableDate(startsAt, "startsAt");
    if (parsedStartsAt !== undefined) discount.startsAt = parsedStartsAt;
    const parsedEndsAt = parseNullableDate(endsAt, "endsAt");
    if (parsedEndsAt !== undefined) discount.endsAt = parsedEndsAt;
    validateDateRange(
      discount.startsAt ? new Date(discount.startsAt) : null,
      discount.endsAt ? new Date(discount.endsAt) : null
    );

    let productIds = discount.appliesTo.products || [];
    let setIds = discount.appliesTo.sets || [];
    let categoryIds = discount.appliesTo.categories || [];

    const hasTargetPatch =
      products !== undefined || sets !== undefined || categories !== undefined;
    const needsConflictRecheck =
      hasTargetPatch ||
      parsedActive !== undefined ||
      parsedStartsAt !== undefined ||
      parsedEndsAt !== undefined;

    if (hasTargetPatch) {
      productIds = await validateObjectIds(
        products ?? productIds,
        Product,
        "product"
      );
      setIds = await validateObjectIds(sets ?? setIds, SetModel, "set");
      categoryIds = await validateObjectIds(
        categories ?? categoryIds,
        Category,
        "category"
      );

      if (!productIds.length && !setIds.length && !categoryIds.length)
        return res.status(400).json({ message: "En az bir hedef seçin" });

      discount.appliesTo = {
        products: productIds,
        sets: setIds,
        categories: categoryIds,
      };
    }

    if (needsConflictRecheck) {
      const effectiveNow = isEffectiveNow({
        active: !!discount.active,
        startsAt: discount.startsAt ? new Date(discount.startsAt) : null,
        endsAt: discount.endsAt ? new Date(discount.endsAt) : null,
      });

      if (effectiveNow) {
        const now = new Date();
        const allActiveFlagged = await Discount.find({
          active: true,
          _id: { $ne: discount._id },
        }).lean();
        const activeDiscounts = allActiveFlagged.filter((d) => {
          const startsOk = !d.startsAt || new Date(d.startsAt) <= now;
          const endsOk = !d.endsAt || new Date(d.endsAt) >= now;
          return startsOk && endsOk;
        });

        // --- FAST PATH: aynı ürüne başka aktif indirim var mı? (startsAt NULL dahil)
        if (productIds.length) {
          const directOverlap = await Discount.exists({
            active: true,
            _id: { $ne: discount._id },
            $and: [
              { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
              { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
            ],
            "appliesTo.products": { $in: productIds },
          });
          if (directOverlap && !resolve) {
            return res.status(409).json({
              message: "İndirim çakışmaları tespit edildi",
              conflicts: [
                {
                  id: null,
                  name: "Existing discount",
                  percentage: null,
                  productIds: productIds.map(String),
                  setIds: [],
                  categoryIds: [],
                },
              ],
            });
          }
        }

        const conflicts = await computeConflicts(
          { products: productIds, sets: setIds, categories: categoryIds },
          activeDiscounts
        );

        if (conflicts.length && !resolve)
          return res.status(409).json({
            message: "İndirim çakışmaları tespit edildi",
            conflicts: serializeConflicts(conflicts),
          });

        if (conflicts.length && resolve) {
          const conflictingProductSet = new Set(
            conflicts.flatMap((e) => e.products)
          );
          const conflictingSetIds = new Set(conflicts.flatMap((e) => e.sets));
          const conflictingCategoryIds = new Set(
            conflicts.flatMap((e) => e.categories)
          );

          if (resolve === "skip") {
            productIds = productIds.filter(
              (id) => !conflictingProductSet.has(id.toString())
            );
            setIds = setIds.filter(
              (id) => !conflictingSetIds.has(id.toString())
            );
            categoryIds = categoryIds.filter(
              (id) => !conflictingCategoryIds.has(id.toString())
            );
            if (!productIds.length && !setIds.length && !categoryIds.length)
              return res.status(400).json({
                message: "Çakışmalar çıkarıldıktan sonra hedef kalmadı",
              });
            discount.appliesTo = {
              products: productIds,
              sets: setIds,
              categories: categoryIds,
            };
          } else if (resolve === "overwrite") {
            const conflictIds = conflicts.map((e) => e.discount._id);
            await Discount.updateMany(
              { _id: { $in: conflictIds } },
              { $set: { active: false } }
            );
          } else if (resolve === "cancel") {
            return res.status(200).json({ cancelled: true });
          }
        }
      }
    }

    // ❌ TEKRAR TANIM YOK, SADECE KULLANIM VAR
    syncDocTranslations(
      discount,
      incomingTranslations,
      buildDiscountTrTranslation,
      applyDiscountTrTranslation
    );

    await discount.save();
    await discount.populate(TARGET_POPULATE);

    const localized = resolveTranslation(discount, lang);
    if (localized.appliesTo) {
      localized.appliesTo = {
        ...localized.appliesTo,
        products: (discount.appliesTo?.products || []).map((item) =>
          item && typeof item === "object"
            ? resolveTranslation(item, lang)
            : item
        ),
        sets: (discount.appliesTo?.sets || []).map((item) =>
          item && typeof item === "object"
            ? resolveTranslation(item, lang)
            : item
        ),
        categories: (discount.appliesTo?.categories || []).map((item) =>
          item && typeof item === "object"
            ? resolveTranslation(item, lang)
            : item
        ),
      };
    }
    const translations = composeResponseTranslations(
      discount,
      buildDiscountTrTranslation
    );

    res.json({
      discount: shapeDiscount(
        localized,
        { includeTranslations: true },
        translations
      ),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function deleteDiscount(req, res) {
  try {
    const { id } = req.params;
    await Discount.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
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
  return list.map((i) => normalizeRef(i)).filter((e) => e && e.id);
}

function shapeDiscount(
  doc,
  { includeTranslations = false } = {},
  translations = null
) {
  if (!doc) return null;
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const shaped = {
    id: plain._id?.toString?.() || plain.id,
    name: plain.name,
    description: plain.description,
    percentage: plain.percentage,
    active: plain.active,
    allowCouponStacking: plain.allowCouponStacking !== false,
    allowStackedDiscountStacking:
      plain.allowStackedDiscountStacking !== false,
    startsAt: plain.startsAt,
    endsAt: plain.endsAt,
    appliesTo: {
      products: shapeTargets(plain.appliesTo?.products),
      sets: shapeTargets(plain.appliesTo?.sets),
      categories: shapeTargets(plain.appliesTo?.categories),
    },
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };

  if (includeTranslations) {
    shaped.translations = translations ?? plain.translations ?? {};
  }

  return shaped;
}
