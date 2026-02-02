import { http, toQueryString } from "./client.js";
import { uploadAsset, appendAsset } from "./uploads.js";
import { DEFAULT_LANG } from "../constants/lang.js";

export const categoryApi = {
  async list(params = {}, lang = DEFAULT_LANG) {
    const qs = toQueryString({ ...params, lang: lang ?? DEFAULT_LANG });
    const data = await http(`/categories${qs}`, { auth: true });
    return data.categories || [];
  },

  async tree(lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/categories/tree${qs}`, { auth: true });
    return data.categories || [];
  },

  async get(idOrSlug, lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/categories/${idOrSlug}${qs}`, { auth: true });
    return data.category;
  },

  async create(payload, lang = DEFAULT_LANG) {
    const form = new FormData();
    form.append("name", payload.name.trim());
    if (payload.parent) form.append("parent", payload.parent);
    if (payload.image) {
      const uploaded = await uploadAsset(payload.image, { scope: "categories" });
      appendAsset(form, "image", uploaded);
    }

    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/categories${qs}`, {
      method: "POST",
      body: form,
      auth: true,
    });
    return data.category;
  },

  async update(idOrSlug, payload, lang = DEFAULT_LANG) {
    const form = new FormData();
    if (payload.name !== undefined) form.append("name", payload.name.trim());
    if (payload.parent !== undefined)
      form.append("parent", payload.parent || "");
    if (payload.image) {
      const uploaded = await uploadAsset(payload.image, { scope: "categories" });
      appendAsset(form, "image", uploaded);
    }
    if (payload.removeImage !== undefined)
      form.append("removeImage", payload.removeImage ? "true" : "false");

    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/categories/${idOrSlug}${qs}`, {
      method: "PATCH",
      body: form,
      auth: true,
    });
    return data.category;
  },

  async remove(idOrSlug) {
    let safeId = idOrSlug;
    if (idOrSlug && typeof idOrSlug === "object") {
      safeId = idOrSlug.id || idOrSlug._id || `${idOrSlug}`;
    }
    safeId = String(safeId || "").trim();
    if (!safeId) {
      throw new Error(
        JSON.stringify({ message: "Silinecek kategori kimliği bulunamadı" })
      );
    }
    return http(`/categories/${safeId}`, {
      method: "DELETE",
      auth: true,
    });
  },
};
