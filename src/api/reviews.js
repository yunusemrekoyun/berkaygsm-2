import { http, toQueryString } from "./client.js";

export const reviewApi = {
  async listForProduct({ idOrSlug, page = 1, limit = 5 } = {}) {
    if (!idOrSlug) throw new Error("Product identifier is required");
    const qs = toQueryString({ page, limit });
    return http(`/reviews/product/${encodeURIComponent(idOrSlug)}${qs}`);
  },

  async productStats(idOrSlug) {
    if (!idOrSlug) throw new Error("Product identifier is required");
    const data = await http(
      `/reviews/product/${encodeURIComponent(idOrSlug)}/stats`
    );
    return data?.stats || { avgRating: 0, count: 0 };
  },

  async listForSet({ idOrSlug, page = 1, limit = 5 } = {}) {
    if (!idOrSlug) throw new Error("Set identifier is required");
    const qs = toQueryString({ page, limit });
    return http(`/reviews/set/${encodeURIComponent(idOrSlug)}${qs}`);
  },

  async setStats(idOrSlug) {
    if (!idOrSlug) throw new Error("Set identifier is required");
    const data = await http(
      `/reviews/set/${encodeURIComponent(idOrSlug)}/stats`
    );
    return data?.stats || { avgRating: 0, count: 0 };
  },

  async create(payload) {
    return http("/reviews", {
      method: "POST",
      body: payload,
      auth: true,
    });
  },

  async summary() {
    const data = await http("/reviews/summary", { auth: true });
    return (
      data?.summary || {
        pending: 0,
        approved: 0,
        total: 0,
      }
    );
  },

  async listPending(params = {}) {
    const qs = toQueryString(params);
    return http(`/reviews/pending${qs}`, { auth: true });
  },

  async listAdmin(params = {}) {
    const qs = toQueryString(params);
    return http(`/reviews${qs}`, { auth: true });
  },

  async approve(id) {
    const data = await http(`/reviews/${id}/approve`, {
      method: "PATCH",
      auth: true,
    });
    return data?.review || null;
  },

  async remove(id) {
    await http(`/reviews/${id}`, { method: "DELETE", auth: true });
    return true;
  },

  async homeFeatured(limit = 3) {
    const qs = limit ? `?limit=${encodeURIComponent(limit)}` : "";
    const data = await http(`/reviews/home${qs}`);
    return Array.isArray(data?.reviews) ? data.reviews : [];
  },
};
