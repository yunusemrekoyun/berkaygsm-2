import Hero from "../models/Hero.js";
import Category from "../models/Category.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";
import { extractSingleAsset } from "../utils/uploadPayload.js";
import { configureCloudinary } from "../config/cloudinary.js";
import {
  DEFAULT_LANG,
  normalizeLang,
  resolveTranslation,
  pickLocalizedPayload,
  syncDocTranslations,
  composeResponseTranslations,
} from "../utils/i18n.js";

const isValidObjectId = (val) =>
  typeof val === "string" && /^[0-9a-fA-F]{24}$/.test(val);

const toPlainImage = (image) =>
  image
    ? {
        url: image.url,
        publicId: image.publicId,
        width: image.width,
        height: image.height,
        format: image.format,
      }
    : null;

const toPlainVideo = (video) =>
  video
    ? {
        url: video.url,
        publicId: video.publicId,
        width: video.width,
        height: video.height,
        duration: video.duration,
        format: video.format,
      }
    : null;

const resolveFolder = () => {
  const instance = configureCloudinary();
  const base = (instance.uploadFolder || "ayyildiz/uploads").replace(
    /\/+$/,
    ""
  );
  return `${base}/heroes`;
};

const shapeHero = (
  doc,
  { includeTranslations = false } = {},
  translations = null
) => {
  const id = doc._id;

  // SHOP => /shop, CATEGORIES => /shop?category=<firstId>
  let computedLink = "/shop";
  if (doc.target?.type === "CATEGORIES" && doc.target?.categories?.length) {
    const first = String(doc.target.categories[0]);
    const encoded = encodeURIComponent(first);
    computedLink = `/shop?category=${encoded}`;
  }

  const shaped = {
    id,
    title: doc.title,
    subtitle: doc.subtitle,
    buttonText: doc.buttonText || "",
    image: toPlainImage(doc.image),
    video: toPlainVideo(doc.video),
    target: {
      type: doc.target?.type || "SHOP",
      categories: (doc.target?.categories || []).map(String),
    },
    computedLink,
    isActive: !!doc.isActive,
    sortOrder: Number(doc.sortOrder || 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };

  if (includeTranslations) {
    shaped.translations = translations ?? doc.translations ?? {};
  }

  return shaped;
};

async function uploadMedia(file) {
  if (!file) return { image: null, video: null };
  const isImage = file.mimetype?.startsWith("image/");
  const isVideo = file.mimetype?.startsWith("video/");

  if (!isImage && !isVideo) {
    throw new Error("Unsupported media. Only image/* or video/* allowed.");
  }

  const uploadResult = await uploadBufferToCloudinary(file.buffer, {
    folder: resolveFolder(),
    resource_type: isVideo ? "video" : "image",
  });

  if (isImage) {
    return {
      image: {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
      },
      video: null,
    };
  }
  return {
    image: null,
    video: {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      width: uploadResult.width,
      height: uploadResult.height,
      duration: uploadResult.duration,
      format: uploadResult.format,
    },
  };
}

function normalizeDirectMedia(payload) {
  const asset = extractSingleAsset(payload);
  if (!asset) return { image: null, video: null };
  const isVideo =
    String(asset.resourceType || "").toLowerCase() === "video";
  if (isVideo) {
    return {
      image: null,
      video: {
        url: asset.url,
        publicId: asset.publicId,
        width: asset.width,
        height: asset.height,
        duration: asset.duration,
        format: asset.format,
      },
    };
  }
  return {
    image: {
      url: asset.url,
      publicId: asset.publicId,
      width: asset.width,
      height: asset.height,
      format: asset.format,
    },
    video: null,
  };
}

async function ensureCategoriesExist(ids = []) {
  if (!ids.length) return [];
  const validIds = ids.filter((x) => isValidObjectId(String(x)));
  if (!validIds.length) throw new Error("Invalid category id(s).");
  const count = await Category.countDocuments({ _id: { $in: validIds } });
  if (count !== validIds.length) {
    throw new Error("Some categories do not exist.");
  }
  return validIds;
}

function buildHeroTrTranslation(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    title: plain.title ?? "",
    subtitle: plain.subtitle ?? "",
    buttonText: plain.buttonText ?? "",
  };
}

function applyHeroTrTranslation(doc, translation = {}) {
  if (!translation || typeof translation !== "object") return;
  if (translation.title !== undefined) {
    doc.title = String(translation.title);
  }
  if (translation.subtitle !== undefined) {
    doc.subtitle = String(translation.subtitle);
  }
  if (translation.buttonText !== undefined) {
    doc.buttonText = translation.buttonText ?? "";
  }
}

/* --------- CRUD --------- */

export async function createHero(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    if (lang !== DEFAULT_LANG) {
      return res.status(400).json({
        message:
          "New hero slides must be created in the default language (tr). Please switch to TR to create the hero, then edit translations in other languages.",
      });
    }
    const { title, subtitle, buttonText, targetType = "SHOP" } = req.body;

    if (!title || !subtitle) {
      return res
        .status(400)
        .json({ message: "title and subtitle are required" });
    }

    const payload = { type: String(targetType).toUpperCase() };
    if (!["SHOP", "CATEGORIES"].includes(payload.type)) {
      return res.status(400).json({ message: "Invalid target type" });
    }

    if (payload.type === "CATEGORIES") {
      const raw =
        req.body.categories ??
        req.body["target.categories"] ??
        req.body["targetCategories"];
      const arr = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
        ? raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      payload.categories = await ensureCategoriesExist(arr);
      if (!payload.categories.length) {
        return res.status(400).json({
          message: "CATEGORIES target requires at least one id",
        });
      }
    } else {
      payload.categories = [];
    }

    const directMedia = normalizeDirectMedia(req.body.media);
    if (!req.file && !directMedia.image && !directMedia.video) {
      return res.status(400).json({
        message: "Media file is required (image or video)",
      });
    }
    const { image, video } = req.file ? await uploadMedia(req.file) : directMedia;

    const hero = new Hero({
      title,
      subtitle,
      buttonText: buttonText || "",
      image,
      video,
      target: payload,
      isActive: req.body.isActive === "false" ? false : true,
      sortOrder: Number(req.body.sortOrder || 0),
    });

    const incomingTranslations = pickLocalizedPayload(req.body);
    syncDocTranslations(
      hero,
      incomingTranslations,
      buildHeroTrTranslation,
      applyHeroTrTranslation
    );

    await hero.save();

    const localized = resolveTranslation(hero, lang);
    const translations = composeResponseTranslations(
      hero,
      buildHeroTrTranslation
    );

    res.status(201).json({
      hero: shapeHero(localized, { includeTranslations: true }, translations),
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

export async function listHeroes(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const includeInactive =
      String(req.query.includeInactive || "").toLowerCase() === "true";
    const filter = includeInactive ? {} : { isActive: true };
    const heroes = await Hero.find(filter).sort({ sortOrder: 1, createdAt: -1 });
    res.json({
      heroes: heroes.map((heroDoc) => {
        const localized = resolveTranslation(heroDoc, lang);
        const translations = composeResponseTranslations(
          heroDoc,
          buildHeroTrTranslation
        );
        return shapeHero(
          localized,
          { includeTranslations: true },
          translations
        );
      }),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

export async function getHero(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const { id } = req.params;
    const hero = await Hero.findById(id);
    if (!hero) return res.status(404).json({ message: "Hero not found" });
    const localized = resolveTranslation(hero, lang);
    const translations = composeResponseTranslations(
      hero,
      buildHeroTrTranslation
    );
    res.json({
      hero: shapeHero(
        localized,
        { includeTranslations: true },
        translations
      ),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

export async function updateHero(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const { id } = req.params;
    const hero = await Hero.findById(id);
    if (!hero) return res.status(404).json({ message: "Hero not found" });

    const { title, subtitle, buttonText, targetType } = req.body;

    const incomingTranslations = pickLocalizedPayload(req.body);
    const ensureLangBucket = () => {
      const bucketLang = normalizeLang(lang);
      incomingTranslations[bucketLang] = {
        ...(incomingTranslations[bucketLang] || {}),
      };
      return incomingTranslations[bucketLang];
    };

    if (title !== undefined) {
      const normalizedTitle = String(title).trim();
      if (lang === DEFAULT_LANG) {
        hero.title = normalizedTitle;
      } else {
        ensureLangBucket().title = normalizedTitle;
      }
    }
    if (subtitle !== undefined) {
      const normalizedSubtitle = String(subtitle).trim();
      if (lang === DEFAULT_LANG) {
        hero.subtitle = normalizedSubtitle;
      } else {
        ensureLangBucket().subtitle = normalizedSubtitle;
      }
    }
    if (buttonText !== undefined) {
      const normalizedButtonText = buttonText == null ? "" : String(buttonText);
      if (lang === DEFAULT_LANG) {
        hero.buttonText = normalizedButtonText;
      } else {
        ensureLangBucket().buttonText = normalizedButtonText;
      }
    }

    if (targetType !== undefined) {
      const t = String(targetType).toUpperCase();
      if (!["SHOP", "CATEGORIES"].includes(t)) {
        return res.status(400).json({ message: "Invalid target type" });
      }
      hero.target.type = t;
      if (t === "SHOP") hero.target.categories = [];
    }

    const rawCats =
      req.body.categories ??
      req.body["target.categories"] ??
      req.body["targetCategories"];
    if (rawCats !== undefined) {
      const arr = Array.isArray(rawCats)
        ? rawCats
        : typeof rawCats === "string"
        ? rawCats
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const valid = await ensureCategoriesExist(arr);
      hero.target.categories = valid;
      if (hero.target.type === "CATEGORIES" && !valid.length) {
        return res.status(400).json({
          message: "CATEGORIES target requires at least one id",
        });
      }
    }

    const directMedia = normalizeDirectMedia(req.body.media);
    const hasDirectMedia = !!(directMedia.image || directMedia.video);

    // Yeni medya geldiyse eskileri doğru resource_type ile sil
    if (req.file || hasDirectMedia) {
      if (hero.image?.publicId) {
        await deleteFromCloudinary(hero.image.publicId, "image").catch(
          () => {}
        );
      }
      if (hero.video?.publicId) {
        await deleteFromCloudinary(hero.video.publicId, "video").catch(
          () => {}
        );
      }
      const { image, video } = req.file
        ? await uploadMedia(req.file)
        : directMedia;
      hero.image = image;
      hero.video = video;
    }

    // Medya kaldırma
    if (req.body.removeMedia === "true" && !req.file && !hasDirectMedia) {
      if (hero.image?.publicId) {
        await deleteFromCloudinary(hero.image.publicId, "image").catch(
          () => {}
        );
      }
      if (hero.video?.publicId) {
        await deleteFromCloudinary(hero.video.publicId, "video").catch(
          () => {}
        );
      }
      hero.image = null;
      hero.video = null;
    }

    if (req.body.isActive !== undefined) {
      hero.isActive = String(req.body.isActive).toLowerCase() !== "false";
    }
    if (req.body.sortOrder !== undefined) {
      hero.sortOrder = Number(req.body.sortOrder) || 0;
    }
    syncDocTranslations(
      hero,
      incomingTranslations,
      buildHeroTrTranslation,
      applyHeroTrTranslation
    );

    await hero.save();
    const localized = resolveTranslation(hero, lang);
    const translations = composeResponseTranslations(
      hero,
      buildHeroTrTranslation
    );
    res.json({
      hero: shapeHero(
        localized,
        { includeTranslations: true },
        translations
      ),
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

export async function deleteHero(req, res) {
  try {
    const { id } = req.params;
    const hero = await Hero.findById(id);
    if (!hero) return res.status(404).json({ message: "Hero not found" });

    if (hero.image?.publicId) {
      await deleteFromCloudinary(hero.image.publicId, "image").catch(() => {});
    }
    if (hero.video?.publicId) {
      await deleteFromCloudinary(hero.video.publicId, "video").catch(() => {});
    }

    await hero.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

/** Toplu sıralama güncelleme */
export async function reorderHeroes(req, res) {
  try {
    const list = Array.isArray(req.body?.orders) ? req.body.orders : [];
    const ops = list
      .filter((x) => isValidObjectId(String(x?.id)))
      .map((x) => ({
        updateOne: {
          filter: { _id: x.id },
          update: { $set: { sortOrder: Number(x.sortOrder || 0) } },
        },
      }));
    if (ops.length) await Hero.bulkWrite(ops);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}
