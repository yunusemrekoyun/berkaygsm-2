import Category from "../models/Category.js";
import Product from "../models/Product.js";
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
import { extractSingleAsset } from "../utils/uploadPayload.js";

// -------------------- helpers --------------------

const isValidObjectId = (val) =>
  typeof val === "string" && val.match(/^[0-9a-fA-F]{24}$/);

const toPlainImage = (image) => {
  if (!image) return null;
  return {
    url: image.url,
    publicId: image.publicId,
    width: image.width,
    height: image.height,
    format: image.format,
  };
};

// id'yi güvenli şekilde çıkart
function getSafeId(sourceDoc, localizedDoc) {
  const raw =
    sourceDoc?._id ??
    sourceDoc?.id ??
    localizedDoc?._id ??
    localizedDoc?.id ??
    null;

  if (raw == null) return null;
  if (typeof raw === "string") return raw;

  // Mongoose ObjectId
  if (typeof raw === "object" && typeof raw.toHexString === "function") {
    return raw.toHexString();
  }

  // Bazı durumlarda nested object gelebilir (örneğin { $oid: '...' })
  if (raw.$oid && typeof raw.$oid === "string") {
    return raw.$oid;
  }
  if (raw._id && typeof raw._id === "string") {
    return raw._id;
  }

  // Son çare: toString, ama [object Object] ise kullanma
  if (typeof raw.toString === "function") {
    const str = raw.toString();
    if (str && str !== "[object Object]") return str;
  }

  return null;
}

/**
 * sourceDoc: gerçek Mongoose Category dokümanı
 * localizedDoc: resolveTranslation(category, lang) sonucu
 */
const shapeCategory = (
  sourceDoc,
  localizedDoc,
  { includeTranslations = false } = {},
  translations = null
) => {
  if (!localizedDoc && !sourceDoc) return null;

  const plain =
    localizedDoc && typeof localizedDoc.toObject === "function"
      ? localizedDoc.toObject()
      : localizedDoc || {};

  const shaped = {
    id: getSafeId(sourceDoc, plain),
    name: plain.name,
    slug: plain.slug,
    parent: sourceDoc?.parent ? String(sourceDoc.parent) : null,
    level: sourceDoc?.level ?? plain.level,
    ancestors: Array.isArray(sourceDoc?.ancestors)
      ? sourceDoc.ancestors.map((a) => String(a))
      : Array.isArray(plain.ancestors)
      ? plain.ancestors.map((a) => String(a))
      : [],
    image: toPlainImage(sourceDoc?.image ?? plain.image),
    sortOrder: Number(sourceDoc?.sortOrder ?? plain.sortOrder ?? 0),
    createdAt: sourceDoc?.createdAt ?? plain.createdAt,
    updatedAt: sourceDoc?.updatedAt ?? plain.updatedAt,
  };

  if (includeTranslations) {
    shaped.translations = translations ?? plain.translations ?? {};
  }

  return shaped;
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  }
  return false;
};

async function resolveNextCategorySortOrder(parentId = null) {
  const filter = parentId ? { parent: parentId } : { parent: null };
  const lastSibling = await Category.findOne(filter)
    .sort({ sortOrder: -1, createdAt: -1 })
    .select("sortOrder")
    .lean();
  return Number(lastSibling?.sortOrder || 0) + 1;
}

const resolveCategoryFolder = () => {
  const instance = configureCloudinary();
  const base = (instance.uploadFolder || "ayyildiz/uploads").replace(
    /\/+$/,
    ""
  );
  return `${base}/categories`;
};

const toImagePayload = (uploadResult) => ({
  url: uploadResult.secure_url,
  publicId: uploadResult.public_id,
  width: uploadResult.width,
  height: uploadResult.height,
  format: uploadResult.format,
});

function buildCategoryTrTranslation(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    name: plain.name ?? "",
  };
}

function applyCategoryTrTranslation(doc, translation = {}) {
  if (!translation || typeof translation !== "object") return;
  if (translation.name !== undefined) {
    doc.name = translation.name;
  }
}

// -------------------- controllers --------------------

export async function createCategory(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    if (lang !== DEFAULT_LANG) {
      return res.status(400).json({
        message:
          "New categories can only be created in the default language (tr). Please switch to TR or update an existing category in other languages.",
      });
    }
    const { name, parent = null } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Kategori adı gerekli" });
    }

    let parentDoc = null;
    if (parent) {
      parentDoc = isValidObjectId(parent)
        ? await Category.findById(parent)
        : await Category.findOne({ slug: parent });
      if (!parentDoc) {
        return res.status(400).json({ message: "Üst kategori bulunamadı" });
      }
    }

    let imagePayload = null;
    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
        folder: resolveCategoryFolder(),
      });
      imagePayload = toImagePayload(uploadResult);
    } else {
      const directImage = extractSingleAsset(req.body.image);
      if (directImage) {
        imagePayload = {
          url: directImage.url,
          publicId: directImage.publicId,
          width: directImage.width,
          height: directImage.height,
          format: directImage.format,
        };
      }
    }

    const data = {
      name,
      parent: parentDoc?._id ?? null,
      sortOrder: await resolveNextCategorySortOrder(parentDoc?._id ?? null),
    };
    if (imagePayload) data.image = imagePayload;

    const category = new Category(data);

    const incomingTranslations = pickLocalizedPayload(req.body);
    syncDocTranslations(
      category,
      incomingTranslations,
      buildCategoryTrTranslation,
      applyCategoryTrTranslation
    );

    await category.save();

    const localized = resolveTranslation(category, lang);
    const translations = composeResponseTranslations(
      category,
      buildCategoryTrTranslation
    );

    res.status(201).json({
      category: shapeCategory(
        category,
        localized,
        { includeTranslations: true },
        translations
      ),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function listCategories(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const { parent } = req.query;
    const filter = {};

    if (parent === "root") filter.parent = null;
    else if (parent) {
      const parentDoc = isValidObjectId(parent)
        ? await Category.findById(parent)
        : await Category.findOne({ slug: parent });
      if (!parentDoc) {
        return res.status(400).json({ message: "Üst kategori bulunamadı" });
      }
      filter.parent = parentDoc._id;
    }

    const categories = await Category.find(filter).sort({
      level: 1,
      sortOrder: 1,
      name: 1,
    });

    res.json({
      categories: categories.map((categoryDoc) => {
        const localized = resolveTranslation(categoryDoc, lang);
        const translations = composeResponseTranslations(
          categoryDoc,
          buildCategoryTrTranslation
        );
        return shapeCategory(
          categoryDoc,
          localized,
          { includeTranslations: true },
          translations
        );
      }),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function getCategory(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const { idOrSlug } = req.params;
    const category = isValidObjectId(idOrSlug)
      ? await Category.findById(idOrSlug)
      : await Category.findOne({ slug: idOrSlug });

    if (!category) {
      return res.status(404).json({ message: "Kategori bulunamadı" });
    }

    const localized = resolveTranslation(category, lang);
    const translations = composeResponseTranslations(
      category,
      buildCategoryTrTranslation
    );

    res.json({
      category: shapeCategory(
        category,
        localized,
        { includeTranslations: true },
        translations
      ),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function updateCategory(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const { idOrSlug } = req.params;
    const {
      name,
      parent = undefined,
      removeImage = undefined,
      sortOrder = undefined,
    } = req.body;

    const category = isValidObjectId(idOrSlug)
      ? await Category.findById(idOrSlug)
      : await Category.findOne({ slug: idOrSlug });

    if (!category) {
      return res.status(404).json({ message: "Kategori bulunamadı" });
    }

    const incomingTranslations = pickLocalizedPayload(req.body) || {};

    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (lang === DEFAULT_LANG) {
        category.name = normalizedName;
      } else {
        incomingTranslations[lang] = {
          ...(incomingTranslations[lang] || {}),
          name: normalizedName,
        };
      }
    }

    if (parent !== undefined) {
      const previousParentId = category.parent ? String(category.parent) : null;
      if (!parent) {
        category.parent = null;
        if (previousParentId !== null) {
          category.sortOrder = await resolveNextCategorySortOrder(null);
        }
      } else {
        const parentDoc = isValidObjectId(parent)
          ? await Category.findById(parent)
          : await Category.findOne({ slug: parent });
        if (!parentDoc) {
          return res.status(400).json({ message: "Üst kategori bulunamadı" });
        }
        if (String(parentDoc._id) === String(category._id)) {
          return res
            .status(400)
            .json({ message: "Kategori kendi üstü olamaz" });
        }
        if (parentDoc.ancestors?.includes(category._id)) {
          return res
            .status(400)
            .json({ message: "Alt kategori üst olarak seçilemez" });
        }
        category.parent = parentDoc._id;
        if (previousParentId !== String(parentDoc._id)) {
          category.sortOrder = await resolveNextCategorySortOrder(parentDoc._id);
        }
      }
    }

    if (sortOrder !== undefined) {
      const normalizedSortOrder = Number(sortOrder);
      if (Number.isFinite(normalizedSortOrder)) {
        category.sortOrder = normalizedSortOrder;
      }
    }

    if (req.file) {
      if (category.image?.publicId) {
        await deleteFromCloudinary(category.image.publicId).catch(() => {});
      }
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer, {
        folder: resolveCategoryFolder(),
      });
      category.image = toImagePayload(uploadResult);
      category.markModified("image");
    } else {
      const directImage = extractSingleAsset(req.body.image);
      if (directImage) {
        if (category.image?.publicId) {
          await deleteFromCloudinary(category.image.publicId).catch(() => {});
        }
        category.image = {
          url: directImage.url,
          publicId: directImage.publicId,
          width: directImage.width,
          height: directImage.height,
          format: directImage.format,
        };
        category.markModified("image");
      } else if (removeImage !== undefined && parseBoolean(removeImage)) {
        if (category.image?.publicId) {
          await deleteFromCloudinary(category.image.publicId).catch(() => {});
        }
        category.image = undefined;
        category.markModified("image");
      }
    }

    syncDocTranslations(
      category,
      incomingTranslations,
      buildCategoryTrTranslation,
      applyCategoryTrTranslation
    );

    await category.save();

    const localized = resolveTranslation(category, lang);
    const translations = composeResponseTranslations(
      category,
      buildCategoryTrTranslation
    );

    res.json({
      category: shapeCategory(
        category,
        localized,
        { includeTranslations: true },
        translations
      ),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function deleteCategory(req, res) {
  try {
    const { idOrSlug } = req.params;
    const category = isValidObjectId(idOrSlug)
      ? await Category.findById(idOrSlug)
      : await Category.findOne({ slug: idOrSlug });

    if (!category) {
      return res.status(404).json({ message: "Kategori bulunamadı" });
    }

    const hasChildren = await Category.exists({ parent: category._id });
    if (hasChildren) {
      return res.status(400).json({
        message: "Kategori alt kategorilere sahip, silinemez",
      });
    }

    const hasProducts = await Product.exists({ category: category._id });
    if (hasProducts) {
      return res
        .status(400)
        .json({ message: "Kategoriye bağlı ürünler var, silinemez" });
    }

    if (category.image?.publicId) {
      await deleteFromCloudinary(category.image.publicId).catch(() => {});
    }

    await Category.findByIdAndDelete(category._id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function reorderCategories(req, res) {
  try {
    const parent =
      req.body?.parent === undefined || req.body?.parent === null || req.body?.parent === ""
        ? null
        : String(req.body.parent);
    const orderedIds = Array.isArray(req.body?.orderedIds)
      ? req.body.orderedIds.map((id) => String(id)).filter(isValidObjectId)
      : [];

    if (!orderedIds.length) {
      return res.status(400).json({ message: "Siralama listesi gerekli" });
    }

    const categories = await Category.find({ _id: { $in: orderedIds } })
      .select("_id parent")
      .lean();

    if (categories.length !== orderedIds.length) {
      return res.status(400).json({ message: "Bazi kategoriler bulunamadi" });
    }

    const parentKey = parent && isValidObjectId(parent) ? parent : null;
    const hasInvalidParent = categories.some((category) => {
      const categoryParent = category.parent ? String(category.parent) : null;
      return categoryParent !== parentKey;
    });

    if (hasInvalidParent) {
      return res
        .status(400)
        .json({ message: "Sadece ayni ust kategori altindaki kayitlar siralanabilir" });
    }

    await Category.bulkWrite(
      orderedIds.map((id, index) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { sortOrder: index } },
        },
      }))
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function getCategoryTree(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const categories = await Category.find()
      .sort({ level: 1, sortOrder: 1, name: 1 })
      .lean();

    const byId = new Map();
    categories.forEach((cat) => {
      const localized = resolveTranslation(cat, lang);
      const id = String(cat._id);
      byId.set(id, {
        ...localized,
        _id: id,
        parent: cat.parent ? String(cat.parent) : null,
        children: [],
      });
    });

    const roots = [];
    byId.forEach((cat) => {
      if (cat.parent) {
        const parent = byId.get(cat.parent);
        if (parent) parent.children.push(cat);
      } else {
        roots.push(cat);
      }
    });

    const format = (node) => ({
      id: node._id,
      name: node.name,
      slug: node.slug,
      parent: node.parent,
      level: node.level,
      image: toPlainImage(node.image),
      sortOrder: Number(node.sortOrder || 0),
      children: node.children.map(format),
    });

    res.json({ categories: roots.map(format) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
