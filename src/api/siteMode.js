import { http } from "./client.js";

export const siteModeApi = {
  async getManage() {
    const data = await http("/site-mode/manage", {
      auth: true,
      ui: false,
    });
    return data?.siteMode || null;
  },
  async updateManage(maintenanceModeEnabled) {
    const data = await http("/site-mode/manage", {
      method: "PUT",
      auth: true,
      body: { maintenanceModeEnabled: Boolean(maintenanceModeEnabled) },
    });
    return data?.siteMode || null;
  },
};
