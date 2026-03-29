import Set from "../models/Set.js";
import Product from "../models/Product.js";
import { hydrateProductsWithInventory } from "../utils/stockItemHelpers.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";
import { configureCloudinary } from "../config/cloudinary.js";
import {
  DEFAULT_LANG,
  normalizeLang,
  resolveTranslation,
  pickLocalizedPayload,
  syncDocTranslations,
  composeResponseTranslations,
} from "../utils/i18n.js";
import {
  fetchActiveDiscounts,
  mapDiscountsToSets,
  applyDiscount,
} from "../utils/discountHelpers.js";
import { extractAssetList } from "../utils/uploadPayload.js";

const isId = (s) => typeof s === "string" && /^[0-9a-fA-F]{24}$/.test(s);

function parseBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
}

const resolveSetFolder = () => {
  const instance = configureCloudinary();
  const base = (instance.uploadFolder || "berkaygsm").replace(/\/+$/, "");
  return `${base}/sets`;
};

async function uploadImages(files = []) {
  if (!Array.isArray(files) || !files.length) return [];
  const folder = resolveSetFolder();
  const uploads = files.map(async (file) => {
    if (file?.buffer) {
      const resourceType = file.mimetype?.startsWith("video/")
        ? "video"
        : "image";
      const result = await uploadBufferToCloudinary(file.buffer, {
        folder,
        resource_type: resourceType,
      });
      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
      };
    }
    const fallbackUrl = file?.path || file?.location || file?.url || "";
    if (!fallbackUrl) return null;
    return {
      url: fallbackUrl,
      publicId: file?.filename || file?.originalname || "",
      width: undefined,
      height: undefined,
      format: undefined,
    };
  });
  const results = await Promise.all(uploads);
  return results.filter(Boolean);
}

async function parseSetProducts(value) {
  if (!value) return [];
  const payload = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(payload)) throw new Error("products must be an array");
  const out = [];
  for (const row of payload) {
    if (!row?.productId) throw new Error("Each item must include productId");
    const prod = await Product.findById(row.productId);
    if (!prod) throw new Error("Product not found: " + row.productId);
    out.push({
      product: prod._id,
      quantity: Math.max(1, Number(row.quantity) || 1),
    });
  }
  return out;
}

function buildSetTrTranslation(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    name: plain.name ?? "",
    description: plain.description ?? "",
  };
}

function applySetTrTranslation(doc, translation = {}) {
  if (!translation || typeof translation !== "object") return;
  if (translation.name !== undefined) {
    doc.name = String(translation.name).trim();
  }
  if (translation.description !== undefined) {
    doc.description = translation.description ?? "";
  }
}

function resolveSetId(doc) {
  if (!doc) return null;
  if (typeof doc === "string") return doc;
  if (doc._id) {
    const val =
      typeof doc._id.toString === "function" ? doc._id.toString() : doc._id;
    if (val) return String(val);
  }
  if (doc.id) {
    const val = typeof doc.id === "function" ? doc.id() : doc.id;
    if (val) return String(val);
  }
  return null;
}

async function buildSetDiscountMap(sets = []) {
  if (!sets?.length) return new Map();
  const activeDiscounts = await fetchActiveDiscounts();
  if (!activeDiscounts.length) return new Map();
  const setIds = sets.map((set) => resolveSetId(set)).filter(Boolean);
  if (!setIds.length) return new Map();
  return mapDiscountsToSets(activeDiscounts, setIds);
}

function presentSet(
  doc,
  lang,
  { includeTranslations = true, discount = null } = {}
) {
  const localized = resolveTranslation(doc, lang);
  const basePrice = Number(localized.price ?? doc.price ?? 0) || 0;
  const { finalPrice, discount: normalizedDiscount } = applyDiscount(
    basePrice,
    discount || null
  );
  localized.price = basePrice;
  localized.finalPrice = finalPrice;
  localized.discount = normalizedDiscount;
  localized.hasDiscount =
    Boolean(normalizedDiscount) && basePrice !== finalPrice;

  const productsSource = Array.isArray(doc.products) ? doc.products : [];
  localized.products = productsSource.map((entry) => {
    const plainEntry =
      typeof entry.toObject === "function" ? entry.toObject() : { ...entry };
    if (entry?.product && typeof entry.product === "object") {
      plainEntry.product = resolveTranslation(entry.product, lang);
      if (
        plainEntry.product?.category &&
        typeof plainEntry.product.category === "object"
      ) {
        plainEntry.product.category = resolveTranslation(
          plainEntry.product.category,
          lang
        );
        if (!includeTranslations && plainEntry.product.category?.translations) {
          delete plainEntry.product.category.translations;
        }
      }
      if (!includeTranslations && plainEntry.product?.translations) {
        delete plainEntry.product.translations;
      }
    }
    return plainEntry;
  });

  if (includeTranslations) {
    localized.translations = composeResponseTranslations(
      doc,
      buildSetTrTranslation
    );
  }

  return localized;
}

export async function createSet(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    if (lang !== DEFAULT_LANG) {
      return res.status(400).json({
        message:
          "New sets must be created in the default language (tr). Please switch to TR to create the set, then edit translations in other languages.",
      });
    }
    const {
      name,
      description = "",
      price,
      show = true,
      products = [],
      sku,
    } = req.body;
    if (!name || price == null)
      return res.status(400).json({ message: "Ad ve fiyat gerekli" });
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0)
      return res.status(400).json({ message: "Fiyat geçerli bir sayı olmalı" });

    const files = Array.isArray(req.files) ? req.files : [];
    const directImages = extractAssetList(req.body.images);
    const uploadedImages = await uploadImages(
      files.filter((f) => f.fieldname === "images")
    );
    const images = [...directImages, ...uploadedImages];
    const setProducts = await parseSetProducts(products);

    const doc = new Set({
      name: String(name).trim(),
      description,
      price: priceNum,
      show: !!JSON.parse(String(show).toLowerCase() || "true"),
      images,
      products: setProducts,
      sku: sku ? String(sku).trim().toUpperCase() : undefined,
    });

    const incomingTranslations = pickLocalizedPayload(req.body);
    syncDocTranslations(
      doc,
      incomingTranslations,
      buildSetTrTranslation,
      applySetTrTranslation
    );

    await doc.save();

    await doc.populate({ path: "products.product" });
    const componentProducts = doc.products
      .map((entry) => entry?.product)
      .filter(Boolean);
    await hydrateProductsWithInventory(componentProducts);
    doc.set("stock", null, { strict: false });
    res.status(201).json({ set: presentSet(doc, lang) });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.sku)
      return res.status(400).json({ message: "SKU zaten mevcut" });
    res.status(400).json({ message: err.message || "Create failed" });
  }
}

export async function listSets(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const search = String(req.query.search || "").trim();
    const includeHidden = parseBool(req.query.includeHidden, false);
    const view = String(req.query.view || "").trim().toLowerCase();
    const isCardView = view === "card";
    const limit = Math.min(
      500,
      Math.max(1, Number(req.query.limit || (search ? 60 : 200)))
    );

    const filter = {};
    if (!includeHidden) filter.show = true;
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const sets = await Set.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({
        path: "products.product",
        select: "name slug category translations",
        populate: {
          path: "category",
          select: "name slug translations",
        },
      })
      .lean();

    const products = [];
    sets.forEach((set) => {
      (set.products || []).forEach((entry) => {
        if (entry?.product) products.push(entry.product);
      });
      set.stock = null;
    });
    if (!isCardView) {
      await hydrateProductsWithInventory(products);
    }
    const setDiscountMap = await buildSetDiscountMap(sets);
    res.json({
      sets: sets.map((set) =>
        presentSet(set, lang, {
          includeTranslations: !isCardView,
          discount: setDiscountMap.get(resolveSetId(set)) || null,
        })
      ),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "List failed" });
  }
}

export async function getSet(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const { idOrSlug } = req.params;
    const set = isId(idOrSlug)
      ? await Set.findById(idOrSlug)
      : await Set.findOne({ slug: idOrSlug });
    if (!set) return res.status(404).json({ message: "Set bulunamadı" });
    await set.populate({ path: "products.product" });
    const componentProducts = set.products
      .map((entry) => entry?.product)
      .filter(Boolean);
    await hydrateProductsWithInventory(componentProducts);
    set.set("stock", null, { strict: false });
    const setDiscountMap = await buildSetDiscountMap([set]);
    const discount = setDiscountMap.get(resolveSetId(set)) || null;
    res.json({ set: presentSet(set, lang, { discount }) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Get failed" });
  }
}

export async function updateSet(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const { idOrSlug } = req.params;
    const set = isId(idOrSlug)
      ? await Set.findById(idOrSlug)
      : await Set.findOne({ slug: idOrSlug });
    if (!set) return res.status(404).json({ message: "Set bulunamadı" });

    const {
      name,
      description,
      price,
      show,
      products,
      sku,
      removeImagePublicIds,
    } = req.body;

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
        set.name = normalizedName;
      } else {
        ensureLangBucket().name = normalizedName;
      }
    }
    if (description !== undefined) {
      const normalizedDescription =
        description == null ? "" : String(description);
      if (lang === DEFAULT_LANG) {
        set.description = normalizedDescription;
      } else {
        ensureLangBucket().description = normalizedDescription;
      }
    }
    if (price !== undefined) {
      const n = Number(price);
      if (!Number.isFinite(n) || n < 0)
        return res
          .status(400)
          .json({ message: "Fiyat geçerli bir sayı olmalı" });
      set.price = n;
    }
    if (show !== undefined)
      set.show = !!JSON.parse(String(show).toLowerCase() || "true");
    if (sku !== undefined)
      set.sku = sku ? String(sku).trim().toUpperCase() : undefined;

    if (products !== undefined) set.products = await parseSetProducts(products);

    if (removeImagePublicIds) {
      let ids = [];
      if (Array.isArray(removeImagePublicIds)) {
        ids = removeImagePublicIds;
      } else if (typeof removeImagePublicIds === "string") {
        const trimmed = removeImagePublicIds.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) ids = parsed;
          } catch {
            // fallback to split below
          }
        }
        if (!ids.length) {
          ids = trimmed
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      } else {
        ids = String(removeImagePublicIds)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      if (ids.length) {
        set.images = set.images.filter((img) => !ids.includes(img.publicId));
        await Promise.allSettled(
          ids.map((pid) => deleteFromCloudinary(pid, "image"))
        );
        set.markModified("images");
      }
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const directImages = extractAssetList(req.body.images);
    if (directImages.length) {
      set.images.push(...directImages);
      set.markModified("images");
    }
    const newImgs = await uploadImages(
      files.filter((f) => f.fieldname === "images")
    );
    if (newImgs.length) {
      set.images.push(...newImgs);
      set.markModified("images");
    }

    syncDocTranslations(
      set,
      incomingTranslations,
      buildSetTrTranslation,
      applySetTrTranslation
    );

    await set.save();
    await set.populate({ path: "products.product" });
    const componentProducts = set.products
      .map((entry) => entry?.product)
      .filter(Boolean);
    await hydrateProductsWithInventory(componentProducts);
    set.set("stock", null, { strict: false });
    const setDiscountMap = await buildSetDiscountMap([set]);
    const discount = setDiscountMap.get(resolveSetId(set)) || null;
    res.json({ set: presentSet(set, lang, { discount }) });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.sku)
      return res.status(400).json({ message: "SKU zaten mevcut" });
    res.status(400).json({ message: err.message || "Update failed" });
  }
}

export async function deleteSet(req, res) {
  try {
    const { idOrSlug } = req.params;
    const set = isId(idOrSlug)
      ? await Set.findById(idOrSlug)
      : await Set.findOne({ slug: idOrSlug });
    if (!set) return res.status(404).json({ message: "Set bulunamadı" });
    if (Array.isArray(set.images) && set.images.length) {
      await Promise.allSettled(
        set.images
          .map((img) => img?.publicId)
          .filter(Boolean)
          .map((pid) => deleteFromCloudinary(pid, "image"))
      );
    }
    await set.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || "Delete failed" });
  }
}
