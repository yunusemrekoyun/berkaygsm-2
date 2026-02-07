import PrivacyPolicy from "../models/PrivacyPolicy.js";
import {
  DEFAULT_LANG,
  normalizeLang,
  resolveTranslation,
  pickLocalizedPayload,
  syncDocTranslations,
  composeResponseTranslations,
} from "../utils/i18n.js";

/* helpers */
const ensureArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x ?? ""));
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x ?? ""));
    } catch {}
    return v.split("\n").map((s) => s);
  }
  return [];
};

const sanitizeSection = (s = {}) => {
  const title = String(s?.title ?? "").trim();
  const id = String(s?.id ?? title).trim();
  const content = ensureArray(s?.content).map((p) => String(p ?? ""));
  return { id, title, content };
};

const sanitizeSeo = (seo = {}) => ({
  title: String(seo?.title ?? "").trim(),
  description: String(seo?.description ?? "").trim(),
  keywords: ensureArray(seo?.keywords),
});

function buildPrivacyTrTranslation(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    heroTitle: plain.heroTitle ?? "",
    heroIntro: plain.heroIntro ?? "",
    sections: Array.isArray(plain.sections)
      ? plain.sections.map((section) => ({
          id: section?.id ?? "",
          title: section?.title ?? "",
          content: Array.isArray(section?.content)
            ? [...section.content]
            : [],
        }))
      : [],
    footerHtml: plain.footerHtml ?? "",
    seo: {
      title: plain.seo?.title ?? "",
      description: plain.seo?.description ?? "",
      keywords: Array.isArray(plain.seo?.keywords)
        ? [...plain.seo.keywords]
        : [],
    },
  };
}

function applyPrivacyTrTranslation(doc, translation = {}) {
  if (!translation || typeof translation !== "object") return;
  if (translation.heroTitle !== undefined) {
    doc.heroTitle = String(translation.heroTitle);
  }
  if (translation.heroIntro !== undefined) {
    doc.heroIntro = String(translation.heroIntro);
  }
  if (Array.isArray(translation.sections)) {
    doc.sections = translation.sections.map(sanitizeSection);
  }
  if (translation.footerHtml !== undefined) {
    doc.footerHtml = String(translation.footerHtml ?? "");
  }
  if (translation.seo) {
    doc.seo = sanitizeSeo({
      ...doc.seo,
      ...translation.seo,
    });
  }
}

const shape = (doc, { includeTranslations = false } = {}, translations = null) => {
  if (!doc) return null;
  const d = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const shaped = {
    id: d._id?.toString?.() || d.id,
    heroTitle: d.heroTitle || "Gizlilik Politikası",
    heroIntro: d.heroIntro || "",
    sections: Array.isArray(d.sections) ? d.sections : [],
    footerHtml: d.footerHtml || "",
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

/* PUBLIC — GET /api/privacy */
export async function getPublicPrivacy(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const doc =
      (await PrivacyPolicy.findOne({ singleton: "privacy_policy" })) || null;

    if (!doc || doc.isActive === false) {
      return res.json({
        privacy: {
          heroTitle: "Gizlilik Politikası",
          heroIntro: "",
          sections: [],
          footerHtml:
            'Sorularınız için <a href="mailto:privacy@berkaygsm.com" class="text-accent underline">privacy@berkaygsm.com</a> adresine e‑posta gönderebilirsiniz.',
          isActive: doc ? false : true,
          seo: { title: "", description: "", keywords: [] },
        },
      });
    }

    const localized = resolveTranslation(doc, lang);
    return res.json({ privacy: shape(localized) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/* ADMIN — GET /api/privacy/manage */
export async function getManagePrivacy(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const doc =
      (await PrivacyPolicy.findOne({ singleton: "privacy_policy" })) || null;

    if (!doc) {
      return res.json({
        privacy: {
          heroTitle: "Gizlilik Politikası",
          heroIntro: "",
          sections: [],
          footerHtml: "",
          isActive: true,
          seo: { title: "", description: "", keywords: [] },
        },
      });
    }

    const localized = resolveTranslation(doc, lang);
    const shaped = shape(
      localized,
      { includeTranslations: true },
      composeResponseTranslations(doc, buildPrivacyTrTranslation)
    );
    res.json({ privacy: shaped });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/* ADMIN — PUT /api/privacy */
export async function upsertPrivacy(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const isDefaultLang = lang === DEFAULT_LANG;
    const body = req.body || {};
    const heroTitle = String(body.heroTitle ?? "Gizlilik Politikası").trim();
    const heroIntro = String(body.heroIntro ?? "").trim();
    const sectionsRaw = Array.isArray(body.sections) ? body.sections : [];
    const sections = sectionsRaw.map(sanitizeSection);
    const footerHtml = String(body.footerHtml ?? "");
    const isActive =
      body.isActive === undefined ? true : Boolean(body.isActive);
    const seo = sanitizeSeo(body?.seo);

    let doc = await PrivacyPolicy.findOne({ singleton: "privacy_policy" });
    if (!doc) {
      if (!isDefaultLang) {
        return res.status(400).json({
          message:
            "Önce Türkçe (TR) gizlilik politikasını oluşturun, ardından diğer diller için çeviri ekleyin.",
        });
      }
      doc = new PrivacyPolicy({
        singleton: "privacy_policy",
        heroTitle,
        heroIntro,
        sections,
        footerHtml,
        isActive,
        seo,
      });
    } else {
      doc.isActive = isActive;
      if (isDefaultLang) {
        doc.heroTitle = heroTitle;
        doc.heroIntro = heroIntro;
        doc.sections = sections;
        doc.footerHtml = footerHtml;
        doc.seo = seo;
      }
    }

    const incomingTranslations = {
      ...pickLocalizedPayload(body),
    };

    if (!isDefaultLang) {
      const ensureLangBucket = () => {
        const bucket = incomingTranslations[lang] || {};
        incomingTranslations[lang] = bucket;
        return bucket;
      };
      if (Object.prototype.hasOwnProperty.call(body, "heroTitle")) {
        ensureLangBucket().heroTitle = String(body.heroTitle ?? "").trim();
      }
      if (Object.prototype.hasOwnProperty.call(body, "heroIntro")) {
        ensureLangBucket().heroIntro = String(body.heroIntro ?? "").trim();
      }
      if (Object.prototype.hasOwnProperty.call(body, "sections")) {
        ensureLangBucket().sections = sectionsRaw.map(sanitizeSection);
      }
      if (Object.prototype.hasOwnProperty.call(body, "footerHtml")) {
        ensureLangBucket().footerHtml = String(body.footerHtml ?? "");
      }
      if (Object.prototype.hasOwnProperty.call(body, "seo")) {
        ensureLangBucket().seo = sanitizeSeo(body.seo || {});
      }
    }

    syncDocTranslations(
      doc,
      incomingTranslations,
      buildPrivacyTrTranslation,
      applyPrivacyTrTranslation
    );

    await doc.save();

    const localized = resolveTranslation(doc, lang);
    const shaped = shape(
      localized,
      { includeTranslations: true },
      composeResponseTranslations(doc, buildPrivacyTrTranslation)
    );

    res.json({ privacy: shaped });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}
