import { http } from "./client.js";
import { DEFAULT_CUSTOMER_RECEIPT_CONFIG } from "../shared/customerReceiptConfig.js";

const FALLBACK = {
  ...DEFAULT_CUSTOMER_RECEIPT_CONFIG,
  updatedAt: null,
};

export const customerReceiptConfigApi = {
  async getConfig() {
    const data = await http("/print/customer-receipt-config");
    return data?.customerReceiptConfig || FALLBACK;
  },
  async updateConfig(payload) {
    const data = await http("/print/customer-receipt-config", {
      method: "PUT",
      body: payload,
      auth: true,
    });
    return data?.customerReceiptConfig || null;
  },
};
