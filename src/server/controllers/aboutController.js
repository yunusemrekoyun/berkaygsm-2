// controllers/aboutController.js
import About from "../models/About.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";
import { resolveMediaFolder } from "../media/config.js";
import { extractSingleAsset } from "../utils/uploadPayload.js";
import { normalizeArray, parseBoolean } from "../utils/productHelpers.js";
import {
  DEFAULT_LANG,
  normalizeLang,
  resolveTranslation,
  composeResponseTranslations,
} from "../utils/i18n.js";

function toPlain(value) {
  if (!value) return {};
  if (typeof value.toObject === "function") return value.toObject();
  return { ...value };
}

function buildAboutTrTranslation(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const dotBlocks = Array.isArray(plain.dotBlocks) ? plain.dotBlocks : [];
  const stats = Array.isArray(plain.stats) ? plain.stats : [];
  const ctas = Array.isArray(plain.ctas) ? plain.ctas : [];

  return {
    heroTitle: plain.heroTitle ?? "",
    heroSubtitle: plain.heroSubtitle ?? "",
    dotBlocks: dotBlocks.map((block) => ({
      title: block?.title ?? "",
      text: block?.text ?? "",
    })),
    stats: stats.map((stat) => ({
      value: stat?.value ?? "",
      label: stat?.label ?? "",
    })),
    materialsTitle: plain.materialsTitle ?? "",
    materialsText: plain.materialsText ?? "",
    materialsBullets: Array.isArray(plain.materialsBullets)
      ? [...plain.materialsBullets]
      : [],
    ctaTitle: plain.ctaTitle ?? "",
    ctaSubtitle: plain.ctaSubtitle ?? "",
    ctas: ctas.map((cta) => ({
      text: cta?.text ?? "",
    })),
  };
}

function applyAboutTrTranslationToDoc(doc, translation = {}) {
  if (!translation || typeof translation !== "object") return;

  const assignScalar = (field) => {
    if (translation[field] !== undefined) {
      doc[field] = translation[field];
    }
  };

  [
    "heroTitle",
    "heroSubtitle",
    "materialsTitle",
    "materialsText",
    "ctaTitle",
    "ctaSubtitle",
  ].forEach(assignScalar);

  if (translation.materialsBullets !== undefined) {
    doc.materialsBullets = Array.isArray(translation.materialsBullets)
      ? [...translation.materialsBullets]
      : [];
  }

  if (Array.isArray(translation.dotBlocks)) {
    const current = Array.isArray(doc.dotBlocks) ? doc.dotBlocks : [];
    doc.dotBlocks = current.map((block, index) => {
      const base = toPlain(block);
      const localized = translation.dotBlocks[index] || {};
      return {
        ...base,
        title:
          localized.title !== undefined ? localized.title : base.title ?? "",
        text: localized.text !== undefined ? localized.text : base.text ?? "",
      };
    });
  }

  if (Array.isArray(translation.stats)) {
    const current = Array.isArray(doc.stats) ? doc.stats : [];
    doc.stats = current.map((stat, index) => {
      const base = toPlain(stat);
      const localized = translation.stats[index] || {};

      if (localized.value !== undefined) {
        base.value = localized.value;
      }
      if (localized.label !== undefined) {
        base.label = localized.label;
      }
      return base;
    });
  }

  if (Array.isArray(translation.ctas)) {
    const current = Array.isArray(doc.ctas) ? doc.ctas : [];
    doc.ctas = current.map((cta, index) => {
      const base = toPlain(cta);
      const localized = translation.ctas[index] || {};
      if (localized.text !== undefined) {
        base.text = localized.text;
      }
      return base;
    });
  }
}

function applyAboutLocalizedArrays(resolved, translation = {}) {
  if (!translation || typeof translation !== "object") return resolved;
  const next = { ...resolved };

  const assignIfDefined = (field) => {
    const value = translation[field];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      next[field] = value;
    }
  };

  [
    "heroTitle",
    "heroSubtitle",
    "materialsTitle",
    "materialsText",
    "ctaTitle",
    "ctaSubtitle",
  ].forEach(assignIfDefined);

  if (Array.isArray(translation.materialsBullets)) {
    const filtered = translation.materialsBullets.filter((item) =>
      String(item || "").trim()
    );
    if (filtered.length) {
      next.materialsBullets = filtered;
    }
  }

  const mergeList = (base = [], overrides = [], keys = []) => {
    if (!Array.isArray(base) || !base.length) return base;
    return base.map((item, index) => {
      const override = overrides[index] || {};
      const merged = { ...item };
      keys.forEach((key) => {
        const val = override[key];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          merged[key] = val;
        }
      });
      return merged;
    });
  };

  if (Array.isArray(next.dotBlocks)) {
    next.dotBlocks = mergeList(
      next.dotBlocks,
      Array.isArray(translation.dotBlocks) ? translation.dotBlocks : [],
      ["title", "text"]
    );
  }

  if (Array.isArray(next.stats)) {
    next.stats = mergeList(
      next.stats,
      Array.isArray(translation.stats) ? translation.stats : [],
      ["label", "value"]
    );
  }

  if (Array.isArray(next.ctas)) {
    next.ctas = mergeList(
      next.ctas,
      Array.isArray(translation.ctas) ? translation.ctas : [],
      ["text"]
    );
  }

  return next;
}

async function getOrCreateAbout() {
  let doc = await About.findOne({ key: "about" });
  if (!doc) {
    doc = await About.create({ key: "about" });
  }
  return doc;
}

function shapeImageResult(cld) {
  if (!cld) return null;
  return {
    url: cld.secure_url,
    publicId: cld.public_id,
    width: cld.width,
    height: cld.height,
    format: cld.format,
  };
}

export async function getAbout(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const doc = await getOrCreateAbout();

    const translations = composeResponseTranslations(
      doc,
      buildAboutTrTranslation
    );

    const rawLangTranslation = doc?.translations?.[lang];
    const langTranslation =
      rawLangTranslation?.toObject?.() ?? rawLangTranslation ?? {};

    let resolved = resolveTranslation(doc, lang);
    resolved = applyAboutLocalizedArrays(resolved, langTranslation);
    resolved.translations = translations;

    res.json({ about: resolved });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

export async function updateAbout(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const isDefaultLang = lang === DEFAULT_LANG;

    let doc = await About.findOne({ key: "about" });
    if (!doc) {
      doc = await About.create({ key: "about" });
    }

    // translations string -> object
    let translationsPayload = {};
    if (typeof req.body.translations === "string") {
      try {
        translationsPayload = JSON.parse(req.body.translations);
      } catch {
        translationsPayload = {};
      }
    } else if (
      req.body.translations &&
      typeof req.body.translations === "object"
    ) {
      translationsPayload = req.body.translations;
    }

    const incomingTranslations = translationsPayload || {};

    // Eğer TR çevirisi translations içinde geldiyse, ana dokümana uygula
    const trIncoming = incomingTranslations[DEFAULT_LANG];
    if (trIncoming) {
      applyAboutTrTranslationToDoc(doc, trIncoming);
    }

    // Varsayılan dil alanları (TR) – klasik form submit
    if (isDefaultLang) {
      const fields = [
        "heroTitle",
        "heroSubtitle",
        "materialsTitle",
        "materialsText",
        "ctaTitle",
        "ctaSubtitle",
      ];

      fields.forEach((f) => {
        if (req.body[f] !== undefined) {
          doc[f] = String(req.body[f]);
        }
      });

      if (req.body.dotBlocks !== undefined) {
        let payload = req.body.dotBlocks;
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch {
            payload = [];
          }
        }
        if (Array.isArray(payload)) {
          doc.dotBlocks = payload
            .map((b) => ({
              title: String(b?.title || "").trim(),
              text: String(b?.text || "").trim(),
            }))
            .filter((b) => b.title && b.text);
        }
      }

      if (req.body.stats !== undefined) {
        let payload = req.body.stats;
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch {
            payload = [];
          }
        }
        if (Array.isArray(payload)) {
          doc.stats = payload
            .map((s) => ({
              value: String(s?.value || "").trim(),
              label: String(s?.label || "").trim(),
            }))
            .filter((s) => s.value && s.label);
        }
      }

      if (req.body.materialsBullets !== undefined) {
        const arr = normalizeArray(req.body.materialsBullets);
        doc.materialsBullets = arr;
      }

      if (req.body.ctas !== undefined) {
        let payload = req.body.ctas;
        if (typeof payload === "string") {
          try {
            payload = JSON.parse(payload);
          } catch {
            payload = [];
          }
        }
        if (Array.isArray(payload)) {
          doc.ctas = payload
            .map((c) => ({
              text: String(c?.text || "").trim(),
              to: String(c?.to || "").trim(),
              variant:
                String(c?.variant || "primary").toLowerCase() === "secondary"
                  ? "secondary"
                  : "primary",
            }))
            .filter((c) => c.text && c.to);
        }
      }

      const removeHeroImage = parseBoolean(req.body.removeHeroImage, false);
      const removeLeftImage = parseBoolean(req.body.removeLeftImage, false);
      const removeMaterialsImage = parseBoolean(
        req.body.removeMaterialsImage,
        false
      );

      const deletions = [];
      if (removeHeroImage && doc.heroImage?.publicId) {
        deletions.push(deleteFromCloudinary(doc.heroImage.publicId));
        doc.heroImage = null;
      }
      if (removeLeftImage && doc.leftImage?.publicId) {
        deletions.push(deleteFromCloudinary(doc.leftImage.publicId));
        doc.leftImage = null;
      }
      if (removeMaterialsImage && doc.materialsImage?.publicId) {
        deletions.push(deleteFromCloudinary(doc.materialsImage.publicId));
        doc.materialsImage = null;
      }
      if (deletions.length) await Promise.allSettled(deletions);

      const files = req.files || {};
      const directHero = extractSingleAsset(req.body.heroImage);
      const directLeft = extractSingleAsset(req.body.leftImage);
      const directMaterials = extractSingleAsset(req.body.materialsImage);

      if (files.heroImage?.[0]?.buffer) {
        const up = await uploadBufferToCloudinary(files.heroImage[0].buffer, {
          folder: resolveMediaFolder("about"),
        });
        doc.heroImage = shapeImageResult(up);
      } else if (directHero) {
        doc.heroImage = {
          url: directHero.url,
          publicId: directHero.publicId,
          width: directHero.width,
          height: directHero.height,
          format: directHero.format,
        };
      }
      if (files.leftImage?.[0]?.buffer) {
        const up = await uploadBufferToCloudinary(files.leftImage[0].buffer, {
          folder: resolveMediaFolder("about"),
        });
        doc.leftImage = shapeImageResult(up);
      } else if (directLeft) {
        doc.leftImage = {
          url: directLeft.url,
          publicId: directLeft.publicId,
          width: directLeft.width,
          height: directLeft.height,
          format: directLeft.format,
        };
      }
      if (files.materialsImage?.[0]?.buffer) {
        const up = await uploadBufferToCloudinary(
          files.materialsImage[0].buffer,
          {
            folder: resolveMediaFolder("about"),
          }
        );
        doc.materialsImage = shapeImageResult(up);
      } else if (directMaterials) {
        doc.materialsImage = {
          url: directMaterials.url,
          publicId: directMaterials.publicId,
          width: directMaterials.width,
          height: directMaterials.height,
          format: directMaterials.format,
        };
      }
    }

    // Çevirileri doc.translations içine manuel merge et
    doc.translations = doc.translations || {};

    // TR snapshotını her kayıtta güncelle
    doc.translations[DEFAULT_LANG] = buildAboutTrTranslation(doc);

    if (incomingTranslations && Object.keys(incomingTranslations).length) {
      Object.entries(incomingTranslations).forEach(([lng, patch]) => {
        if (!patch || typeof patch !== "object") return;
        if (lng === DEFAULT_LANG) return; // TR zaten doc'tan rebuild edildi

        const currentRaw = doc.translations[lng];
        const current =
          currentRaw && typeof currentRaw.toObject === "function"
            ? currentRaw.toObject()
            : currentRaw || {};

        const next = { ...current };

        // basit alanlar
        const scalarFields = [
          "heroTitle",
          "heroSubtitle",
          "materialsTitle",
          "materialsText",
          "ctaTitle",
          "ctaSubtitle",
        ];
        scalarFields.forEach((f) => {
          if (patch[f] !== undefined) {
            next[f] = patch[f];
          }
        });

        // bullets
        if (Array.isArray(patch.materialsBullets)) {
          next.materialsBullets = patch.materialsBullets
            .map((x) => String(x || "").trim())
            .filter(Boolean);
        }

        // dotBlocks
        if (Array.isArray(patch.dotBlocks)) {
          next.dotBlocks = patch.dotBlocks.map((b) => ({
            title: (b?.title ?? "").trim(),
            text: (b?.text ?? "").trim(),
          }));
        }

        // stats
        if (Array.isArray(patch.stats)) {
          next.stats = patch.stats.map((s) => ({
            value: (s?.value ?? "").trim(),
            label: (s?.label ?? "").trim(),
          }));
        }

        // ctas
        if (Array.isArray(patch.ctas)) {
          next.ctas = patch.ctas.map((c) => ({
            text: (c?.text ?? "").trim(),
          }));
        }

        doc.translations[lng] = next;
      });
    }

    await doc.save();

    const translations = composeResponseTranslations(
      doc,
      buildAboutTrTranslation
    );
    const rawLangTranslation = doc?.translations?.[lang];
    const langTranslation =
      rawLangTranslation?.toObject?.() ?? rawLangTranslation ?? {};
    let resolved = resolveTranslation(doc, lang);
    resolved = applyAboutLocalizedArrays(resolved, langTranslation);
    resolved.translations = translations;

    res.json({ about: resolved });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}
