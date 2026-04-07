import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import SetModel from "../models/Set.js";
import StockItem from "../models/StockItem.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";
import { resolveMediaFolder } from "../media/config.js";
import { hydrateProductsWithInventory } from "../utils/stockItemHelpers.js";
import { maybeCreateLowStockNotification } from "../services/adminNotificationService.js";
import {
  fetchActiveDiscounts,
  computeProductDiscountMap,
  applyDiscount,
} from "../utils/discountHelpers.js";
import {
  DEFAULT_LANG,
  normalizeLang,
  resolveTranslation,
  pickLocalizedPayload,
  syncDocTranslations,
  composeResponseTranslations,
} from "../utils/i18n.js";
import { extractAssetList } from "../utils/uploadPayload.js";

const isId = (s) => typeof s === "string" && /^[0-9a-fA-F]{24}$/.test(s);

// 🔁 ESKİ normalizeArray yerine biraz daha esnek hâli
// (virgül, ; ve satır sonuna göre böler)
const normalizeArray = (v) => {
  if (Array.isArray(v)) {
    return v
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (typeof v === "string") {
    const trimmed = v.trim();

    // 1) JSON array olarak geldiyse: '["#000000","red"]'
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map(String)
            .map((s) => s.trim())
            .filter(Boolean);
        }
      } catch (_err) {
        // parse edemezsek normal yola düşsün
      }
    }

    // 2) klasik "kırmızı,mavi" formatı
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
};

function parseImageOrder(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .flatMap((item) => parseImageOrder(item))
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        return [];
      }
    }
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function orderProductImages(existingImages = [], newImages = [], imageOrder = []) {
  if (!imageOrder.length) return [...existingImages, ...newImages];

  const existingMap = new Map(
    existingImages.map((image) => [`existing:${image.publicId}`, image])
  );
  const newMap = new Map(
    newImages.map((image, index) => [`new:${index}`, image])
  );

  const ordered = [];
  imageOrder.forEach((token) => {
    const image = existingMap.get(token) || newMap.get(token);
    if (!image) return;
    ordered.push(image);
    existingMap.delete(token);
    newMap.delete(token);
  });

  return [
    ...ordered,
    ...existingMap.values(),
    ...newMap.values(),
  ];
}

function parseBool(v, def = true) {
  if (v === undefined) return def;
  const s = String(v).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(s);
}

function normKey(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().toLowerCase();
}

function buildProductComboKey(row = {}) {
  return `p|${normKey(row.color)}|${normKey(row.size)}|${normKey(
    row.attributeValue
  )}`;
}

function parseStockRows(raw) {
  if (raw === undefined) {
    return { provided: false, valid: true, explicitEmpty: false, rows: [] };
  }

  if (Array.isArray(raw)) {
    if (!raw.length) {
      return { provided: true, valid: true, explicitEmpty: true, rows: [] };
    }
    if (raw.every((entry) => entry && typeof entry === "object")) {
      return {
        provided: true,
        valid: true,
        explicitEmpty: false,
        rows: raw,
      };
    }

    const parsedItems = [];
    for (const entry of raw) {
      if (typeof entry !== "string") {
        return { provided: true, valid: false, explicitEmpty: false, rows: [] };
      }
      try {
        const parsed = JSON.parse(entry);
        if (Array.isArray(parsed)) {
          parsedItems.push(...parsed);
          continue;
        }
        if (parsed && typeof parsed === "object") {
          parsedItems.push(parsed);
          continue;
        }
        return { provided: true, valid: false, explicitEmpty: false, rows: [] };
      } catch {
        return { provided: true, valid: false, explicitEmpty: false, rows: [] };
      }
    }

    return {
      provided: true,
      valid: true,
      explicitEmpty: parsedItems.length === 0,
      rows: parsedItems,
    };
  }

  if (typeof raw === "string") {
    let current = raw;
    for (let i = 0; i < 2; i += 1) {
      try {
        const parsed = JSON.parse(current);
        if (Array.isArray(parsed)) {
          return {
            provided: true,
            valid: true,
            explicitEmpty: parsed.length === 0,
            rows: parsed,
          };
        }
        if (typeof parsed === "string") {
          current = parsed;
          continue;
        }
        return { provided: true, valid: false, explicitEmpty: false, rows: [] };
      } catch {
        return { provided: true, valid: false, explicitEmpty: false, rows: [] };
      }
    }
  }

  return { provided: true, valid: false, explicitEmpty: false, rows: [] };
}

async function syncProductStockRows(productId, rawRows) {
  const parsed = parseStockRows(rawRows);
  if (!parsed.provided) return { ok: true, count: 0, touched: false };
  if (!parsed.valid) {
    throw new Error("Stok satırları okunamadı");
  }
  if (parsed.explicitEmpty) {
    await StockItem.deleteMany({ ownerModel: "Product", owner: productId });
    return { ok: true, count: 0, touched: true };
  }

  const rows = parsed.rows;
  if (!rows.length) return { ok: true, count: 0, touched: true };

  const seen = new Set();
  const docs = [];
  rows.forEach((row) => {
    const qtyValue = row?.qtyOnHand ?? row?.stock ?? row?.quantity ?? 0;
    const doc = {
      ownerModel: "Product",
      owner: productId,
      color: row?.color ?? null,
      size: row?.size ?? null,
      attributeValue: row?.attributeValue ?? null,
      qtyOnHand: Math.max(0, Math.floor(Number(qtyValue) || 0)),
      sku: row?.sku ? String(row.sku).trim().toUpperCase() : undefined,
      isActive: row?.isActive === undefined ? true : !!row.isActive,
      note: row?.note ?? "",
    };
    const comboKey = buildProductComboKey(doc);
    if (!comboKey || seen.has(comboKey)) return;
    seen.add(comboKey);
    docs.push({ ...doc, comboKey });
  });

  if (!docs.length) return { ok: true, count: 0 };

  // Mevcut stokları önceden al — low-stock notification için gerekli
  const existingItems = await StockItem.find(
    { ownerModel: "Product", owner: productId },
    { comboKey: 1, qtyOnHand: 1 }
  ).lean();
  const prevQtyMap = new Map(existingItems.map((s) => [s.comboKey, s.qtyOnHand]));

  await StockItem.deleteMany({ ownerModel: "Product", owner: productId });
  const inserted = await StockItem.insertMany(docs, { ordered: false });

  // Low-stock notification — sipariş dışı stok güncellemelerinde de tetiklensin
  const notifications = docs.map((doc) =>
    maybeCreateLowStockNotification({
      ownerModel: "Product",
      owner: productId,
      comboKey: doc.comboKey,
      color: doc.color,
      size: doc.size,
      attributeValue: doc.attributeValue,
      previousQty: prevQtyMap.get(doc.comboKey) ?? NaN,
      qtyOnHand: doc.qtyOnHand,
    })
  );
  await Promise.allSettled(notifications);

  return {
    ok: true,
    count: Array.isArray(inserted) ? inserted.length : 0,
  };
}

async function resolveCategory(category) {
  if (!category) return null;
  const filter = isId(category) ? { _id: category } : { slug: category };
  const doc = await Category.findOne(filter);
  if (!doc) throw new Error("Category not found");
  return doc;
}

function assignSetCount(target, count = 0) {
  const safe = Number.isFinite(count) ? count : 0;
  if (!target || typeof target !== "object") return;
  if (typeof target.set === "function") {
    target.set("setsCount", safe, { strict: false });
  } else {
    target.setsCount = safe;
  }
}

async function annotateProductsWithSetUsage(products = []) {
  if (!Array.isArray(products) || !products.length) return;

  const idList = [];
  products.forEach((product) => {
    const id =
      product?._id?.toString?.() ||
      product?.id?.toString?.() ||
      null;
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      idList.push(id);
    }
    assignSetCount(product, product?.setsCount ?? 0);
  });

  if (!idList.length) return;

  const objectIds = idList.map((id) => new mongoose.Types.ObjectId(id));
  const stats = await SetModel.aggregate([
    { $match: { "products.product": { $in: objectIds } } },
    { $unwind: "$products" },
    { $match: { "products.product": { $in: objectIds } } },
    {
      $group: {
        _id: "$products.product",
        count: { $sum: 1 },
      },
    },
  ]);

  const counts = new Map(
    stats.map((row) => [row._id?.toString?.() || "", row.count || 0])
  );

  products.forEach((product) => {
    const id =
      product?._id?.toString?.() ||
      product?.id?.toString?.() ||
      null;
    if (!id) return;
    assignSetCount(product, counts.get(id) || 0);
  });
}

async function fetchSetsForProduct(productId) {
  if (!productId) return [];
  const idStr = productId.toString();
  if (!mongoose.Types.ObjectId.isValid(idStr)) return [];
  const objectId = new mongoose.Types.ObjectId(idStr);
  const sets = await SetModel.find({ "products.product": objectId })
    .select("_id name slug products")
    .lean();
  return sets.map((set) => ({
    id: set._id?.toString?.() || String(set._id),
    name: set.name,
    slug: set.slug,
    productCount: Array.isArray(set.products) ? set.products.length : 0,
  }));
}

function buildProductTrTranslation(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    name: plain.name ?? "",
    description: plain.description ?? "",
    careInstructions: plain.careInstructions ?? "",
    details: Array.isArray(plain.details) ? [...plain.details] : [],
    customAttribute: plain.customAttribute
      ? {
          title: plain.customAttribute.title ?? "",
          values: Array.isArray(plain.customAttribute.values)
            ? [...plain.customAttribute.values]
            : [],
        }
      : { title: "", values: [] },
  };
}

function applyProductTrTranslation(doc, translation = {}) {
  if (!translation || typeof translation !== "object") return;
  if (translation.name !== undefined) {
    doc.name = String(translation.name).trim();
  }
  if (translation.description !== undefined) {
    doc.description = translation.description ?? "";
  }
  if (translation.careInstructions !== undefined) {
    doc.careInstructions = translation.careInstructions ?? "";
  }
  if (translation.details !== undefined) {
    doc.details = normalizeArray(translation.details);
  }
  if (translation.customAttribute && typeof translation.customAttribute === "object") {
    const target = doc.customAttribute || {};
    if (translation.customAttribute.title !== undefined) {
      target.title = String(translation.customAttribute.title || "").trim();
    }
    if (translation.customAttribute.values !== undefined) {
      target.values = normalizeArray(translation.customAttribute.values);
    }
    doc.customAttribute = target;
  }
}

function resolveDocId(doc) {
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

function attachDiscountMeta(target, sourceDoc, discount) {
  const basePrice = Number(target.price ?? sourceDoc?.price ?? 0) || 0;
  const { finalPrice, discount: normalized } = applyDiscount(
    basePrice,
    discount || null
  );
  target.price = basePrice;
  target.finalPrice = finalPrice;
  target.discount = normalized;
  target.hasDiscount = Boolean(normalized) && basePrice !== finalPrice;
}

async function buildProductDiscountMap(products = []) {
  if (!products?.length) return new Map();
  const activeDiscounts = await fetchActiveDiscounts();
  if (!activeDiscounts.length) return new Map();
  return computeProductDiscountMap(activeDiscounts, products);
}

function presentProduct(
  doc,
  lang,
  discount = null,
  { includeTranslations = true } = {}
) {
  const localized = resolveTranslation(doc, lang);
  const resolvedId =
    localized?.id ||
    localized?._id ||
    doc?._id?.toString?.() ||
    doc?.id?.toString?.() ||
    null;
  if (resolvedId) {
    const idStr = String(resolvedId);
    localized.id = idStr;
    localized._id = idStr;
  }
  attachDiscountMeta(localized, doc, discount);
  if (doc.category && typeof doc.category === "object") {
    localized.category = resolveTranslation(doc.category, lang);
    if (!includeTranslations && localized.category?.translations) {
      delete localized.category.translations;
    }
  }
  if (includeTranslations) {
    localized.translations = composeResponseTranslations(
      doc,
      buildProductTrTranslation
    );
  } else if (localized.translations) {
    delete localized.translations;
  }
  return localized;
}

// Cloudinary upload (buffer üzerinden)
async function uploadImages(files = [], folderHint = "products") {
  if (!Array.isArray(files) || !files.length) return [];
  const folder = resolveMediaFolder(folderHint);

  const uploads = files.map(async (file) => {
    const isVideo = file.mimetype?.startsWith("video/");
    const result = await uploadBufferToCloudinary(file.buffer, {
      folder,
      resource_type: isVideo ? "video" : "image",
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    };
  });

  return Promise.all(uploads);
}

export async function createProduct(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    if (lang !== DEFAULT_LANG) {
      return res.status(400).json({
        message:
          "New products must be created in the default language (tr). Please switch to TR to create the product, then edit translations in other languages.",
      });
    }
  const {
    name,
    price,
    description,
      careInstructions,
      details,
      category,
      colors,
      sizes,
      showColors,
      showSizes,
      customAttribute,
      isActive,
      listedInCatalog,
      sku,
      imageOrder,
    } = req.body;

    if (!name || price == null)
      return res
        .status(400)
        .json({ message: "Ürün adı ve fiyatı gerekli" });

    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0)
      return res.status(400).json({ message: "Fiyat geçerli bir sayı olmalı" });

    const categoryDoc = category ? await resolveCategory(category) : null;

    // Görseller → Cloudinary (direct upload destekli)
    const files = Array.isArray(req.files) ? req.files : [];
    const directImages = extractAssetList(req.body.images);
    const uploadedImages = files.length
      ? await uploadImages(files, "products")
      : [];
    const uploadedAssets = [...directImages, ...uploadedImages];
    const images = orderProductImages(
      [],
      uploadedAssets,
      parseImageOrder(imageOrder)
    );

    // 🔁 customAttribute’ı da normalize et
    const rawAttr =
      typeof customAttribute === "string"
        ? JSON.parse(customAttribute || "{}")
        : customAttribute || {};
    const normalizedAttr = {
      title: rawAttr.title ? String(rawAttr.title).trim() : "",
      values: normalizeArray(rawAttr.values),
      show: rawAttr.show === undefined ? false : !!rawAttr.show,
    };

    const doc = new Product({
      name: String(name).trim(),
      price: priceNum,
      description: description ?? "",
      careInstructions: careInstructions ?? "",
      details: normalizeArray(details),
      category: categoryDoc?._id ?? null,
      colors: normalizeArray(colors),
      sizes: normalizeArray(sizes),
      showColors: parseBool(showColors, true),
      showSizes: parseBool(showSizes, true),
      customAttribute: normalizedAttr,
      isActive: parseBool(isActive, true),
      listedInCatalog: parseBool(listedInCatalog, true),
      sku: sku ? String(sku).trim().toUpperCase() : undefined,
      images, // ← artık {url, publicId, ...} dolu
    });

    const incomingTranslations = pickLocalizedPayload(req.body);
    syncDocTranslations(
      doc,
      incomingTranslations,
      buildProductTrTranslation,
      applyProductTrTranslation
    );

    await doc.save();
    await syncProductStockRows(doc._id, req.body?.stockRows);

    const populated = await doc.populate("category");
    await hydrateProductsWithInventory([populated]);
    await annotateProductsWithSetUsage([populated]);
    const discountMap = await buildProductDiscountMap([populated]);
    const discount = discountMap.get(resolveDocId(populated)) || null;
    res.status(201).json({
      product: presentProduct(populated, lang, discount),
    });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.sku)
      return res.status(400).json({ message: "SKU zaten mevcut" });
    res.status(400).json({ message: err.message || "Oluşturma başarısız" });
  }
}

export async function listProducts(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const search = req.query.search?.trim();
    const includeHidden = parseBool(req.query.includeHidden, false);
    const category = req.query.category;
    const view = String(req.query.view || "").trim().toLowerCase();
    const isCardView = view === "card";

    const filter = {};
    if (search) filter.name = { $regex: search, $options: "i" };
    if (!includeHidden)
      Object.assign(filter, { isActive: true, listedInCatalog: true });
    if (category) {
      const c = await resolveCategory(category);
      filter.category = c._id;
    }

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: "category",
          select: "name slug ancestors translations",
        })
        .lean(),
      Product.countDocuments(filter),
    ]);

    if (!isCardView) {
      await hydrateProductsWithInventory(items);
      await annotateProductsWithSetUsage(items);
    }
    const discountMap = await buildProductDiscountMap(items);

    res.json({
      products: items.map((item) =>
        presentProduct(item, lang, discountMap.get(resolveDocId(item)) || null, {
          includeTranslations: !isCardView,
        })
      ),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Listeleme başarısız" });
  }
}

export async function getProduct(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const { idOrSlug } = req.params;
    const includeHidden = parseBool(req.query.includeHidden, false);
    const isAdmin = Boolean(req.user?.role === "admin");

    const product = isId(idOrSlug)
      ? await Product.findById(idOrSlug).populate("category")
      : await Product.findOne({ slug: idOrSlug }).populate("category");

    if (!product) return res.status(404).json({ message: "Ürün bulunamadı" });
    if (
      !includeHidden &&
      !isAdmin &&
      (!product.isActive || !product.listedInCatalog)
    ) {
      return res.status(404).json({ message: "Ürün bulunamadı" });
    }
    await hydrateProductsWithInventory([product]);
    await annotateProductsWithSetUsage([product]);
    const discountMap = await buildProductDiscountMap([product]);
    const discount = discountMap.get(resolveDocId(product)) || null;
    res.json({ product: presentProduct(product, lang, discount) });
  } catch (err) {
    res.status(500).json({ message: err.message || "Getirme başarısız" });
  }
}

export async function updateProduct(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const { idOrSlug } = req.params;
    const product = isId(idOrSlug)
      ? await Product.findById(idOrSlug)
      : await Product.findOne({ slug: idOrSlug });
    if (!product) return res.status(404).json({ message: "Ürün bulunamadı" });

    const {
      name,
      price,
      description,
      careInstructions,
      details,
      category,
      colors,
      sizes,
      showColors,
      showSizes,
      customAttribute,
      isActive,
      listedInCatalog,
      sku,
      removeImagePublicIds,
      imageOrder,
    } = req.body;

    const incomingTranslations = pickLocalizedPayload(req.body);
    const ensureLangBucket = () => {
      if (!incomingTranslations[lang]) incomingTranslations[lang] = {};
      return incomingTranslations[lang];
    };

    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (lang === DEFAULT_LANG) {
        product.name = normalizedName;
      } else {
        ensureLangBucket().name = normalizedName;
      }
    }
    if (price !== undefined) {
      const n = Number(price);
      if (!Number.isFinite(n) || n < 0)
        return res
          .status(400)
          .json({ message: "Fiyat geçerli bir sayı olmalı" });
      product.price = n;
    }
    if (description !== undefined) {
      const normalizedDescription = description == null ? "" : String(description);
      if (lang === DEFAULT_LANG) {
        product.description = normalizedDescription;
      } else {
        ensureLangBucket().description = normalizedDescription;
      }
    }
    if (careInstructions !== undefined) {
      const normalizedCare = careInstructions == null ? "" : String(careInstructions);
      if (lang === DEFAULT_LANG) {
        product.careInstructions = normalizedCare;
      } else {
        ensureLangBucket().careInstructions = normalizedCare;
      }
    }
    if (details !== undefined) {
      const normalizedDetails = normalizeArray(details);
      if (lang === DEFAULT_LANG) {
        product.details = normalizedDetails;
      } else {
        ensureLangBucket().details = normalizedDetails;
      }
    }
    if (category !== undefined) {
      let normalizedCategory =
        typeof category === "string" ? category.trim() : category;
      const shouldUnset =
        normalizedCategory === null ||
        normalizedCategory === "" ||
        (typeof normalizedCategory === "string" &&
          ["null", "undefined"].includes(normalizedCategory.toLowerCase()));

      if (shouldUnset) {
        product.category = null;
      } else {
        const categoryDoc = await resolveCategory(normalizedCategory);
        product.category = categoryDoc?._id ?? null;
      }
    }
    if (colors !== undefined) product.colors = normalizeArray(colors);
    if (sizes !== undefined) product.sizes = normalizeArray(sizes);
    if (showColors !== undefined)
      product.showColors = parseBool(showColors, true);
    if (showSizes !== undefined) product.showSizes = parseBool(showSizes, true);

    // 🔁 customAttribute güncellemesini de normalize et
    if (customAttribute !== undefined) {
      const rawAttr =
        typeof customAttribute === "string"
          ? JSON.parse(customAttribute || "{}")
          : customAttribute || {};
      const parsedAttr = {
        title: rawAttr.title ? String(rawAttr.title).trim() : "",
        values: normalizeArray(rawAttr.values),
        show: rawAttr.show === undefined ? false : !!rawAttr.show,
      };
      product.customAttribute = product.customAttribute || {
        title: "",
        values: [],
        show: parsedAttr.show,
      };
      product.customAttribute.show = parsedAttr.show;
      if (lang === DEFAULT_LANG) {
        product.customAttribute.title = parsedAttr.title;
        product.customAttribute.values = parsedAttr.values;
      } else {
        const bucket = ensureLangBucket();
        bucket.customAttribute = bucket.customAttribute || {};
        bucket.customAttribute.title = parsedAttr.title;
        bucket.customAttribute.values = parsedAttr.values;
      }
    }

    if (isActive !== undefined) product.isActive = parseBool(isActive, true);
    if (listedInCatalog !== undefined)
      product.listedInCatalog = parseBool(listedInCatalog, true);
    if (sku !== undefined)
      product.sku = sku ? String(sku).trim().toUpperCase() : undefined;

    // Görsel sil
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
        product.images = product.images.filter(
          (img) => !ids.includes(img.publicId)
        );
        await Promise.allSettled(
          ids.map((pid) => deleteFromCloudinary(pid, "image"))
        );
      }
    }

    // Yeni görseller (buffer → Cloudinary) + direct upload payload
    const files = Array.isArray(req.files) ? req.files : [];
    const directImages = extractAssetList(req.body.images);
    const uploadedImages = files.length
      ? await uploadImages(files, "products")
      : [];
    const newImages = [...directImages, ...uploadedImages];
    product.images = orderProductImages(
      product.images.filter(Boolean),
      newImages,
      parseImageOrder(imageOrder)
    );

    syncDocTranslations(
      product,
      incomingTranslations,
      buildProductTrTranslation,
      applyProductTrTranslation
    );

    await product.save();
    await syncProductStockRows(product._id, req.body?.stockRows);

    const populated = await product.populate("category");
    await hydrateProductsWithInventory([populated]);
    await annotateProductsWithSetUsage([populated]);
    const discountMap = await buildProductDiscountMap([populated]);
    const discount = discountMap.get(resolveDocId(populated)) || null;
    res.json({ product: presentProduct(populated, lang, discount) });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.sku)
      return res.status(400).json({ message: "SKU zaten mevcut" });
    res.status(400).json({ message: err.message || "Güncelleme başarısız" });
  }
}

export async function deleteProduct(req, res) {
  try {
    const { idOrSlug } = req.params;
    const product = isId(idOrSlug)
      ? await Product.findById(idOrSlug)
      : await Product.findOne({ slug: idOrSlug });
    if (!product)
      return res.status(404).json({ message: "Ürün bulunamadı" });

    const setActionRaw = req.query.setAction;
    const setAction = setActionRaw
      ? String(setActionRaw).trim().toLowerCase()
      : null;

    const relatedSets = await fetchSetsForProduct(product._id);
    const responseMeta = {};

    if (relatedSets.length) {
      if (!setAction) {
        return res.status(409).json({
          message: "Ürün bazı setlerde kullanılıyor.",
          requiresResolution: true,
          sets: relatedSets,
        });
      }

      if (!["delete_sets", "detach"].includes(setAction)) {
        return res
          .status(400)
          .json({ message: "Geçersiz setAction parametresi" });
      }

      const setObjectIds = relatedSets
        .map((set) => set.id)
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      if (setAction === "delete_sets") {
        if (setObjectIds.length) {
          await Promise.all([
            SetModel.deleteMany({ _id: { $in: setObjectIds } }),
            StockItem.deleteMany({
              ownerModel: "Set",
              owner: { $in: setObjectIds },
            }),
          ]);
        }
        responseMeta.deletedSets = relatedSets;
      } else if (setAction === "detach") {
        if (setObjectIds.length) {
          await SetModel.updateMany(
            { _id: { $in: setObjectIds } },
            { $pull: { products: { product: product._id } } }
          );

          const emptiedSets = await SetModel.find({
            _id: { $in: setObjectIds },
            $expr: { $eq: [{ $size: "$products" }, 0] },
          })
            .select("_id name slug")
            .lean();

          if (emptiedSets.length) {
            const emptyIds = emptiedSets.map((set) => set._id);
            await Promise.all([
              SetModel.deleteMany({ _id: { $in: emptyIds } }),
              StockItem.deleteMany({
                ownerModel: "Set",
                owner: { $in: emptyIds },
              }),
            ]);
            responseMeta.deletedSets = (responseMeta.deletedSets || []).concat(
              emptiedSets.map((set) => ({
                id: set._id.toString(),
                name: set.name,
                slug: set.slug,
              }))
            );
          }
        }
        responseMeta.detachedFromSets = relatedSets;
      }
    }

    const imageIds = (product.images || [])
      .map((img) => img.publicId)
      .filter(Boolean);
    if (imageIds.length) {
      await Promise.allSettled(
        imageIds.map((pid) => deleteFromCloudinary(pid, "image"))
      );
    }

    await StockItem.deleteMany({ ownerModel: "Product", owner: product._id });
    await product.deleteOne();
    res.json({ ok: true, ...responseMeta });
  } catch (err) {
    res.status(500).json({ message: err.message || "Silme başarısız" });
  }
}

export async function listProductSets(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const { idOrSlug } = req.params;
    const product = isId(idOrSlug)
      ? await Product.findById(idOrSlug)
      : await Product.findOne({ slug: idOrSlug });
    if (!product)
      return res.status(404).json({ message: "Ürün bulunamadı" });

    const sets = await fetchSetsForProduct(product._id);
    const localizedProduct = resolveTranslation(product, lang);
    res.json({
      product: {
        id: product._id.toString(),
        name: localizedProduct.name,
        slug: localizedProduct.slug,
      },
      sets,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Setler alınamadı" });
  }
}
