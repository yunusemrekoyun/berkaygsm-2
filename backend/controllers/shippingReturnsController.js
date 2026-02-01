import ShippingReturns from "../models/ShippingReturns.js";
import {
  DEFAULT_LANG,
  normalizeLang,
  resolveTranslation,
  pickLocalizedPayload,
  syncDocTranslations,
  composeResponseTranslations,
} from "../utils/i18n.js";

/* ----------------- Yardımcılar ----------------- */
const ensureArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((i) => String(i ?? ""));
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((i) => String(i ?? ""));
    } catch {}
    return v
      .split("\n")
      .map((s) => String(s))
      .filter(Boolean);
  }
  return [];
};

const sanitizeSection = (s = {}) => {
  const title = String(s?.title ?? "").trim();
  const paragraphs = ensureArray(s?.paragraphs).map((p) => p.trim());
  const list = {
    heading: String(s?.list?.heading ?? "").trim(),
    items: ensureArray(s?.list?.items).map((i) => i.trim()),
  };
  const normalizedList =
    list.heading || (list.items && list.items.length)
      ? list
      : { heading: "", items: [] };
  return { title, paragraphs, list: normalizedList };
};

const collectQuickFacts = (doc = {}) => {
  if (Array.isArray(doc.sidebar?.quickFacts) && doc.sidebar.quickFacts.length) {
    return doc.sidebar.quickFacts.map((item) => String(item ?? ""));
  }
  if (Array.isArray(doc.quickFacts) && doc.quickFacts.length) {
    return doc.quickFacts.map((item) => String(item ?? ""));
  }
  if (
    Array.isArray(doc.sidebarContact?.quickFacts) &&
    doc.sidebarContact.quickFacts.length
  ) {
    return doc.sidebarContact.quickFacts.map((item) => String(item ?? ""));
  }
  return [];
};

function buildShippingReturnsTrTranslation(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    heroTitle: plain.heroTitle ?? "",
    heroSubtitle: plain.heroSubtitle ?? plain.heroIntro ?? "",
    sections: Array.isArray(plain.sections)
      ? plain.sections.map((section) => ({
          title: section?.title ?? "",
          paragraphs: Array.isArray(section?.paragraphs)
            ? section.paragraphs.map((p) => String(p ?? ""))
            : [],
          list: {
            heading: section?.list?.heading ?? "",
            items: Array.isArray(section?.list?.items)
              ? section.list.items.map((item) => String(item ?? ""))
              : [],
          },
        }))
      : [],
    quickFacts: collectQuickFacts(plain),
    sidebarContact: {
      hoursText: plain.sidebarContact?.hoursText ?? "",
      note: plain.sidebarContact?.note ?? "",
    },
    seo: {
      title: plain.seo?.title ?? "",
      description: plain.seo?.description ?? "",
      keywords: Array.isArray(plain.seo?.keywords)
        ? plain.seo.keywords.map((item) => String(item ?? ""))
        : [],
    },
  };
}

function applyShippingReturnsTrTranslation(doc, translation = {}) {
  if (!translation || typeof translation !== "object") return;

  if (translation.heroTitle !== undefined) {
    doc.heroTitle = String(translation.heroTitle ?? "").trim();
  }
  if (translation.heroSubtitle !== undefined) {
    const value = String(translation.heroSubtitle ?? "").trim();
    doc.heroSubtitle = value;
    doc.heroIntro = value;
  }

  if (Array.isArray(translation.sections)) {
    doc.sections = translation.sections.map(sanitizeSection);
  }

  if (translation.quickFacts !== undefined) {
    const facts = ensureArray(translation.quickFacts).map((item) => item.trim());
    doc.quickFacts = facts;
    doc.sidebar = doc.sidebar || {};
    doc.sidebar.quickFacts = facts;
    doc.sidebarContact = doc.sidebarContact || {};
    doc.sidebarContact.quickFacts = facts;
  }

  if (translation.sidebarContact && typeof translation.sidebarContact === "object") {
    doc.sidebarContact = doc.sidebarContact || {};
    if (translation.sidebarContact.hoursText !== undefined) {
      doc.sidebarContact.hoursText = String(
        translation.sidebarContact.hoursText ?? ""
      );
    }
    if (translation.sidebarContact.note !== undefined) {
      const note = String(translation.sidebarContact.note ?? "");
      doc.sidebarContact.note = note;
      doc.sidebar = doc.sidebar || {};
      doc.sidebar.helpBoxHtml = note;
    }
  }

  if (translation.seo && typeof translation.seo === "object") {
    doc.seo = {
      ...(doc.seo || {}),
      title: translation.seo.title !== undefined
        ? String(translation.seo.title ?? "").trim()
        : doc.seo?.title ?? "",
      description: translation.seo.description !== undefined
        ? String(translation.seo.description ?? "").trim()
        : doc.seo?.description ?? "",
      keywords:
        translation.seo.keywords !== undefined
          ? ensureArray(translation.seo.keywords).map((item) => item.trim())
          : Array.isArray(doc.seo?.keywords)
          ? doc.seo.keywords
          : [],
    };
  }
}

/* ----------------- shapeToPage ----------------- */
/**
 * DB'deki eski/yeni şemaları tek bir "frontend-friendly" objeye çevirir.
 */
const shapeToPage = (doc) => {
  if (!doc) return null;
  const d = typeof doc.toObject === "function" ? doc.toObject() : doc;

  const heroSubtitle = (d.heroSubtitle ?? d.heroIntro ?? "").toString();

  // ✅ Quick facts (güvenli fallback)
  const quickFacts = collectQuickFacts(d);

  // ✅ Help box (HTML)
  const helpBoxHtml =
    d.sidebar?.helpBoxHtml && d.sidebar.helpBoxHtml.trim().length
      ? d.sidebar.helpBoxHtml
      : d.sidebarContact?.note ?? "";

  return {
    id: d._id?.toString?.() || d.id,
    heroTitle: (d.heroTitle ?? "Shipping & Returns").toString(),
    heroSubtitle,
    sections: Array.isArray(d.sections) ? d.sections : [],
    sidebar: {
      quickFacts,
      helpBoxHtml: helpBoxHtml.toString(),
    },
    isActive: d.isActive !== false,
    seo: {
      title: d.seo?.title ?? "",
      description: d.seo?.description ?? "",
      keywords: Array.isArray(d.seo?.keywords) ? d.seo.keywords : [],
    },
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
};

/* ----------------- PUBLIC ----------------- */
export async function getPublicShippingReturns(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const doc =
      (await ShippingReturns.findOne({
        singleton: "shipping_returns",
      })) || null;

    if (!doc || doc.isActive === false) {
      return res.json({
        page: {
          heroTitle: "Shipping & Returns",
          heroSubtitle: "",
          sections: [],
          sidebar: { quickFacts: [], helpBoxHtml: "" },
          isActive: doc ? false : true,
          seo: { title: "", description: "", keywords: [] },
        },
      });
    }

    const localized = resolveTranslation(doc, lang);
    return res.json({ page: shapeToPage(localized) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/* ----------------- ADMIN (GET) ----------------- */
export async function getManageShippingReturns(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const doc =
      (await ShippingReturns.findOne({
        singleton: "shipping_returns",
      })) || null;

    if (!doc) {
      return res.json({
        page: {
          heroTitle: "Shipping & Returns",
          heroSubtitle: "",
          sections: [],
          sidebar: { quickFacts: [], helpBoxHtml: "" },
          isActive: true,
          seo: { title: "", description: "", keywords: [] },
        },
      });
    }

    const localized = resolveTranslation(doc, lang);
    const shaped = shapeToPage(localized);
    shaped.translations = composeResponseTranslations(
      doc,
      buildShippingReturnsTrTranslation
    );
    res.json({ page: shaped });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/* ----------------- ADMIN (PUT / UPSERT) ----------------- */
export async function upsertShippingReturns(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const isDefaultLang = lang === DEFAULT_LANG;
    const payload = req.body || {};

    const heroTitle = String(payload.heroTitle ?? "Shipping & Returns").trim();
    const heroSubtitle = String(
      payload.heroSubtitle ?? payload.heroIntro ?? ""
    ).trim();

    const rawSections = Array.isArray(payload.sections) ? payload.sections : [];
    const sections = rawSections.map(sanitizeSection);

    const sidebarRaw = payload.sidebar || {};
    const sidebarQuickFacts = ensureArray(sidebarRaw.quickFacts).map((i) =>
      String(i).trim()
    );
    const sidebarHelpBoxHtml = String(sidebarRaw.helpBoxHtml ?? "").toString();
    const hasSidebarQuickFacts = Object.prototype.hasOwnProperty.call(
      sidebarRaw,
      "quickFacts"
    );
    const hasSidebarHelpBoxHtml = Object.prototype.hasOwnProperty.call(
      sidebarRaw,
      "helpBoxHtml"
    );

    const isActive =
      typeof payload.isActive === "undefined"
        ? true
        : Boolean(payload.isActive);

    const seo = {
      title: String(payload?.seo?.title ?? "").trim(),
      description: String(payload?.seo?.description ?? "").trim(),
      keywords: ensureArray(payload?.seo?.keywords).map((k) => k.trim()),
    };

    let doc = await ShippingReturns.findOne({ singleton: "shipping_returns" });
    if (!doc) {
      if (!isDefaultLang) {
        return res.status(400).json({
          message:
            "Önce Türkçe (TR) kargo & iade içeriğini oluşturun, ardından diğer diller için çeviri ekleyin.",
        });
      }
      const sidebarContactPayload = payload.sidebarContact || {};
      const emailValue = String(sidebarContactPayload.email ?? "").trim();
      const phoneValue = String(sidebarContactPayload.phone ?? "").trim();
      const hoursTextValue = String(
        sidebarContactPayload.hoursText ?? ""
      ).trim();
      const noteValue = String(sidebarContactPayload.note ?? "").trim();

      doc = new ShippingReturns({
        singleton: "shipping_returns",
        heroTitle,
        heroSubtitle,
        heroIntro: heroSubtitle,
        sections,
        sidebar: {
          quickFacts: sidebarQuickFacts,
          helpBoxHtml: sidebarHelpBoxHtml,
        },
        quickFacts: sidebarQuickFacts,
        sidebarContact: {
          email: emailValue,
          phone: phoneValue,
          hoursText: hoursTextValue,
          note: noteValue || sidebarHelpBoxHtml,
          quickFacts: sidebarQuickFacts,
        },
        isActive,
        seo,
      });
    }

    const sidebarContactPayload = payload.sidebarContact || {};
    const emailProvided = Object.prototype.hasOwnProperty.call(
      sidebarContactPayload,
      "email"
    );
    const phoneProvided = Object.prototype.hasOwnProperty.call(
      sidebarContactPayload,
      "phone"
    );
    const hoursTextProvided = Object.prototype.hasOwnProperty.call(
      sidebarContactPayload,
      "hoursText"
    );
    const noteProvided = Object.prototype.hasOwnProperty.call(
      sidebarContactPayload,
      "note"
    );

    const emailValue = emailProvided
      ? String(sidebarContactPayload.email || "").trim()
      : undefined;
    const phoneValue = phoneProvided
      ? String(sidebarContactPayload.phone || "").trim()
      : undefined;
    const hoursTextValue = hoursTextProvided
      ? String(sidebarContactPayload.hoursText || "").trim()
      : "";
    const noteValue = noteProvided
      ? String(sidebarContactPayload.note || "").trim()
      : "";

    if (doc) {
      doc.isActive = isActive;
      doc.sidebar = doc.sidebar || {};
      doc.sidebarContact = doc.sidebarContact || {};

      if (emailProvided) {
        doc.sidebarContact.email = emailValue;
      }
      if (phoneProvided) {
        doc.sidebarContact.phone = phoneValue;
      }

      if (isDefaultLang) {
        doc.heroTitle = heroTitle;
        doc.heroSubtitle = heroSubtitle;
        doc.heroIntro = heroSubtitle;
        doc.sections = sections;
        doc.sidebar.quickFacts = sidebarQuickFacts;
        doc.sidebar.helpBoxHtml = noteProvided
          ? noteValue
          : sidebarHelpBoxHtml;
        doc.quickFacts = sidebarQuickFacts;
        doc.sidebarContact.quickFacts = sidebarQuickFacts;
        if (hoursTextProvided) {
          doc.sidebarContact.hoursText = hoursTextValue;
        }
        if (noteProvided) {
          doc.sidebarContact.note = noteValue;
        } else if (hasSidebarHelpBoxHtml) {
          doc.sidebarContact.note = sidebarHelpBoxHtml;
        }
        doc.seo = seo;
      }
    }

    doc.isActive = isActive;

    const incomingTranslations = {
      ...pickLocalizedPayload(payload),
    };

    if (!isDefaultLang) {
      const ensureLangBucket = () => {
        const bucket = incomingTranslations[lang] || {};
        incomingTranslations[lang] = bucket;
        return bucket;
      };
      let bucket = null;
      const ensure = () => (bucket ||= ensureLangBucket());

      if (Object.prototype.hasOwnProperty.call(payload, "heroTitle")) {
        ensure().heroTitle = heroTitle;
      }
      if (
        Object.prototype.hasOwnProperty.call(payload, "heroSubtitle") ||
        Object.prototype.hasOwnProperty.call(payload, "heroIntro")
      ) {
        const value = heroSubtitle;
        const target = ensure();
        target.heroSubtitle = value;
        target.heroIntro = value;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "sections")) {
        ensure().sections = sections;
      }
      if (hasSidebarQuickFacts) {
        const target = ensure();
        target.quickFacts = sidebarQuickFacts;
        target.sidebar = {
          ...(target.sidebar || {}),
          quickFacts: sidebarQuickFacts,
        };
        target.sidebarContact = {
          ...(target.sidebarContact || {}),
          quickFacts: sidebarQuickFacts,
        };
      }

      if (hasSidebarHelpBoxHtml || noteProvided || hoursTextProvided) {
        const target = ensure();
        const contact = {
          ...(target.sidebarContact || {}),
        };
        if (hoursTextProvided) {
          contact.hoursText = hoursTextValue;
        }
        if (noteProvided) {
          contact.note = noteValue;
        } else if (hasSidebarHelpBoxHtml) {
          contact.note = sidebarHelpBoxHtml;
        }
        target.sidebarContact = contact;
        if (noteProvided || hasSidebarHelpBoxHtml) {
          target.sidebar = {
            ...(target.sidebar || {}),
            helpBoxHtml: noteProvided ? noteValue : sidebarHelpBoxHtml,
          };
        }
      }

      if (Object.prototype.hasOwnProperty.call(payload, "seo")) {
        ensure().seo = seo;
      }
    }

    syncDocTranslations(
      doc,
      incomingTranslations,
      buildShippingReturnsTrTranslation,
      applyShippingReturnsTrTranslation
    );

    await doc.save();

    const localized = resolveTranslation(doc, lang);
    const shaped = shapeToPage(localized);
    shaped.translations = composeResponseTranslations(
      doc,
      buildShippingReturnsTrTranslation
    );

    res.json({ page: shaped });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}
