// src/api/faq.js
import { http, toQueryString } from "./client";
import { DEFAULT_LANG } from "../constants/lang.js";

export const faqApi = {
  // 🔹 Admin: FAQ içeriğini yönetim panelinde görüntülemek için
  async manage(lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/faq/manage${qs}`, { auth: true });
    return (
      data?.faq || {
        heroTitle: "",
        heroIntro: "",
        sections: [],
        seo: { title: "", description: "", keywords: [] },
        isActive: true,
      }
    );
  },

  // 🔹 Admin: FAQ içeriğini kaydetmek/güncellemek için
  async upsert(payload, lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/faq${qs}`, {
      method: "PUT",
      body: payload,
      auth: true,
    });
    return data?.faq;
  },

  async updateTranslations(payload, lang = DEFAULT_LANG) {
    const normalizedLang = lang ?? DEFAULT_LANG;
    const qs = toQueryString({ lang: normalizedLang });
    const body = {
      translations: {
        [normalizedLang]: payload,
      },
    };
    const data = await http(`/faq${qs}`, {
      method: "PUT",
      body,
      auth: true,
    });
    return data?.faq || null;
  },

  // 🔹 Public: Kullanıcıların sitede gördüğü dinamik FAQ verisini çekmek için
  async public(lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/faq${qs}`, { auth: false });
    return (
      data?.faq || {
        isActive: false,
        heroTitle: "Sıkça Sorulan Sorular",
        heroIntro: "",
        sections: [],
      }
    );
  },
};
