// src/utils/theme.js

import { useEffect } from "react";
import { themeApi } from "../api/theme";

const THEME_STORAGE_KEY = "activeTheme";

function readStoredTheme() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function scheduleBackgroundRefresh(callback) {
  if (typeof window === "undefined") return () => {};

  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: 1200 });
    return () => window.cancelIdleCallback?.(id);
  }

  const timeoutId = window.setTimeout(callback, 250);
  return () => window.clearTimeout(timeoutId);
}

export function useThemeInit() {
  useEffect(() => {
    const savedTheme = readStoredTheme();
    if (savedTheme?.storeVars || savedTheme?.adminVars) {
      applyThemeVars({
        store: savedTheme.storeVars || {},
        admin: savedTheme.adminVars || {},
      });
    }

    let disposed = false;
    const cancel = scheduleBackgroundRefresh(async () => {
      try {
        const data = await themeApi.get(); // GET /api/theme
        if (!data || disposed) return;

        const storeVars = data?.store || {};
        const adminVars = data?.admin || {};
        applyThemeVars({ store: storeVars, admin: adminVars });

        // Performans için localStorage'a da kaydet
        window.localStorage.setItem(
          THEME_STORAGE_KEY,
          JSON.stringify({ storeVars, adminVars })
        );
      } catch (err) {
        if (!savedTheme) {
          console.error("useThemeInit error:", err);
        }
      }
    });

    return () => {
      disposed = true;
      cancel();
    };
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
