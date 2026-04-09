import { http } from "./client.js";

const isFileLike = (value) =>
  typeof File !== "undefined" &&
  (value instanceof File || value instanceof Blob);

const resolveFile = (value) => {
  if (!value) return null;
  if (isFileLike(value)) return value;
  if (isFileLike(value.originalFile)) return value.originalFile;
  if (isFileLike(value.file)) return value.file;
  return null;
};

export const userDetailsApi = {
  async getAll() {
    const data = await http("/user-details/me", { auth: true });
    return data?.details || data || null;
  },
  async me() {
    return this.getAll();
  },
  async updateProfile({
    firstName,
    lastName,
    email,
    phone,
    maintenanceAnnouncementsEnabled,
    gender,
    birthDate,
  }) {
    const payload = {};
    if (firstName !== undefined) payload.firstName = String(firstName).trim();
    if (lastName !== undefined) payload.lastName = String(lastName).trim();
    if (email !== undefined) payload.email = String(email).trim();
    if (phone !== undefined) payload.phone = String(phone).trim();
    if (maintenanceAnnouncementsEnabled !== undefined) {
      payload.maintenanceAnnouncementsEnabled = Boolean(
        maintenanceAnnouncementsEnabled
      );
    }
    if (gender !== undefined) payload.gender = String(gender).trim();
    if (birthDate !== undefined) payload.birthDate = birthDate;

    const data = await http("/user-details/me", {
      method: "PUT",
      body: payload,
      auth: true,
    });

    return data?.details || data || null;
  },
  async uploadAvatar(file) {
    const avatarFile = resolveFile(file);
    if (!avatarFile) {
      throw new Error("Geçerli bir avatar dosyası gerekli");
    }
    const form = new FormData();
    form.append("avatar", avatarFile);
    const data = await http("/user-details/me/avatar", {
      method: "PATCH",
      body: form,
      auth: true,
    });
    return data?.avatar || null;
  },
  async listAddresses() {
    const details = await this.getAll();
    return details?.addresses || [];
  },
  async createAddress(payload) {
    const data = await http("/user-details/addresses", {
      method: "POST",
      body: payload,
      auth: true,
    });
    return data?.address || null;
  },
  async updateAddress(addressId, payload) {
    const data = await http(`/user-details/addresses/${addressId}`, {
      method: "PUT",
      body: payload,
      auth: true,
    });
    return data?.address || null;
  },
  async deleteAddress(addressId) {
    await http(`/user-details/addresses/${addressId}`, {
      method: "DELETE",
      auth: true,
    });
    return true;
  },
  async favorites() {
    const data = await http("/user-details/favorites", { auth: true });
    return data?.favorites || { products: [], sets: [] };
  },
  async toggleFavorite({ type, id }) {
    const data = await http("/user-details/favorites/toggle", {
      method: "POST",
      auth: true,
      body: { type, id },
    });
    return data;
  },
};
