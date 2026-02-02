import { http, toQueryString } from "./client";
import { uploadAsset } from "./uploads.js";
import { DEFAULT_LANG } from "../constants/lang.js";

const CONTACT_ENDPOINT = "/contact";

export const contactConfigApi = {
  async get(lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`${CONTACT_ENDPOINT}${qs}`);
    return data?.contact || null;
  },

  async update(payload, lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`${CONTACT_ENDPOINT}${qs}`, {
      method: "PUT",
      body: payload,
      auth: true,
    });
    return data?.contact || null;
  },
};

export const contactMessageApi = {
  async submit(payload) {
    return http(`${CONTACT_ENDPOINT}/messages`, {
      method: "POST",
      body: payload,
    });
  },
};

// Medya (Cloudinary) basit upload helper'ı
export const mediaApi = {
  async upload(file) {
    const asset = await uploadAsset(file, { scope: "contact" });
    if (!asset) throw new Error("Upload failed");
    return asset;
  },
};

// Geriye dönük uyumluluk: eski bileşenler bu isimle çağırıyor
export const contactPageApi = {
  get: contactConfigApi.get,
  upsert: contactConfigApi.update,
  async updateTranslations(payload, lang = DEFAULT_LANG) {
    const normalizedLang = lang ?? DEFAULT_LANG;
    const qs = toQueryString({ lang: normalizedLang });
    const body = {
      translations: {
        [normalizedLang]: payload,
      },
    };
    const data = await http(`${CONTACT_ENDPOINT}${qs}`, {
      method: "PUT",
      body,
      auth: true,
    });
    return data?.contact || null;
  },
};
