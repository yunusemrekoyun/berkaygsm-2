import { http, toQueryString } from "./client.js";

export const adminNotificationsApi = {
  async list(params = {}) {
    const query = toQueryString(params);
    return http(`/admin-notifications${query}`, {
      auth: true,
      ui: false,
    });
  },

  async markRead(ids = []) {
    return http("/admin-notifications/mark-read", {
      method: "POST",
      auth: true,
      ui: false,
      body: Array.isArray(ids) && ids.length ? { ids } : {},
    });
  },
};
