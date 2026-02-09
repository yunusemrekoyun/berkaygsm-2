import { http, toQueryString } from "./client.js";

export const analyticsApi = {
  async overview(params = {}) {
    const query = toQueryString(params);
    return http(`/analytics/overview${query}`, { auth: true, ui: false });
  },
  async visitsOverview(params = {}) {
    const query = toQueryString(params);
    return http(`/analytics/visits-overview${query}`, { auth: true, ui: false });
  },
  async trackVisit(payload) {
    return http("/analytics/track-visit", {
      method: "POST",
      body: payload,
      ui: false,
    });
  },
};
