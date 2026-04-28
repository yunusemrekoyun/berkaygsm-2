import {
  clearAuthState,
  getAccessToken,
  http,
  refreshAccessToken,
  toQueryString,
} from "./client.js";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");

async function fetchAdminPdfBlob(path, retry = true) {
  const response = await fetch(BASE_URL + path, {
    method: "GET",
    headers: getAccessToken()
      ? { Authorization: `Bearer ${getAccessToken()}` }
      : {},
    credentials: "include",
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return fetchAdminPdfBlob(path, false);
    clearAuthState();
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text || `HTTP ${response.status}`;
    try {
      message = JSON.parse(text)?.message || message;
    } catch {
      // ignore non-json error body
    }
    throw new Error(message);
  }

  return response.blob();
}

export const orderApi = {
  async mine() {
    const data = await http("/orders/mine", { auth: true });
    return data.orders || [];
  },
  async get(id) {
    const data = await http(`/orders/${id}`, { auth: true });
    return data.order || null;
  },
  async track(idOrNumber, email = null) {
    const qs = email ? `?email=${encodeURIComponent(email)}` : "";
    const data = await http(`/orders/track/${encodeURIComponent(idOrNumber)}${qs}`);
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
  async adminUploadInvoicePdf(id, file) {
    const formData = new FormData();
    formData.append("invoicePdf", file);
    const data = await http(`/orders/admin/${id}/invoice-pdf`, {
      method: "POST",
      body: formData,
      auth: true,
    });
    return data.order || null;
  },
  async adminGetInvoicePdfBlob(id) {
    return fetchAdminPdfBlob(`/orders/admin/${id}/invoice-pdf`);
  },
};
