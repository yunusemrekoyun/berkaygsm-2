import { http, toQueryString } from "./client.js";

export const orderApi = {
  async create({
    addressId,
    addressSnapshot = null,
    items,
    couponCode = null,
    note = null,
    paymentSimulation = null,
    paymentMethod = null,
    paymentProvider = null,
  }) {
    const body = { addressId, items, couponCode };
    if (addressSnapshot) body.addressSnapshot = addressSnapshot;
    if (note) body.note = note;
    if (paymentSimulation) body.paymentSimulation = paymentSimulation;
    if (paymentMethod) body.paymentMethod = paymentMethod;
    if (paymentProvider) body.paymentProvider = paymentProvider;
    const data = await http("/orders", {
      method: "POST",
      auth: true,
      body,
    });
    return data.order;
  },
  async createPaytr(payload) {
    const data = await http("/orders/paytr/create", {
      method: "POST",
      auth: true,
      body: payload,
    });
    return data;
  },
  async mine() {
    const data = await http("/orders/mine", { auth: true });
    return data.orders || [];
  },
  async get(id) {
    const data = await http(`/orders/${id}`, { auth: true });
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
