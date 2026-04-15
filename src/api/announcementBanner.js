import { http } from "./client.js";

export const announcementBannerApi = {
  async getPublic() {
    const data = await http("/announcement-banner");
    return data.banner;
  },

  async getManage() {
    const data = await http("/announcement-banner/manage", { auth: true });
    return data.banner;
  },

  async update(payload) {
    const data = await http("/announcement-banner/manage", {
      method: "PUT",
      body: payload,
      auth: true,
    });
    return data.banner;
  },
};
