// frontend/src/api/campaigns.js
import { http, toQueryString } from "./client.js";
import { DEFAULT_LANG } from "../constants/lang.js";

// Sadece ID normalizasyonu için basit helper
const normalizeCampaignId = (value) => {
  if (!value) return "";

  if (typeof value === "object" && !Array.isArray(value)) {
    if (typeof value.slug === "string" && value.slug.trim()) {
      return value.slug.trim();
    }

    let raw =
      value.id ??
      value._id ??
      value.campaignId ??
      (value.campaign &&
        (value.campaign.id ||
          value.campaign._id ||
          (typeof value.campaign.toHexString === "function"
            ? value.campaign.toHexString()
            : null)));

    if (!raw) {
      if (typeof value.toHexString === "function") {
        raw = value.toHexString();
      } else if (
        typeof value.toString === "function" &&
        value.toString !== Object.prototype.toString
      ) {
        const str = value.toString();
        if (str && str !== "[object Object]") raw = str;
      }
    }

    if (!raw) return "";
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      return trimmed && trimmed !== "[object Object]" ? trimmed : "";
    }
    if (typeof raw === "number") return String(raw);
    if (typeof raw === "object") {
      if (typeof raw._id === "string" && raw._id.trim()) return raw._id.trim();
      if (typeof raw.id === "string" && raw.id.trim()) return raw.id.trim();
      if (typeof raw.toHexString === "function") return raw.toHexString();
      if (
        typeof raw.toString === "function" &&
        raw.toString !== Object.prototype.toString
      ) {
        const str = raw.toString();
        if (str && str !== "[object Object]") return str;
      }
    }

    const fallback = String(raw).trim();
    return fallback && fallback !== "[object Object]" ? fallback : "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed !== "[object Object]" ? trimmed : "";
  }
  if (typeof value === "number") return String(value);
  const fallback = String(value).trim();
  return fallback && fallback !== "[object Object]" ? fallback : "";
};

// Geçerli bir Mongo ObjectId string’i mi?
function isValidObjectId(str) {
  return typeof str === "string" && /^[0-9a-fA-F]{24}$/.test(str.trim());
}

// products / sets / categories / discounts için ID çıkarma
function extractIds(values) {
  if (!Array.isArray(values)) return [];
  const result = [];
  const seen = new Set();

  for (const value of values) {
    if (!value) continue;
    let id = null;

    if (typeof value === "string") {
      id = value.trim();
    } else if (typeof value === "object") {
      // Seçim komponentleri genelde { id, label, ... } veya { value, label } gönderir
      id =
        value.id ||
        value._id ||
        value.value ||
        (typeof value.toString === "function" ? value.toString() : null);
      if (typeof id === "string") id = id.trim();
    }

    if (!id) continue;

    // Sadece geçerli ObjectId string’lerini al
    if (isValidObjectId(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  return result;
}

// multipart/form-data payload üretici
function buildFormData(
  {
    name,
    description,
    badge,
    ctaText,
    layout,
    isActive,
    sortOrder,
    products,
    sets,
    categories,
    discounts,
    image,
  },
  { includeImage = true } = {}
) {
  const form = new FormData();

  if (name !== undefined) form.append("name", String(name).trim());
  if (description !== undefined)
    form.append("description", description == null ? "" : String(description));
  if (badge !== undefined)
    form.append("badge", badge == null ? "" : String(badge));
  if (ctaText !== undefined)
    form.append("ctaText", ctaText == null ? "" : String(ctaText));
  if (layout !== undefined) form.append("layout", String(layout).toUpperCase());
  if (isActive !== undefined) {
    form.append(
      "isActive",
      typeof isActive === "boolean"
        ? isActive
          ? "true"
          : "false"
        : String(isActive)
    );
  }
  if (sortOrder !== undefined) {
    form.append("sortOrder", String(sortOrder));
  }

  // 🔴 ÖNEMLİ DEĞİŞİKLİK:
  // Artık JSON.stringify ile tek field’a gömmüyoruz.
  // Her id’yi ayrı separate field olarak gönderiyoruz: products: id1, products: id2 ...
  const appendIds = (field, values) => {
    if (values === undefined) return;
    const arr = Array.isArray(values) ? values : values ? [values] : [];
    const ids = extractIds(arr);
    ids.forEach((id) => {
      form.append(field, id);
    });
  };

  appendIds("products", products);
  appendIds("sets", sets);
  appendIds("categories", categories);
  appendIds("discounts", discounts);

  if (includeImage && image instanceof File) {
    form.append("image", image);
  } else if (includeImage && image && image.originalFile instanceof File) {
    form.append("image", image.originalFile);
  }

  return form;
}

export const campaignApi = {
  async listHome(lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/campaigns${qs}`);
    return data.campaigns || [];
  },

  async listManage({ includeInactive = true } = {}, lang = DEFAULT_LANG) {
    const qs = toQueryString({
      includeInactive: includeInactive ? "true" : undefined,
      lang: lang ?? DEFAULT_LANG,
    });
    const data = await http(`/campaigns/manage${qs}`, { auth: true });
    return data.campaigns || [];
  },

  async get(id, lang = DEFAULT_LANG) {
    const identifier = normalizeCampaignId(id);
    if (!identifier) {
      throw new Error(
        JSON.stringify({ message: "Kampanya kimliği bulunamadı" })
      );
    }
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/campaigns/${identifier}${qs}`, { auth: true });
    return data.campaign;
  },

  async create(payload, lang = DEFAULT_LANG) {
    const form = buildFormData(payload, { includeImage: true });
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/campaigns${qs}`, {
      method: "POST",
      body: form,
      auth: true,
    });
    return data.campaign;
  },

  async update(id, payload, lang = DEFAULT_LANG) {
    const identifier = normalizeCampaignId(id);
    if (!identifier) {
      throw new Error(
        JSON.stringify({ message: "Kampanya kimliği bulunamadı" })
      );
    }
    const form = buildFormData(payload, {
      includeImage: payload.image !== undefined,
    });
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/campaigns/${identifier}${qs}`, {
      method: "PUT",
      body: form,
      auth: true,
    });
    return data.campaign;
  },

  async remove(id) {
    const identifier = normalizeCampaignId(id);
    if (!identifier) {
      throw new Error(
        JSON.stringify({ message: "Kampanya kimliği bulunamadı" })
      );
    }
    await http(`/campaigns/${identifier}`, { method: "DELETE", auth: true });
    return true;
  },

  async reorder(orders) {
    const normalized = (orders || [])
      .map((order) => ({
        id: normalizeCampaignId(order.id),
        sortOrder: order.sortOrder,
      }))
      .filter((order) => order.id);
    await http("/campaigns/reorder", {
      method: "POST",
      auth: true,
      body: { orders: normalized },
    });
    return true;
  },

  async resolve(id, lang = DEFAULT_LANG) {
    const identifier = normalizeCampaignId(id);
    if (!identifier) {
      throw new Error(
        JSON.stringify({ message: "Kampanya kimliği bulunamadı" })
      );
    }
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/campaigns/${identifier}/resolve${qs}`);
    return data;
  },
};
