// backend/controllers/faqController.js
import FaqPageConfig from "../models/FaqPageConfig.js";
import { DEFAULT_LANG, normalizeLang } from "../utils/i18n.js";

// helpers
function normStr(v, def = "") {
  if (v === undefined || v === null) return def;
  return String(v).trim();
}
function normBool(v, def = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(s)) return true;
    if (["false", "0", "no", "off"].includes(s)) return false;
  }
  return def;
}
function normNum(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function normList(val) {
  if (!val) return [];
  if (Array.isArray(val))
    return val.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return normList(parsed);
    } catch (_) {}
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function sanitizeSectionsPayload(sections = []) {
  if (!Array.isArray(sections)) return [];
  return sections.map((section) => {
    const sec = {
      _id: section?._id ?? null,
      title: normStr(section?.title, ""),
      subtitle: normStr(section?.subtitle, ""),
      isActive: normBool(section?.isActive, true),
      sortOrder: normNum(section?.sortOrder, 0),
    };
    const rawItems = Array.isArray(section?.items) ? section.items : [];
    sec.items = rawItems
      .map((item) => ({
        _id: item?._id ?? null,
        question: normStr(item?.question, ""),
        answer: normStr(item?.answer, ""),
        isActive: normBool(item?.isActive, true),
        sortOrder: normNum(item?.sortOrder, 0),
      }))
      .filter((item) => item.question && item.answer);
    return sec;
  });
}

function sanitizeSeoPayload(rawSeo = {}, fallback = {}) {
  const source = rawSeo || {};
  return {
    title: normStr(source.title ?? source.seoTitle ?? fallback.title ?? "", ""),
    description: normStr(
      source.description ?? source.seoDescription ?? fallback.description ?? "",
      ""
    ),
    keywords: normList(
      source.keywords ?? source.seoKeywords ?? fallback.keywords
    ),
  };
}

function extractLocalizedSectionsPayload(rawSections = []) {
  if (!Array.isArray(rawSections)) return [];
  return rawSections.map((section) => {
    const baseId =
      section?._id?.toString?.() ?? section?._id ?? section?.id ?? null;
    return {
      _id: baseId,
      title: normStr(section?.title, ""),
      subtitle: normStr(section?.subtitle, ""),
      items: Array.isArray(section?.items)
        ? section.items.map((item) => {
            const itemId =
              item?._id?.toString?.() ?? item?._id ?? item?.id ?? null;
            return {
              _id: itemId,
              question: normStr(item?.question, ""),
              answer: normStr(item?.answer, ""),
            };
          })
        : [],
    };
  });
}

function syncSharedSectionMetadata(doc, incomingSections = []) {
  if (
    !doc ||
    !Array.isArray(doc.sections) ||
    !Array.isArray(incomingSections)
  ) {
    return;
  }

  const buildSectionKey = (section, index) =>
    section?._id?.toString?.() ??
    section?._id ??
    section?.id ??
    `__idx_${index}`;

  const incomingMap = new Map();
  incomingSections.forEach((section, index) => {
    incomingMap.set(buildSectionKey(section, index), section);
  });

  doc.sections.forEach((section, index) => {
    const incoming = incomingMap.get(buildSectionKey(section, index));
    if (!incoming) return;

    if (incoming.isActive !== undefined) {
      section.isActive = !!incoming.isActive;
    }
    if (incoming.sortOrder !== undefined) {
      section.sortOrder = normNum(incoming.sortOrder, section.sortOrder ?? 0);
    }

    if (!Array.isArray(section.items)) {
      section.items = [];
    }

    const itemKey = (item, itemIndex) =>
      item?._id?.toString?.() ?? item?._id ?? item?.id ?? `__idx_${itemIndex}`;

    const incomingItems = Array.isArray(incoming.items) ? incoming.items : [];
    const incomingItemMap = new Map();
    incomingItems.forEach((item, itemIndex) => {
      incomingItemMap.set(itemKey(item, itemIndex), item);
    });

    section.items.forEach((item, itemIndex) => {
      const incomingItem = incomingItemMap.get(itemKey(item, itemIndex));
      if (!incomingItem) return;
      if (incomingItem.isActive !== undefined) {
        item.isActive = !!incomingItem.isActive;
      }
      if (incomingItem.sortOrder !== undefined) {
        item.sortOrder = normNum(incomingItem.sortOrder, item.sortOrder ?? 0);
      }
    });
  });
}

function normalizeObjectId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (typeof value.toHexString === "function") {
      return value.toHexString();
    }
    if (
      typeof value.toString === "function" &&
      value.toString !== Object.prototype.toString
    ) {
      const str = value.toString();
      if (str && str !== "[object Object]") return str;
    }
  }
  return null;
}

function shouldOverrideValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function buildItemTranslationMap(items = []) {
  const map = new Map();
  if (!Array.isArray(items)) return map;
  items.forEach((item) => {
    const key =
      normalizeObjectId(item?._id) ?? normalizeObjectId(item?.id) ?? null;
    if (!key) return;
    map.set(key, {
      question: item?.question,
      answer: item?.answer,
    });
  });
  return map;
}

function applySectionTranslations(baseSections = [], translationSections = []) {
  if (!Array.isArray(baseSections) || !Array.isArray(translationSections)) {
    return baseSections;
  }

  const sectionMap = new Map();
  translationSections.forEach((section) => {
    const key =
      normalizeObjectId(section?._id) ?? normalizeObjectId(section?.id);
    if (!key) return;
    sectionMap.set(key, {
      title: section?.title,
      subtitle: section?.subtitle,
      items: buildItemTranslationMap(section?.items),
    });
  });

  return baseSections.map((section) => {
    const key =
      section?.id ??
      normalizeObjectId(section?._id) ??
      normalizeObjectId(section?._id?.toString?.());
    if (!key || !sectionMap.has(key)) return section;
    const localized = sectionMap.get(key);
    const mergedSection = { ...section };
    if (shouldOverrideValue(localized.title)) {
      mergedSection.title = localized.title;
    }
    if (shouldOverrideValue(localized.subtitle)) {
      mergedSection.subtitle = localized.subtitle;
    }
    if (Array.isArray(section.items) && localized.items.size) {
      mergedSection.items = section.items.map((item) => {
        const itemKey =
          item?.id ??
          normalizeObjectId(item?._id) ??
          normalizeObjectId(item?._id?.toString?.());
        if (!itemKey || !localized.items.has(itemKey)) return item;
        const loc = localized.items.get(itemKey);
        const mergedItem = { ...item };
        if (shouldOverrideValue(loc.question)) {
          mergedItem.question = loc.question;
        }
        if (shouldOverrideValue(loc.answer)) {
          mergedItem.answer = loc.answer;
        }
        return mergedItem;
      });
    }
    return mergedSection;
  });
}

// shape (public)
function shapePublic(config) {
  if (!config) return null;
  const sections = (config.sections || [])
    .filter((s) => s?.isActive)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((s) => ({
      id: s._id?.toString(),
      title: s.title,
      subtitle: s.subtitle || "",
      sortOrder: s.sortOrder ?? 0,
      items: (s.items || [])
        .filter((it) => it?.isActive)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((it) => ({
          id: it._id?.toString(),
          question: it.question,
          answer: it.answer,
          sortOrder: it.sortOrder ?? 0,
        })),
    }));

  return {
    id: config._id?.toString(),
    heroTitle: config.heroTitle || "Frequently Asked Questions",
    heroIntro: config.heroIntro || "",
    isActive: !!config.isActive,
    sections,
    seo: {
      title: config.seo?.title || "",
      description: config.seo?.description || "",
      keywords: Array.isArray(config.seo?.keywords) ? config.seo.keywords : [],
    },
    updatedAt: config.updatedAt,
  };
}

// shape (manage/admin)
function shapeManage(config) {
  if (!config) return null;
  return {
    id: config._id?.toString(),
    heroTitle: config.heroTitle || "",
    heroIntro: config.heroIntro || "",
    isActive: !!config.isActive,
    sections: (config.sections || [])
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((s) => ({
        id: s._id?.toString(),
        title: s.title,
        subtitle: s.subtitle || "",
        isActive: !!s.isActive,
        sortOrder: s.sortOrder ?? 0,
        items: (s.items || [])
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((it) => ({
            id: it._id?.toString(),
            question: it.question,
            answer: it.answer,
            isActive: !!it.isActive,
            sortOrder: it.sortOrder ?? 0,
          })),
      })),
    seo: {
      title: config.seo?.title || "",
      description: config.seo?.description || "",
      keywords: Array.isArray(config.seo?.keywords) ? config.seo.keywords : [],
    },
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy ? String(config.updatedBy) : null,
  };
}

// normalize incoming payload for upsert (TR form)
function sanitizePayload(body = {}) {
  const clean = {};

  clean.heroTitle = normStr(body.heroTitle, "Frequently Asked Questions");
  clean.heroIntro = normStr(body.heroIntro, "");
  clean.isActive = normBool(body.isActive, true);

  const rawSections = Array.isArray(body.sections) ? body.sections : [];
  clean.sections = sanitizeSectionsPayload(rawSections);

  clean.seo = sanitizeSeoPayload(
    body.seo ?? {
      title: body?.seoTitle,
      description: body?.seoDescription,
      keywords: body?.seoKeywords,
    }
  );

  return clean;
}

/* ---------- TR snapshot builder & TR apply ---------- */

function buildFaqTrTranslation(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    heroTitle: plain.heroTitle ?? "",
    heroIntro: plain.heroIntro ?? "",
    sections: Array.isArray(plain.sections)
      ? plain.sections.map((section) => ({
          _id: section?._id ?? null,
          title: section?.title ?? "",
          subtitle: section?.subtitle ?? "",
          items: Array.isArray(section?.items)
            ? section.items.map((item) => ({
                _id: item?._id ?? null,
                question: item?.question ?? "",
                answer: item?.answer ?? "",
              }))
            : [],
        }))
      : [],
    seo: {
      title: plain.seo?.title ?? "",
      description: plain.seo?.description ?? "",
      keywords: Array.isArray(plain.seo?.keywords)
        ? [...plain.seo.keywords]
        : [],
    },
  };
}

function applyFaqTrTranslation(doc, translation = {}) {
  if (!translation || typeof translation !== "object") return;
  if (translation.heroTitle !== undefined) {
    doc.heroTitle = normStr(translation.heroTitle, doc.heroTitle ?? "");
  }
  if (translation.heroIntro !== undefined) {
    doc.heroIntro = normStr(translation.heroIntro, doc.heroIntro ?? "");
  }

  if (Array.isArray(translation.sections)) {
    const currentSections = Array.isArray(doc.sections) ? doc.sections : [];
    const localizedMap = new Map();
    translation.sections.forEach((section, index) => {
      const key =
        section?._id?.toString?.() ?? section?._id ?? `__idx_${index}`;
      localizedMap.set(key, section);
    });

    currentSections.forEach((section, index) => {
      const key =
        section?._id?.toString?.() ?? section?._id ?? `__idx_${index}`;
      const localized = localizedMap.get(key);
      if (!localized) return;
      if (localized.title !== undefined) {
        section.title = normStr(localized.title, section.title ?? "");
      }
      if (localized.subtitle !== undefined) {
        section.subtitle = normStr(localized.subtitle, section.subtitle ?? "");
      }

      if (Array.isArray(localized.items)) {
        const itemMap = new Map();
        localized.items.forEach((item, itemIndex) => {
          const itemKey =
            item?._id?.toString?.() ?? item?._id ?? `__idx_${itemIndex}`;
          itemMap.set(itemKey, item);
        });

        const currentItems = Array.isArray(section.items) ? section.items : [];
        currentItems.forEach((item, itemIndex) => {
          const itemKey =
            item?._id?.toString?.() ?? item?._id ?? `__idx_${itemIndex}`;
          const loc = itemMap.get(itemKey);
          if (!loc) return;
          if (loc.question !== undefined) {
            item.question = normStr(loc.question, item.question ?? "");
          }
          if (loc.answer !== undefined) {
            item.answer = normStr(loc.answer, item.answer ?? "");
          }
        });
      }
    });
  }

  if (translation.seo && typeof translation.seo === "object") {
    const sanitizedSeo = sanitizeSeoPayload(translation.seo, doc.seo || {});
    doc.seo = {
      ...(doc.seo || {}),
      ...sanitizedSeo,
    };
  }
}

/* ---------- SADECE FAQ İÇİN LOCALIZATION BUILDER ---------- */

/* ---------- SADECE FAQ İÇİN LOCALIZATION BUILDER ---------- */

function buildLocalizedFaqDoc(doc, lang) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const normalizedLang = normalizeLang(lang || DEFAULT_LANG);

  // Varsayılan dil ise TR base dokümanı aynen dön
  if (!normalizedLang || normalizedLang === DEFAULT_LANG) {
    return plain;
  }

  const translations = plain.translations || {};
  const langBucket = translations[normalizedLang] || {};
  const trSnapshot = translations[DEFAULT_LANG] || buildFaqTrTranslation(plain);

  const localized = { ...plain };

  // 🔹 HERO
  localized.heroTitle = shouldOverrideValue(langBucket.heroTitle)
    ? langBucket.heroTitle
    : trSnapshot.heroTitle ?? plain.heroTitle ?? "";

  localized.heroIntro = shouldOverrideValue(langBucket.heroIntro)
    ? langBucket.heroIntro
    : trSnapshot.heroIntro ?? plain.heroIntro ?? "";

  // 🔹 SECTIONS + ITEMS
  const baseSections = Array.isArray(plain.sections) ? plain.sections : [];
  const trSections = Array.isArray(trSnapshot.sections)
    ? trSnapshot.sections
    : [];
  const transSections = Array.isArray(langBucket.sections)
    ? langBucket.sections
    : [];

  localized.sections = baseSections.map((baseSec, secIndex) => {
    const baseId = normalizeObjectId(baseSec?._id);

    // TR snapshot’taki karşılığı (index’e göre)
    const trSec = trSections[secIndex] || {};

    // Çeviri tarafında aynı _id’yi bulmaya çalış, yoksa index’e göre al
    let tSec =
      (baseId &&
        transSections.find(
          (s) =>
            normalizeObjectId(s?._id) === baseId ||
            normalizeObjectId(s?.id) === baseId
        )) ||
      transSections[secIndex] ||
      null;

    const mergedSection = { ...baseSec };

    // title
    if (tSec && shouldOverrideValue(tSec.title)) {
      mergedSection.title = tSec.title;
    } else if (shouldOverrideValue(trSec.title)) {
      mergedSection.title = trSec.title;
    }

    // subtitle
    if (tSec && shouldOverrideValue(tSec.subtitle)) {
      mergedSection.subtitle = tSec.subtitle;
    } else if (shouldOverrideValue(trSec.subtitle)) {
      mergedSection.subtitle = trSec.subtitle;
    }

    // ITEMS
    const baseItems = Array.isArray(baseSec.items) ? baseSec.items : [];
    const trItems = Array.isArray(trSec.items) ? trSec.items : [];
    const transItems = Array.isArray(tSec?.items) ? tSec.items : [];

    mergedSection.items = baseItems.map((baseItem, itemIndex) => {
      const baseItemId = normalizeObjectId(baseItem?._id);

      const trItem = trItems[itemIndex] || {};

      let tItem =
        (baseItemId &&
          transItems.find(
            (it) =>
              normalizeObjectId(it?._id) === baseItemId ||
              normalizeObjectId(it?.id) === baseItemId
          )) ||
        transItems[itemIndex] ||
        null;

      const mergedItem = { ...baseItem };

      if (tItem && shouldOverrideValue(tItem.question)) {
        mergedItem.question = tItem.question;
      } else if (shouldOverrideValue(trItem.question)) {
        mergedItem.question = trItem.question;
      }

      if (tItem && shouldOverrideValue(tItem.answer)) {
        mergedItem.answer = tItem.answer;
      } else if (shouldOverrideValue(trItem.answer)) {
        mergedItem.answer = trItem.answer;
      }

      return mergedItem;
    });

    return mergedSection;
  });

  // 🔹 SEO
  const baseSeo = plain.seo || {};
  const trSeo = trSnapshot.seo || {};
  const transSeo = langBucket.seo || {};

  localized.seo = {
    title: shouldOverrideValue(transSeo.title)
      ? transSeo.title
      : shouldOverrideValue(trSeo.title)
      ? trSeo.title
      : baseSeo.title || "",
    description: shouldOverrideValue(transSeo.description)
      ? transSeo.description
      : shouldOverrideValue(trSeo.description)
      ? trSeo.description
      : baseSeo.description || "",
    keywords:
      Array.isArray(transSeo.keywords) && transSeo.keywords.length
        ? transSeo.keywords
        : Array.isArray(trSeo.keywords) && trSeo.keywords.length
        ? trSeo.keywords
        : Array.isArray(baseSeo.keywords)
        ? baseSeo.keywords
        : [],
  };

  return localized;
}

/* -------------------- PUBLIC -------------------- */

export async function getFaqPublic(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const doc = await FaqPageConfig.findOne();
    if (!doc) {
      return res.json({ faq: null });
    }

    const localizedDoc = buildLocalizedFaqDoc(doc, lang);
    const shaped = shapePublic(localizedDoc);

    if (!doc.isActive) {
      return res.json({ faq: shaped || null });
    }
    res.json({ faq: shaped });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/* -------------------- ADMIN / MANAGE -------------------- */

export async function getFaqManage(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const doc = await FaqPageConfig.findOne();
    if (!doc) return res.json({ faq: null });

    const localizedDoc = buildLocalizedFaqDoc(doc, lang);
    const shaped = shapeManage(localizedDoc);

    // translation modal için gerekli snapshot'lar
    const translations = doc.translations || {};
    shaped.translations = {
      tr: buildFaqTrTranslation(doc),
      en: translations.en || null,
      de: translations.de || null,
    };

    res.json({ faq: shaped });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// PUT /api/faq  (upsert – tek belge)
export async function upsertFaq(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const isDefaultLang = lang === DEFAULT_LANG;
    const body = req.body || {};

    // TR form payload’ını normalize et
    const payload = sanitizePayload(body);

    let doc = await FaqPageConfig.findOne();

    if (!doc) {
      if (!isDefaultLang) {
        return res.status(400).json({
          message:
            "Önce Türkçe (TR) içeriğini oluşturun, ardından diğer diller için çeviri ekleyin.",
        });
      }
      doc = new FaqPageConfig({ ...payload, updatedBy: req.userId });
    } else {
      doc.isActive = payload.isActive;
      doc.updatedBy = req.userId;

      if (isDefaultLang) {
        // Varsayılan dilde TR içeriğini direkt güncelliyoruz
        doc.heroTitle = payload.heroTitle;
        doc.heroIntro = payload.heroIntro;
        doc.sections = payload.sections;
        doc.seo = payload.seo;
      } else {
        // Diğer dillerde gelen ana form isteklerinde sadece meta (sortOrder, isActive) senkronize
        syncSharedSectionMetadata(doc, payload.sections);
        doc.markModified("sections");
      }
    }

    // translations alanını parse et (modal'dan gelen)
    let translationsPayload = {};
    if (typeof body.translations === "string") {
      try {
        translationsPayload = JSON.parse(body.translations);
      } catch {
        translationsPayload = {};
      }
    } else if (body.translations && typeof body.translations === "object") {
      translationsPayload = body.translations;
    }

    const incomingTranslations =
      translationsPayload && typeof translationsPayload === "object"
        ? { ...translationsPayload }
        : {};

    // Non-default dil isteği direkt heroTitle/heroIntro/sections/seo ile gelirse
    if (!isDefaultLang) {
      const ensureLangBucket = () => {
        if (
          !incomingTranslations[lang] ||
          typeof incomingTranslations[lang] !== "object"
        ) {
          incomingTranslations[lang] = {};
        }
        return incomingTranslations[lang];
      };

      if (Object.prototype.hasOwnProperty.call(body, "heroTitle")) {
        ensureLangBucket().heroTitle = normStr(body.heroTitle, "");
      }
      if (Object.prototype.hasOwnProperty.call(body, "heroIntro")) {
        ensureLangBucket().heroIntro = normStr(body.heroIntro, "");
      }
      if (Object.prototype.hasOwnProperty.call(body, "sections")) {
        ensureLangBucket().sections = extractLocalizedSectionsPayload(
          body.sections
        );
      }
      if (Object.prototype.hasOwnProperty.call(body, "seo")) {
        ensureLangBucket().seo = sanitizeSeoPayload(body.seo || {});
      }
    }

    // TR snapshot’ı her save’de güncelle
    doc.translations = doc.translations || {};
    doc.translations[DEFAULT_LANG] = buildFaqTrTranslation(doc);

    // Diğer diller
    Object.entries(incomingTranslations).forEach(([lng, patch]) => {
      if (!patch || typeof patch !== "object") return;

      if (lng === DEFAULT_LANG) {
        applyFaqTrTranslation(doc, patch);
        doc.translations[DEFAULT_LANG] = buildFaqTrTranslation(doc);
        doc.markModified(`translations.${DEFAULT_LANG}`);
        return;
      }

      const next = {
        heroTitle: normStr(patch.heroTitle, ""),
        heroIntro: normStr(patch.heroIntro, ""),
        sections: Array.isArray(patch.sections)
          ? patch.sections.map((section) => ({
              _id: section?._id ?? null,
              title: normStr(section?.title, ""),
              subtitle: normStr(section?.subtitle, ""),
              items: Array.isArray(section?.items)
                ? section.items.map((item) => ({
                    _id: item?._id ?? null,
                    question: normStr(item?.question, ""),
                    answer: normStr(item?.answer, ""),
                  }))
                : [],
            }))
          : [],
        seo: patch.seo ? sanitizeSeoPayload(patch.seo, {}) : undefined,
      };

      doc.translations[lng] = next;
      doc.markModified(`translations.${lng}`);
    });

    await doc.save();

    const localizedDoc = buildLocalizedFaqDoc(doc, lang);
    const shaped = shapeManage(localizedDoc);
    const translationsAfter = doc.translations || {};
    shaped.translations = {
      tr: buildFaqTrTranslation(doc),
      en: translationsAfter.en || null,
      de: translationsAfter.de || null,
    };

    res.json({ faq: shaped });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}
