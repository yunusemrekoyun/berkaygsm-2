// src/api/shippingReturns.js
import { http, toQueryString } from "./client";
import { DEFAULT_LANG } from "../constants/lang.js";

export const shippingReturnsApi = {
  async get(lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG, _: Date.now() });
    const data = await http(`/shipping-returns${qs}`);
    return (
      data?.page || {
        heroTitle: "",
        heroSubtitle: "",
        sections: [],
        sidebar: { quickFacts: [], helpBoxHtml: "" },
        seo: { title: "", description: "", keywords: [] },
        isActive: true,
      }
    );
  },

  async manage(lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/shipping-returns/manage${qs}`, { auth: true });
    return (
      data?.page || {
        heroTitle: "",
        heroSubtitle: "",
        sections: [],
        sidebar: { quickFacts: [], helpBoxHtml: "" },
        seo: { title: "", description: "", keywords: [] },
        isActive: true,
      }
    );
  },

  async upsert(payload, lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/shipping-returns${qs}`, {
      method: "PUT",
      body: payload,
      auth: true,
    });
    if (data?.page) return data.page;
    if (data?.success || data?.ok) {
      // hemen ardından yönetim endpoint'inden güncel içeriği çek
      const refreshed = await this.manage(lang).catch(() => null);
      return refreshed || payload; // hiçbir şey dönmezse son payload’ı koru
    }
    // fallback
    return payload;
  },

  async updateTranslations(payload, lang = DEFAULT_LANG) {
    const normalizedLang = lang ?? DEFAULT_LANG;
    const qs = toQueryString({ lang: normalizedLang });
    const body = {
      translations: {
        [normalizedLang]: payload,
      },
    };
    const data = await http(`/shipping-returns${qs}`, {
      method: "PUT",
      body,
      auth: true,
    });
    if (data?.page) return data.page;
    try {
      const fallback = await this.manage(lang);
      return fallback;
    } catch {
      return null;
    }
  },
};
