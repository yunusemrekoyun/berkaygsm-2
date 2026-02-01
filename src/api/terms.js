// src/api/terms.js
import { http, toQueryString } from "./client";
import { DEFAULT_LANG } from "../constants/lang.js";

export const termsApi = {
  async get(lang = DEFAULT_LANG) {
    return this.manage(lang);
  },
  async public(lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/terms${qs}`);
    // { terms: {...} } şeklinde geliyor
    return data?.terms || null;
  },
  async manage(lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/terms/manage${qs}`, { auth: true });
    return (
      data?.terms || {
        heroTitle: "Terms of Service",
        heroIntro: "",
        sections: [],
        footerNote: "", // ← ÖNEMLİ
        isActive: true,
        seo: { title: "", description: "", keywords: [] },
      }
    );
  },
  async upsert(payload, lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/terms${qs}`, {
      method: "PUT",
      body: payload,
      auth: true,
    });
    return data?.terms || null; // her zaman unwrap
  },

  async updateTranslations(payload, lang = DEFAULT_LANG) {
    const normalizedLang = lang ?? DEFAULT_LANG;
    const qs = toQueryString({ lang: normalizedLang });
    const body = {
      translations: {
        [normalizedLang]: payload,
      },
    };
    const data = await http(`/terms${qs}`, {
      method: "PUT",
      body,
      auth: true,
    });
    return data?.terms || null;
  },
};
