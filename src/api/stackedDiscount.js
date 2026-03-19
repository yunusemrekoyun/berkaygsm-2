import { http } from "./client.js";

const STACKED_DISCOUNT_UPDATED_EVENT = "stacked-discount:updated";

function emitStackedDiscountUpdated() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(STACKED_DISCOUNT_UPDATED_EVENT));
  } catch {
    // ignore dispatch failures
  }
}

export const stackedDiscountApi = {
  async getPublic() {
    const data = await http("/stacked-discount", { cache: "no-store" });
    return data?.stackedDiscount || null;
  },

  async getManage() {
    const data = await http("/stacked-discount/manage", {
      auth: true,
      cache: "no-store",
    });
    return data?.stackedDiscount || null;
  },

  async update(payload = {}) {
    const data = await http("/stacked-discount/manage", {
      method: "PUT",
      body: payload,
      auth: true,
    });
    emitStackedDiscountUpdated();
    return data?.stackedDiscount || null;
  },
};

export { STACKED_DISCOUNT_UPDATED_EVENT };
