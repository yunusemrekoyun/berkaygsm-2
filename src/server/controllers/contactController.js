import ContactConfig from "../models/ContactConfig.js";
import ContactMessage from "../models/ContactMessage.js";
import { ZodError } from "zod";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";
import {
  isTurnstileConfigured,
  verifyTurnstileToken,
} from "../utils/turnstile.js";
import {
  DEFAULT_LANG,
  normalizeLang,
  resolveTranslation,
  pickLocalizedPayload,
  syncDocTranslations,
  composeResponseTranslations,
} from "../utils/i18n.js";
import { contactMessageSchema } from "../validation/schemas.js";

// küçük yardımcılar
const parseBool = (v, fb = false) => {
  if (v === undefined || v === null) return fb;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(s)) return true;
    if (["0", "false", "no", "off"].includes(s)) return false;
  }
  return fb;
};
const normalizeLines = (val) => {
  if (!val) return [];
  if (Array.isArray(val))
    return val
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
  if (typeof val === "string") {
    try {
      const arr = JSON.parse(val);
      if (Array.isArray(arr))
        return arr
          .map(String)
          .map((s) => s.trim())
          .filter(Boolean);
    } catch {}
    // tek satır girilmişse onu da kabul et
    return [val.trim()].filter(Boolean);
  }
  return [];
};

async function getOrCreateConfig() {
  let cfg = await ContactConfig.findOne({ key: "default" });
  if (!cfg) {
    cfg = await ContactConfig.create({
      key: "default",
      addressBlock: {
        title: "Mağazamızı ziyaret edin",
        lines: [
          "Kurfürstendamm 45, 10719 Berlin",
          "Showroom & mağazadan teslim (randevu önerilir)",
        ],
      },
      hoursBlock: {
        title: "Çalışma saatleri (CET)",
        lines: [
          "Pzt – Cum: 09:00 – 18:00",
          "Cmt: 10:00 – 16:00 (showroom)",
          "Paz ve resmi tatiller: kapalı",
        ],
      },
      emailBlock: {
        title: "Müşteri hizmetleri",
        lines: ["destek@berkaygsm.com", "Ortalama dönüş süresi: < 24 saat"],
      },
      phoneBlock: {
        title: "Telefon",
        lines: [
          "+49 (0) 30 234 567 89",
          "WhatsApp & Signal aynı numaradan",
        ],
      },
    });
  }
  return cfg;
}

function buildContactTrTranslation(doc) {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const safeBlock = (block = {}) => ({
    title: block?.title ?? "",
    lines: Array.isArray(block?.lines) ? [...block.lines] : [],
  });

  return {
    heroTitle: plain.heroTitle ?? "",
    heroSubtitle: plain.heroSubtitle ?? "",
    addressBlock: safeBlock(plain.addressBlock),
    hoursBlock: safeBlock(plain.hoursBlock),
    emailBlock: safeBlock(plain.emailBlock),
    phoneBlock: safeBlock(plain.phoneBlock),
    successMessage: plain.successMessage ?? "",
  };
}

function applyContactTrTranslation(doc, translation = {}) {
  if (!translation || typeof translation !== "object") return;

  if (translation.heroTitle !== undefined) {
    doc.heroTitle = translation.heroTitle;
  }
  if (translation.heroSubtitle !== undefined) {
    doc.heroSubtitle = translation.heroSubtitle;
  }
  if (translation.successMessage !== undefined) {
    doc.successMessage = translation.successMessage;
  }

  const applyBlock = (path, value) => {
    if (value === undefined) return;
    const target = doc[path] ?? {};
    if (value.title !== undefined) {
      target.title = value.title;
    }
    if (value.lines !== undefined) {
      target.lines = normalizeLines(value.lines);
    }
    doc[path] = target;
  };

  applyBlock("addressBlock", translation.addressBlock);
  applyBlock("hoursBlock", translation.hoursBlock);
  applyBlock("emailBlock", translation.emailBlock);
  applyBlock("phoneBlock", translation.phoneBlock);
}

/** PUBLIC: Contact config getir
 * GET /api/contact
 */
export async function getContact(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const cfg = await getOrCreateConfig();
    const resolved = resolveTranslation(cfg, lang);
    resolved.translations = composeResponseTranslations(
      cfg,
      buildContactTrTranslation
    );
    resolved.security = {
      captchaEnabled: isTurnstileConfigured(),
    };
    res.json({ contact: resolved });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/** ADMIN: Contact config güncelle
 * PUT /api/contact
 * Body alanları:
 * - heroTitle, heroSubtitle, formEnabled, successMessage
 * - addressBlock: { title, lines }, hoursBlock, emailBlock, phoneBlock
 * - heroImage: dosya (field name: heroImage) veya {url, publicId} objesi
 */
export async function updateContact(req, res) {
  try {
    const lang = normalizeLang(req.query.lang || DEFAULT_LANG);
    const {
      heroTitle,
      heroSubtitle,
      formEnabled,
      successMessage,
      addressBlock,
      hoursBlock,
      emailBlock,
      phoneBlock,
      // alternatif: text JSON olarak da gelebilir
    } = req.body;

    let cfg = await ContactConfig.findOne({ key: "default" });
    if (!cfg) cfg = new ContactConfig({ key: "default" });
    const incomingTranslations = pickLocalizedPayload(req.body);
    const ensureLangBucket = () => {
      const bucketLang = normalizeLang(lang);
      incomingTranslations[bucketLang] = {
        ...(incomingTranslations[bucketLang] || {}),
      };
      return incomingTranslations[bucketLang];
    };

    const parseBlockPayload = (raw) => {
      let value = raw;
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch {
          value = {};
        }
      }
      return {
        title: value?.title != null ? String(value.title) : "",
        lines: normalizeLines(value?.lines),
      };
    };

    if (heroTitle !== undefined) {
      const normalizedTitle = String(heroTitle);
      if (lang === DEFAULT_LANG) {
        cfg.heroTitle = normalizedTitle;
      } else {
        ensureLangBucket().heroTitle = normalizedTitle;
      }
    }
    if (heroSubtitle !== undefined) {
      const normalizedSubtitle = String(heroSubtitle);
      if (lang === DEFAULT_LANG) {
        cfg.heroSubtitle = normalizedSubtitle;
      } else {
        ensureLangBucket().heroSubtitle = normalizedSubtitle;
      }
    }
    if (successMessage !== undefined) {
      const normalizedMessage = String(successMessage);
      if (lang === DEFAULT_LANG) {
        cfg.successMessage = normalizedMessage;
      } else {
        ensureLangBucket().successMessage = normalizedMessage;
      }
    }
    if (formEnabled !== undefined)
      cfg.formEnabled = parseBool(formEnabled, cfg.formEnabled);

    const updateBlock = (key, raw) => {
      const parsed = parseBlockPayload(raw);
      if (lang === DEFAULT_LANG) {
        const target = cfg[key] || {};
        target.title = parsed.title;
        target.lines = parsed.lines;
        cfg[key] = target;
      } else {
        const bucket = ensureLangBucket();
        bucket[key] = parsed;
      }
    };

    if (addressBlock !== undefined) updateBlock("addressBlock", addressBlock);
    if (hoursBlock !== undefined) updateBlock("hoursBlock", hoursBlock);
    if (emailBlock !== undefined) updateBlock("emailBlock", emailBlock);
    if (phoneBlock !== undefined) updateBlock("phoneBlock", phoneBlock);

    // heroImage upload: ya dosya gelir (upload.single) ya da body’de url/publicId verilir
    if (req.file) {
      // eski görseli sil
      if (cfg.heroImage?.publicId) {
        await deleteFromCloudinary(cfg.heroImage.publicId).catch(() => {});
      }
      const up = await uploadBufferToCloudinary(req.file.buffer);
      cfg.heroImage = {
        url: up.secure_url,
        publicId: up.public_id,
        width: up.width,
        height: up.height,
        format: up.format,
      };
    } else if (req.body.heroImage) {
      const img =
        typeof req.body.heroImage === "string"
          ? JSON.parse(req.body.heroImage)
          : req.body.heroImage;
      cfg.heroImage = {
        url: img?.url || cfg.heroImage?.url || "",
        publicId: img?.publicId || cfg.heroImage?.publicId || "",
        width: img?.width || cfg.heroImage?.width,
        height: img?.height || cfg.heroImage?.height,
        format: img?.format || cfg.heroImage?.format,
      };
    }

    syncDocTranslations(
      cfg,
      incomingTranslations,
      buildContactTrTranslation,
      applyContactTrTranslation
    );

    await cfg.save();

    const resolved = resolveTranslation(cfg, lang);
    resolved.translations = composeResponseTranslations(
      cfg,
      buildContactTrTranslation
    );
    res.json({ contact: resolved });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

/** PUBLIC: Form gönder (ContactMessage oluştur)
 * POST /api/contact/messages
 * body: { name, email, phone?, subject, message, hp? }  // hp = honeypot
 */
export async function submitMessage(req, res) {
  try {
    const body = req.body || {};
    const hp = String(body.hp || "").trim();

    // basit honeypot
    if (hp) {
      return res.status(200).json({ ok: true }); // sessizce kabul (spam)
    }

    const {
      name,
      email,
      phone = "",
      subject,
      message,
      turnstileToken = null,
    } =
      contactMessageSchema.parse(body);

    if (isTurnstileConfigured()) {
      if (!turnstileToken) {
        return res.status(400).json({
          message: "Lütfen doğrulama adımını tamamlayın.",
        });
      }

      const turnstileResult = await verifyTurnstileToken({
        token: turnstileToken,
        remoteIp: req.ip || "",
        expectedHostname: process.env.TURNSTILE_EXPECTED_HOSTNAME || "",
      });

      if (!turnstileResult?.success) {
        return res.status(400).json({
          message: "Doğrulama başarısız oldu. Lütfen tekrar deneyin.",
          details: turnstileResult?.["error-codes"] || [],
        });
      }
    }

    const doc = await ContactMessage.create({
      user: req.userId || null,
      name,
      email,
      phone,
      subject,
      message,
      ip: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
    });

    // Burada (opsiyonel) e-posta bildirimi tetikleyebilirsin.
    // await sendMail(...)

    res.status(201).json({ ok: true, id: doc._id.toString() });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        message: err.issues?.[0]?.message || "Geçersiz istek içeriği",
        details: err.issues,
      });
    }
    res.status(400).json({ message: err.message });
  }
}

/** ADMIN: Mesajları listele
 * GET /api/contact/messages?status=new|resolved|all&page=&limit=&search=
 */
export async function listMessages(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const status = String(req.query.status || "all").toLowerCase();
    const search = String(req.query.search || "").trim();

    const filter = {};
    if (status === "new") filter.status = "new";
    else if (status === "resolved") filter.status = "resolved";

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { name: regex },
        { email: regex },
        { subject: regex },
        { message: regex },
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      ContactMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ContactMessage.countDocuments(filter),
    ]);

    res.json({
      messages: items.map((m) => ({
        id: m._id.toString(),
        name: m.name,
        email: m.email,
        phone: m.phone,
        subject: m.subject,
        message: m.message,
        status: m.status,
        createdAt: m.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/** ADMIN: Mesaj durum güncelle
 * PATCH /api/contact/messages/:id
 * body: { status: "new" | "resolved" }
 */
export async function updateMessageStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!["new", "resolved"].includes(status))
      return res.status(400).json({ message: "Geçersiz durum" });

    const msg = await ContactMessage.findById(id);
    if (!msg) return res.status(404).json({ message: "Mesaj bulunamadı" });

    msg.status = status;
    await msg.save();

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

/** ADMIN: Mesaj sil
 * DELETE /api/contact/messages/:id
 */
export async function deleteMessage(req, res) {
  try {
    const { id } = req.params;
    await ContactMessage.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}
