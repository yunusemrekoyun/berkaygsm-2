import { http, toQueryString } from "./client.js";
import { DEFAULT_LANG } from "../constants/lang.js";

export const shippingApi = {
  async getConfig(lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/shipping${qs}`);
    return (
      data?.shipping || {
        name: "Standart Kargo",
        fee: 0,
        freeThreshold: 0,
      }
    );
  },
  async updateConfig(payload, lang = DEFAULT_LANG) {
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/shipping${qs}`, {
      method: "PUT",
      body: payload,
      auth: true,
    });
    return data?.shipping || null;
  },
};
