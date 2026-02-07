import ShippingConfig from "../models/ShippingConfig.js";
import {
  DEFAULT_LANG,
  normalizeLang,
  resolveTranslation,
  pickLocalizedPayload,
  syncDocTranslations,
  composeResponseTranslations,
} from "../utils/i18n.js";

function shape(config, { includeTranslations = false } = {}, translations = null) {
  if (!config) return null;
  const shaped = {
    id: config._id?.toString?.() || config.id,
    name: config.name,
    fee: Number(config.fee || 0),
    freeThreshold: Number(config.freeThreshold || 0),
    updatedAt: config.updatedAt,
  };

  if (includeTranslations) {
    shaped.translations = translations ?? config.translations ?? {};
  }

  return shaped;
}

function buildShippingTrTranslation(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    name: plain.name ?? "",
  };
}

function applyShippingTrTranslation(doc, translation = {}) {
  if (!translation || typeof translation !== "object") return;
  if (translation.name !== undefined) {
    doc.name = String(translation.name || "").trim();
  }
}

export async function getShippingConfig(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const config = await ShippingConfig.getSingleton();
    const localized = resolveTranslation(config, lang);
    const translations = composeResponseTranslations(
      config,
      buildShippingTrTranslation
    );
    res.json({
      shipping: shape(localized, { includeTranslations: true }, translations),
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Kargo ayarları yüklenemedi" });
  }
}

export async function updateShippingConfig(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const isDefaultLang = lang === DEFAULT_LANG;
    const { name, fee, freeThreshold } = req.body || {};
    const config = await ShippingConfig.getSingleton();

    if (fee !== undefined) {
      const value = Number(fee);
      if (!Number.isFinite(value) || value < 0)
        return res.status(400).json({ message: "Kargo ücreti 0 veya daha büyük olmalı" });
      config.fee = value;
    }

    if (freeThreshold !== undefined) {
      const value = Number(freeThreshold);
      if (!Number.isFinite(value) || value < 0)
        return res
          .status(400)
          .json({ message: "Ücretsiz kargo limiti 0 veya daha büyük olmalı" });
      config.freeThreshold = value;
    }

    const incomingTranslations = pickLocalizedPayload(req.body) || {};
    const ensureLangBucket = () => {
      const bucketLang = normalizeLang(lang);
      incomingTranslations[bucketLang] = {
        ...(incomingTranslations[bucketLang] || {}),
      };
      return incomingTranslations[bucketLang];
    };

    if (name !== undefined) {
      const normalizedName = String(name).trim() || "Standart Kargo";
      if (isDefaultLang) {
        config.name = normalizedName;
      } else {
        ensureLangBucket().name = normalizedName;
      }
    }

    syncDocTranslations(
      config,
      incomingTranslations,
      buildShippingTrTranslation,
      applyShippingTrTranslation
    );

    await config.save();

    const localized = resolveTranslation(config, lang);
    const translations = composeResponseTranslations(
      config,
      buildShippingTrTranslation
    );
    res.json({
      shipping: shape(localized, { includeTranslations: true }, translations),
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: error.message || "Kargo ayarları güncellenemedi" });
  }
}
