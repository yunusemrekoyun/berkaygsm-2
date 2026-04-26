import { http } from "./client.js";

export const couponApi = {
  async getConfig() {
    const data = await http("/coupons/config");
    return data.config || null;
  },
  async updateConfig(payload) {
    const data = await http("/coupons/config", {
      method: "PUT",
      body: payload,
      auth: true,
    });
    return data.config || null;
  },
  async mine() {
    const data = await http("/coupons/mine", { auth: true });
    return data.coupons || [];
  },
  async list() {
    const data = await http("/coupons", { auth: true });
    return data.coupons || [];
  },
  async create(payload) {
    const data = await http("/coupons", {
      method: "POST",
      body: payload,
      auth: true,
    });
    return data.coupon;
  },
  async update(id, payload) {
    const data = await http(`/coupons/${id}`, {
      method: "PATCH",
      body: payload,
      auth: true,
    });
    return data.coupon;
  },
  async remove(id) {
    await http(`/coupons/${id}`, { method: "DELETE", auth: true });
    return true;
  },
  async apply({ code, subtotal, items = [] }) {
    const data = await http("/coupons/apply", {
      method: "POST",
      body: { code, subtotal, items },
      auth: true,
    });
    return data.coupon;
  },
};
