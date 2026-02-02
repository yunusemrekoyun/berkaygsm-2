// src/api/theme.js
// ------------------------------------------------------------
// Backend endpoint'leri:
//   GET    /api/theme            → herkese açık aktif tema
//   GET    /api/theme/manage     → admin için ayrıntılı sürüm
//   PUT    /api/theme            → admin tema kaydet/güncelle
// ------------------------------------------------------------

import { http } from "./client";

// Frontend tarafında global fetch arayüzü (http) zaten diğer apilerde de kullanılıyor.
// Bu dosya, theme controller yapısına tam uyumludur.

export const themeApi = {
  /**
   * Aktif temayı (public) getirir.
   * Bu genelde App açıldığında çalışır, sayfa temayı DOM’a uygular.
   * response: { theme: { activeKey, store, admin } }
   */
  async get() {
    try {
      const data = await http(`/theme`, {
        method: "GET",
        credentials: "include",
      });
      return (
        data?.theme || {
          activeKey: "ocean",
          store: {},
          admin: {},
        }
      );
    } catch (err) {
      console.error("themeApi.get error:", err);
      return { activeKey: "ocean", store: {}, admin: {} };
    }
  },

  /**
   * Yönetici arayüzü için tüm tema bilgilerini getirir.
   * (presets, storeVars, adminVars dahil)
   * endpoint: GET /api/theme/manage
   */
  async manage() {
    try {
      const data = await http(`/theme/manage`, {
        method: "GET",
        credentials: "include",
        auth: true,
      });
      return (
        data?.theme || {
          activeKey: "ocean",
          store: {},
          admin: {},
          presets: [],
        }
      );
    } catch (err) {
      console.error("themeApi.manage error:", err);
      return {
        activeKey: "ocean",
        store: {},
        admin: {},
        presets: [],
      };
    }
  },

  /**
   * Aktif temayı kaydeder veya günceller (admin).
   * @param {Object} payload - { activeKey, store, admin, presets? }
   * Backend bunu ThemeConfig modelinde kalıcı olarak tutar.
   * endpoint: PUT /api/theme
   */
  async saveActive(payload) {
    try {
      const data = await http(`/theme`, {
        method: "PUT",
        body: payload,
        auth: true,
        credentials: "include",
      });
      return (
        data?.theme || {
          activeKey: payload.activeKey || "custom",
          store: payload.store || {},
          admin: payload.admin || {},
        }
      );
    } catch (err) {
      console.error("themeApi.saveActive error:", err);
      return {
        activeKey: payload.activeKey || "custom",
        store: payload.store || {},
        admin: payload.admin || {},
      };
    }
  },
};
