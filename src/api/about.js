// src/api/about.js
import { http, toQueryString } from "./client.js";
import { DEFAULT_LANG } from "../constants/lang.js";
import { uploadAsset, appendAsset } from "./uploads.js";

export const aboutApi = {
  async get(lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    return await http(`/about${qs}`);
  },
  async update(payload, lang = DEFAULT_LANG) {
    const form = new FormData();
    const imageKeys = ["heroImage", "leftImage", "materialsImage"];
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (imageKeys.includes(key)) return;
      if (Array.isArray(value) || (value && typeof value === "object")) {
        form.append(key, JSON.stringify(value));
      } else {
        form.append(key, value ?? "");
      }
    });
    for (const key of imageKeys) {
      if (payload?.[key] === undefined) continue;
      const uploaded = await uploadAsset(payload[key], { scope: "about" });
      appendAsset(form, key, uploaded);
    }
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    return await http(`/about${qs}`, {
      method: "PUT",
      body: form,
      auth: true,
    });
  },
  async updateTranslations(payload, lang) {
    const form = new FormData();
    form.append(
      "translations",
      JSON.stringify({
        [lang]: payload,
      })
    );
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    return await http(`/about${qs}`, {
      method: "PUT",
      body: form,
      auth: true,
    });
  },
};
