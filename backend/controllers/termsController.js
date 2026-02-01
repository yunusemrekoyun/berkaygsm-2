// backend/controllers/termsController.js
import Terms from "../models/Terms.js";
import {
  DEFAULT_LANG,
  normalizeLang,
  resolveTranslation,
  pickLocalizedPayload,
  syncDocTranslations,
  composeResponseTranslations,
} from "../utils/i18n.js";

const ensureArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x ?? "")).filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x ?? "")).filter(Boolean);
      }
    } catch {}
    return v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const shape = (doc, { includeTranslations = false } = {}, translations = null) => {
  if (!doc) return null;
  const d = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const shaped = {
    id: d._id?.toString?.() || d.id,
    heroTitle: d.heroTitle || "Terms of Service",
    heroIntro: d.heroIntro || "",
    sections: Array.isArray(d.sections) ? d.sections : [],
    footerNote: d.footerNote || "", // ← ÖNEMLİ (public/manage dönüşünde var)
    isActive: d.isActive !== false,
    seo: {
      title: d.seo?.title || "",
      description: d.seo?.description || "",
      keywords: Array.isArray(d.seo?.keywords) ? d.seo.keywords : [],
    },
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
  if (includeTranslations) {
    shaped.translations = translations ?? d.translations ?? {};
  }
  return shaped;
};

function buildTermsTrTranslation(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    heroTitle: plain.heroTitle ?? "",
    heroIntro: plain.heroIntro ?? "",
    sections: Array.isArray(plain.sections)
      ? plain.sections.map((section) => ({
          title: section?.title ?? "",
          paragraphs: Array.isArray(section?.paragraphs)
            ? section.paragraphs.map((p) => String(p ?? ""))
            : [],
        }))
      : [],
    footerNote: plain.footerNote ?? "",
    seo: {
      title: plain.seo?.title ?? "",
      description: plain.seo?.description ?? "",
      keywords: Array.isArray(plain.seo?.keywords)
        ? plain.seo.keywords.map((item) => String(item ?? ""))
        : [],
    },
  };
}

function applyTermsTrTranslation(doc, translation = {}) {
  if (!translation || typeof translation !== "object") return;
  if (translation.heroTitle !== undefined) {
    doc.heroTitle = String(translation.heroTitle ?? "").trim();
  }
  if (translation.heroIntro !== undefined) {
    doc.heroIntro = String(translation.heroIntro ?? "").trim();
  }
  if (Array.isArray(translation.sections)) {
    doc.sections = translation.sections.map((section) => ({
      title: String(section?.title ?? "").trim(),
      paragraphs: ensureArray(section?.paragraphs),
    }));
  }
  if (translation.footerNote !== undefined) {
    doc.footerNote = String(translation.footerNote ?? "").trim();
  }
  if (translation.seo && typeof translation.seo === "object") {
    doc.seo = {
      ...(doc.seo || {}),
      title:
        translation.seo.title !== undefined
          ? String(translation.seo.title ?? "").trim()
          : doc.seo?.title ?? "",
      description:
        translation.seo.description !== undefined
          ? String(translation.seo.description ?? "").trim()
          : doc.seo?.description ?? "",
      keywords:
        translation.seo.keywords !== undefined
          ? ensureArray(translation.seo.keywords)
          : Array.isArray(doc.seo?.keywords)
          ? doc.seo.keywords
          : [],
    };
  }
}

// PUBLIC — GET /api/terms
export async function getPublicTerms(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const doc = await Terms.findOne({ singleton: "terms" });
    if (!doc || doc.isActive === false) {
      return res.json({
        terms: {
          heroTitle: "Terms of Service",
          heroIntro: "",
          sections: [],
          footerNote: "", // ← ÖNEMLİ (public fallback’te de var)
          isActive: doc ? false : true,
          seo: { title: "", description: "", keywords: [] },
        },
      });
    }
    const localized = resolveTranslation(doc, lang);
    return res.json({ terms: shape(localized) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ADMIN — GET /api/terms/manage
export async function getManageTerms(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const doc = await Terms.findOne({ singleton: "terms" });
    if (!doc) {
      return res.json({
        terms: {
          heroTitle: "Terms of Service",
          heroIntro: "",
          sections: [],
          footerNote: "", // ← ÖNEMLİ
          isActive: true,
          seo: { title: "", description: "", keywords: [] },
        },
      });
    }
    const localized = resolveTranslation(doc, lang);
    const shaped = shape(
      localized,
      { includeTranslations: true },
      composeResponseTranslations(doc, buildTermsTrTranslation)
    );
    res.json({ terms: shaped });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ADMIN — PUT /api/terms
export async function upsertTerms(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const isDefaultLang = lang === DEFAULT_LANG;
    const p = req.body || {};
    const heroTitle = String(p.heroTitle ?? "Terms of Service").trim();
    const heroIntro = String(p.heroIntro ?? "").trim();
    const footerNote = String(p.footerNote ?? "").trim(); // ← ÖNEMLİ

    const rawSections = Array.isArray(p.sections) ? p.sections : [];
    const sections = rawSections.map((s) => ({
      title: String(s?.title ?? "").trim(),
      paragraphs: ensureArray(s?.paragraphs),
    }));

    const isActive = p.isActive === undefined ? true : Boolean(p.isActive);
    const seo = {
      title: String(p?.seo?.title ?? "").trim(),
      description: String(p?.seo?.description ?? "").trim(),
      keywords: ensureArray(p?.seo?.keywords),
    };

    let doc = await Terms.findOne({ singleton: "terms" });
    if (!doc) {
      if (!isDefaultLang) {
        return res.status(400).json({
          message:
            "Önce Türkçe (TR) hizmet şartlarını oluşturun, ardından diğer diller için çeviri ekleyin.",
        });
      }
      doc = new Terms({
        singleton: "terms",
        heroTitle,
        heroIntro,
        sections,
        footerNote,
        isActive,
        seo,
      });
    } else {
      doc.isActive = isActive;
      if (isDefaultLang) {
        doc.heroTitle = heroTitle;
        doc.heroIntro = heroIntro;
        doc.sections = sections;
        doc.footerNote = footerNote;
        doc.seo = seo;
      }
    }

    const incomingTranslations = {
      ...pickLocalizedPayload(p),
    };

    if (!isDefaultLang) {
      const ensureLangBucket = () => {
        const bucket = incomingTranslations[lang] || {};
        incomingTranslations[lang] = bucket;
        return bucket;
      };
      if (Object.prototype.hasOwnProperty.call(p, "heroTitle")) {
        ensureLangBucket().heroTitle = heroTitle;
      }
      if (Object.prototype.hasOwnProperty.call(p, "heroIntro")) {
        ensureLangBucket().heroIntro = heroIntro;
      }
      if (Object.prototype.hasOwnProperty.call(p, "sections")) {
        ensureLangBucket().sections = sections;
      }
      if (Object.prototype.hasOwnProperty.call(p, "footerNote")) {
        ensureLangBucket().footerNote = footerNote;
      }
      if (Object.prototype.hasOwnProperty.call(p, "seo")) {
        ensureLangBucket().seo = seo;
      }
    }

    syncDocTranslations(
      doc,
      incomingTranslations,
      buildTermsTrTranslation,
      applyTermsTrTranslation
    );

    await doc.save();

    const localized = resolveTranslation(doc, lang);
    const shaped = shape(
      localized,
      { includeTranslations: true },
      composeResponseTranslations(doc, buildTermsTrTranslation)
    );

    res.json({ terms: shaped });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}
