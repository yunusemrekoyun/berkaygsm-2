import { http, toQueryString } from "./client.js";

export const orderApi = {
  async mine() {
    const data = await http("/orders/mine", { auth: true });
    return data.orders || [];
  },
  async get(id) {
    const data = await http(`/orders/${id}`, { auth: true });
    return data.order || null;
  },
  async track(idOrNumber) {
    const data = await http(`/orders/track/${encodeURIComponent(idOrNumber)}`);
    return data.order || null;
  },
  async adminList(params = {}) {
    const qs = toQueryString(params);
    return http(`/orders/admin${qs}`, { auth: true });
  },
  async adminGet(id) {
    const data = await http(`/orders/admin/${id}`, { auth: true });
    return data.order || null;
  },
  async adminUpdateStatus(id, payload) {
    const data = await http(`/orders/admin/${id}/status`, {
      method: "PATCH",
      body: payload,
      auth: true,
    });
    return data.order || null;
  },
};
