// src/api/privacy.js
import { http, toQueryString } from "./client";
import { DEFAULT_LANG } from "../constants/lang.js";

const EMPTY = {
  heroTitle: "",
  heroIntro: "",
  sections: [],
  footerHtml: "",
  seo: { title: "", description: "", keywords: [] },
  isActive: true,
};

export const privacyApi = {
  async public(lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/privacy${qs}`);
    return data?.privacy || EMPTY;
  },

  async manage(lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/privacy/manage${qs}`, { auth: true });
    return data?.privacy || EMPTY;
  },

  async upsert(payload, lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/privacy${qs}`, {
      method: "PUT",
      body: payload,
      auth: true,
    });
    if (data?.privacy) return data.privacy;
    // backend bir şey döndürmediyse güncel halini al
    try {
      const fallback = await this.manage(lang);
      return fallback;
    } catch {
      return null;
    }
  },

  async updateTranslations(payload, lang = DEFAULT_LANG) {
    const normalizedLang = lang ?? DEFAULT_LANG;
    const qs = toQueryString({ lang: normalizedLang });
    const body = {
      translations: {
        [normalizedLang]: payload,
      },
    };
    const data = await http(`/privacy${qs}`, {
      method: "PUT",
      body,
      auth: true,
    });
    if (data?.privacy) return data.privacy;
    try {
      const fallback = await this.manage(lang);
      return fallback;
    } catch {
      return null;
    }
  },
};

export default privacyApi;
