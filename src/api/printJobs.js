import { http } from "./client.js";

export const printJobApi = {
  async getOrderJob(orderId) {
    const data = await http(`/print-jobs/order/${encodeURIComponent(orderId)}`, {
      auth: true,
    });
    return data?.job || null;
  },
  async requeueOrder(orderId) {
    const data = await http(
      `/print-jobs/order/${encodeURIComponent(orderId)}/requeue`,
      {
        method: "POST",
        auth: true,
      }
    );
    return data?.job || null;
  },
};
