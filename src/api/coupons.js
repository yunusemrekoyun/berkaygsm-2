import { http } from "./client.js";

export const couponApi = {
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
  async apply({ code, subtotal }) {
    const data = await http("/coupons/apply", {
      method: "POST",
      body: { code, subtotal },
    });
    return data.coupon;
  },
};
