import { http } from "./client.js";

export const dashboardApi = {
  async overview() {
    return http("/dashboard/overview", { auth: true, ui: false });
  },
};
