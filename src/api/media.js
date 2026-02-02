import { http, toQueryString } from "./client.js";
import { uploadAsset } from "./uploads.js";

export const mediaApi = {
  async usage() {
    const data = await http("/media/usage", { auth: true });
    return data.usage;
  },
  async list(params = {}) {
    const qs = toQueryString(params);
    const data = await http(`/media/resources${qs}`, { auth: true });
    return data;
  },
  async remove(publicId, params = {}) {
    const qs = toQueryString(params);
    return http(`/media/resources/${encodeURIComponent(publicId)}${qs}`, {
      method: "DELETE",
      auth: true,
    });
  },
  async upload(file, options = {}) {
    if (!file) {
      throw new Error("File is required");
    }
    const folderHint = String(options.folder || "").toLowerCase();
    const scope =
      options.scope ||
      (folderHint.includes("contact")
        ? "contact"
        : folderHint.includes("about")
        ? "about"
        : folderHint.includes("hero")
        ? "heroes"
        : "media");
    const asset = await uploadAsset(file, { scope });
    if (!asset) {
      throw new Error("Upload failed");
    }
    return asset;
  },
};
