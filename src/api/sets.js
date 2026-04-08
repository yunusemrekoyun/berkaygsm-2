import { http, toQueryString } from "./client.js";
import { uploadAssets, appendAssetList } from "./uploads.js";
import { DEFAULT_LANG } from "../constants/lang.js";

function normalizeSetIdOrSlug(value) {
  if (!value) return "";

  if (typeof value === "object" && !Array.isArray(value)) {
    if (typeof value.slug === "string" && value.slug.trim()) {
      return value.slug.trim();
    }

    let raw =
      value.id ??
      value._id ??
      value.setId ??
      (value.set &&
        (value.set.id ||
          value.set._id ||
          (typeof value.set.toHexString === "function"
            ? value.set.toHexString()
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
}

async function buildSetFormData(payload = {}) {
  const form = new FormData();
  if (payload.name !== undefined) form.append("name", payload.name.trim());
  if (payload.description !== undefined)
    form.append("description", payload.description.trim());
  if (payload.price !== undefined) form.append("price", String(payload.price));
  if (payload.show !== undefined)
    form.append("show", payload.show ? "true" : "false");
  if (payload.sku !== undefined) form.append("sku", payload.sku || "");
  if (payload.categoryId !== undefined)
    form.append("categoryId", payload.categoryId || "");

  if (payload.products) {
    // sadece { productId, quantity } listesi
    form.append("products", JSON.stringify(payload.products));
  }

  // Set'in kendi görselleri
  const uploadedImages = await uploadAssets(payload.images || [], {
    scope: "sets",
  });
  appendAssetList(form, "images", uploadedImages);

  if (payload.removeImagePublicIds?.length) {
    form.append(
      "removeImagePublicIds",
      JSON.stringify(payload.removeImagePublicIds)
    );
  }

  return form;
}

export const setApi = {
  async list(params = {}, lang = DEFAULT_LANG) {
    const qs = toQueryString({ ...params, lang: lang ?? DEFAULT_LANG });
    const data = await http(`/sets${qs}`, {
      auth: Boolean(params?.includeHidden),
    });
    return data.sets || [];
  },
  async get(
    idOrSlug,
    lang = DEFAULT_LANG,
    { auth = false } = {}
  ) {
    const identifier = normalizeSetIdOrSlug(idOrSlug);
    if (!identifier) {
      throw new Error(JSON.stringify({ message: "Set kimliği bulunamadı" }));
    }
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/sets/${identifier}${qs}`, { auth });
    return data.set;
  },
  async create(payload, lang = DEFAULT_LANG) {
    const form = await buildSetFormData(payload);
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    return http(`/sets${qs}`, { method: "POST", body: form, auth: true });
  },
  async update(idOrSlug, payload, lang = DEFAULT_LANG) {
    const identifier = normalizeSetIdOrSlug(idOrSlug);
    if (!identifier) {
      throw new Error(JSON.stringify({ message: "Set kimliği bulunamadı" }));
    }
    const form = await buildSetFormData(payload);
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    return http(`/sets/${identifier}${qs}`, {
      method: "PUT",
      body: form,
      auth: true,
    });
  },
  async remove(idOrSlug) {
    const identifier = normalizeSetIdOrSlug(idOrSlug);
    if (!identifier) {
      throw new Error(JSON.stringify({ message: "Set kimliği bulunamadı" }));
    }
    return http(`/sets/${identifier}`, { method: "DELETE", auth: true });
  },
};
