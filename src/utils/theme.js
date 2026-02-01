// src/utils/theme.js

import { useEffect } from "react";
import { themeApi } from "../api/theme";

export function useThemeInit() {
  useEffect(() => {
    (async () => {
      try {
        const data = await themeApi.get(); // GET /api/theme
        if (!data) return;

        const storeVars = data?.store || {};
        const adminVars = data?.admin || {};
        applyThemeVars({ store: storeVars, admin: adminVars });

        // Performans için localStorage'a da kaydet
        localStorage.setItem(
          "activeTheme",
          JSON.stringify({ storeVars, adminVars })
        );
      } catch (err) {
        console.error("useThemeInit error:", err);
        // eğer offline/500 olursa son localStorage temayı uygula
        const saved = localStorage.getItem("activeTheme");
        if (saved) {
          const { storeVars, adminVars } = JSON.parse(saved);
          applyThemeVars({ store: storeVars, admin: adminVars });
        }
      }
    })();
  }, []);
}
// DOM'a CSS değişkenlerini uygular
export function applyThemeVars({ store = {}, admin = {} } = {}) {
  const root = document.documentElement;
  const setMany = (scopeEl, varsObj) => {
    Object.entries(varsObj || {}).forEach(([k, v]) => {
      if (k && typeof v === "string") scopeEl.style.setProperty(k, v);
    });
  };

  // storefront tarafı (global)
  setMany(root, store);

  // admin isimlendirmen "admin" scope içinde değil değişken adları zaten var(--color-...) biçiminde.
  // admin tarafı için de aynı root'a yazıyoruz (admin sayfaları bunları kullanıyor)
  setMany(root, admin);
}

// hazır preset -> applyThemeVars formatına dönüştür
export function presetToVars(preset) {
  return {
    store: preset.store, // { '--color-primary': '#...' ... }
    admin: preset.admin, // { '--color-bg-admin': '#...' ... }
  };
}
