import { http, toQueryString } from "./client.js";

export const userApi = {
  async list(params = {}) {
    const qs = toQueryString(params);
    return http(`/users${qs}`, { auth: true });
  },
  async get(idOrKey) {
    const data = await http(`/users/${encodeURIComponent(idOrKey)}`, {
      auth: true,
    });
    return data.user;
  },
  async update(idOrKey, payload) {
    const data = await http(`/users/${encodeURIComponent(idOrKey)}`, {
      method: "PATCH",
      body: payload,
      auth: true,
    });
    return data.user;
  },
  async softDelete(idOrKey) {
    const data = await http(
      `/users/${encodeURIComponent(idOrKey)}/soft-delete`,
      { method: "POST", auth: true }
    );
    return data.user;
  },
  async restore(idOrKey) {
    const data = await http(`/users/${encodeURIComponent(idOrKey)}/restore`, {
      method: "POST",
      auth: true,
    });
    return data.user;
  },
};
