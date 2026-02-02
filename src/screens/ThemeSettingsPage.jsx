// src/pages/admin/ThemeSettingsPage.jsx
import { useEffect, useState } from "react";
import { themeApi } from "../api/theme";
import { applyThemeVars } from "../utils/theme";
import {
  CheckCircle2,
  Loader2,
  Save,
  PaintBucket,
  Sparkles,
} from "lucide-react";

/**
 * Hazır paletler: mevcut index.css'teki renkler "rose" preset’i olarak alındı.
 * İstersen burada palette’leri çoğaltabilirsin.
 */
const THEME_PRESETS = [
  {
    key: "rose",
    name: "Gül (Mevcut)",
    store: {
      "--color-primary": "#5C2A35", // derin bordo
      "--color-secondary": "#8A4D5B",
      "--color-accent": "#D87C82",
      "--color-accent-hover": "#C4646D",
      "--color-surface": "#F0D9D9",
      "--color-surface-light": "#F9ECEC",
      "--color-surface-hover": "#FFF6F6",
      "--color-border": "#E1BFC2",
      "--color-contact-bg": "#FFF9F8",
    },
    admin: {
      "--color-bg-admin": "#FDF7F9",
      "--color-text-admin": "#3B0A24",
      "--color-bg-card": "#FFFFFF",
      "--color-bg-hover": "#FDE2E7",
      "--color-bg-sidebar": "#9D174D",
      "--color-text-sidebar": "#FFFFFF",
      "--color-text-admin-muted": "#6B7280",
      "--color-border-admin": "#FBCFE8",
    },
    swatch: ["#5C2A35", "#D87C82", "#F0D9D9", "#9D174D"],
  },

  {
    key: "forest",
    name: "Orman",
    store: {
      "--color-primary": "#064E3B",
      "--color-secondary": "#0F766E",
      "--color-accent": "#10B981",
      "--color-accent-hover": "#059669",
      "--color-surface": "#ECFDF5",
      "--color-surface-light": "#F0FFF9",
      "--color-surface-hover": "#FFFFFF",
      "--color-border": "#A7F3D0",
      "--color-contact-bg": "#F0FFF9",
    },
    admin: {
      "--color-bg-admin": "#F8FFFC",
      "--color-text-admin": "#052E27",
      "--color-bg-card": "#FFFFFF",
      "--color-bg-hover": "#D1FAE5",
      "--color-bg-sidebar": "#065F46",
      "--color-text-sidebar": "#FFFFFF",
      "--color-text-admin-muted": "#64748B",
      "--color-border-admin": "#A7F3D0",
    },
    swatch: ["#064E3B", "#10B981", "#ECFDF5", "#065F46"],
  },

  {
    key: "ocean",
    name: "Okyanus",
    store: {
      "--color-primary": "#0C4A6E",
      "--color-secondary": "#0369A1",
      "--color-accent": "#38BDF8",
      "--color-accent-hover": "#0EA5E9",
      "--color-surface": "#F0F9FF",
      "--color-surface-light": "#F5FBFF",
      "--color-surface-hover": "#FFFFFF",
      "--color-border": "#BAE6FD",
      "--color-contact-bg": "#F5FBFF",
    },
    admin: {
      "--color-bg-admin": "#F7FBFF",
      "--color-text-admin": "#0B2A45",
      "--color-bg-card": "#FFFFFF",
      "--color-bg-hover": "#E0F2FE",
      "--color-bg-sidebar": "#0EA5E9",
      "--color-text-sidebar": "#FFFFFF",
      "--color-text-admin-muted": "#64748B",
      "--color-border-admin": "#BAE6FD",
    },
    swatch: ["#0C4A6E", "#38BDF8", "#F0F9FF", "#0EA5E9"],
  },

  {
    key: "grape",
    name: "Üzüm",
    store: {
      "--color-primary": "#4C1D95",
      "--color-secondary": "#6D28D9",
      "--color-accent": "#A78BFA",
      "--color-accent-hover": "#8B5CF6",
      "--color-surface": "#F5F3FF",
      "--color-surface-light": "#F8F7FF",
      "--color-surface-hover": "#FFFFFF",
      "--color-border": "#DDD6FE",
      "--color-contact-bg": "#F8F7FF",
    },
    admin: {
      "--color-bg-admin": "#FBFAFF",
      "--color-text-admin": "#2B1762",
      "--color-bg-card": "#FFFFFF",
      "--color-bg-hover": "#EDE9FE",
      "--color-bg-sidebar": "#6D28D9",
      "--color-text-sidebar": "#FFFFFF",
      "--color-text-admin-muted": "#6B7280",
      "--color-border-admin": "#E9D5FF",
    },
    swatch: ["#4C1D95", "#A78BFA", "#F5F3FF", "#6D28D9"],
  },

  // 🌅 Sunset — sıcak tonlar
  {
    key: "sunset",
    name: "Günbatımı",
    store: {
      "--color-primary": "#7C2D12",
      "--color-secondary": "#B45309",
      "--color-accent": "#F97316",
      "--color-accent-hover": "#EA580C",
      "--color-surface": "#FFF7ED",
      "--color-surface-light": "#FFF1E6",
      "--color-surface-hover": "#FFFFFF",
      "--color-border": "#FED7AA",
      "--color-contact-bg": "#FFF4E5",
    },
    admin: {
      "--color-bg-admin": "#FFF7ED",
      "--color-text-admin": "#451A03",
      "--color-bg-card": "#FFFFFF",
      "--color-bg-hover": "#FFEDD5",
      "--color-bg-sidebar": "#C2410C",
      "--color-text-sidebar": "#FFF7ED",
      "--color-text-admin-muted": "#78350F",
      "--color-border-admin": "#FDBA74",
    },
    swatch: ["#C2410C", "#F97316", "#FFF7ED", "#FDBA74"],
  },

  // ❄️ Nordic — soğuk mavi tonlar, profesyonel görünüm
  {
    key: "nordic",
    name: "Nordik",
    store: {
      "--color-primary": "#1E293B",
      "--color-secondary": "#334155",
      "--color-accent": "#0EA5E9",
      "--color-accent-hover": "#0284C7",
      "--color-surface": "#F1F5F9",
      "--color-surface-light": "#F8FAFC",
      "--color-surface-hover": "#FFFFFF",
      "--color-border": "#E2E8F0",
      "--color-contact-bg": "#FFFFFF",
    },
    admin: {
      "--color-bg-admin": "#F8FAFC",
      "--color-text-admin": "#0F172A",
      "--color-bg-card": "#FFFFFF",
      "--color-bg-hover": "#E0F2FE",
      "--color-bg-sidebar": "#1E3A8A",
      "--color-text-sidebar": "#F8FAFC",
      "--color-text-admin-muted": "#475569",
      "--color-border-admin": "#CBD5E1",
    },
    swatch: ["#1E3A8A", "#0EA5E9", "#F1F5F9", "#CBD5E1"],
  },
];

function PresetCard({ preset, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(preset)}
      className={[
        "w-full rounded-2xl border p-4 text-left transition",
        active
          ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30"
          : "border-[var(--color-border-admin)] hover:bg-[var(--color-bg-hover)]",
        "bg-[var(--color-bg-card)]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold">{preset.name}</div>
        {active ? (
          <CheckCircle2 className="h-5 w-5 text-[var(--color-accent)]" />
        ) : (
          <PaintBucket className="h-5 w-5 text-[var(--color-text-admin-muted)]" />
        )}
      </div>
      <div className="mt-3 flex gap-2">
        {preset.swatch?.map((c) => (
          <span
            key={c}
            className="h-7 w-7 rounded-md border border-[var(--color-border-admin)]"
            style={{ background: c }}
          />
        ))}
      </div>
    </button>
  );
}

export default function ThemeSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeKey, setActiveKey] = useState("ocean");
  const [previewKey, setPreviewKey] = useState(null);

  // İlk yüklemede backend'deki aktif temayı çek ve DOM'a uygula
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const server = await themeApi.get(); // { activeKey, store, admin }
        if (!mounted) return;

        setActiveKey(server.activeKey || "ocean");
        // DOM'a uygula
        applyThemeVars({ store: server.store, admin: server.admin });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Önizleme: kullanıcı kartlara tıklayınca hemen DOM'a uygula
  useEffect(() => {
    if (!previewKey) return;
    const preset = THEME_PRESETS.find((p) => p.key === previewKey);
    if (!preset) return;
    applyThemeVars({ store: preset.store, admin: preset.admin });
  }, [previewKey]);

  async function handleSave() {
    const preset =
      THEME_PRESETS.find((p) => p.key === (previewKey || activeKey)) ||
      THEME_PRESETS[0];
    if (!preset) return;

    setSaving(true);
    try {
      const saved = await themeApi.saveActive({
        activeKey: preset.key,
        store: preset.store,
        admin: preset.admin,
      });

      // DB'nin döndürdüğü kesin değerleri DOM'a uygula
      applyThemeVars({ store: saved.store, admin: saved.admin });

      setActiveKey(saved.activeKey || preset.key);
      setPreviewKey(null);

      // (İsteğe bağlı) localStorage ile ilk boyamayı hızlandır
      localStorage.setItem(
        "__theme_vars__",
        JSON.stringify({ store: saved.store, admin: saved.admin })
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
        <div className="flex items-center gap-2 text-[var(--color-text-admin-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Tema yükleniyor…
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="xl:col-span-8">
        <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
          <div className="flex flex-col gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs text-[var(--color-text-admin-muted)]">
              <Sparkles className="h-4 w-4" />
              Görünüm
            </div>
            <h2 className="text-2xl font-semibold">Tema & Renkler</h2>
            <p className="text-sm text-[var(--color-text-admin-muted)]">
              Mağaza vitrini ve yönetim panelini yeniden renklendirmek için bir
              palet seçin. Seçiminiz tüm site genelinde uygulanır.
            </p>
          </div>

          {/* Preset grid */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {THEME_PRESETS.map((p) => (
              <PresetCard
                key={p.key}
                preset={p}
                active={(previewKey || activeKey) === p.key}
                onSelect={(pp) => setPreviewKey(pp.key)}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || (!previewKey && activeKey)}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-5 py-2 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Aktif Olarak Kaydet
            </button>
            {previewKey && (
              <button
                onClick={() => {
                  setPreviewKey(null);
                  // Aktif temaya geri dön
                  const preset =
                    THEME_PRESETS.find((p) => p.key === activeKey) ||
                    THEME_PRESETS[0];
                  if (preset)
                    applyThemeVars({
                      store: preset.store,
                      admin: preset.admin,
                    });
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-5 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
              >
                Önizlemeyi İptal Et
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ipuçları */}
      <aside className="xl:col-span-4">
        <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
          <h3 className="text-lg font-semibold">İpuçları</h3>
          <ul className="mt-4 space-y-3 text-sm text-[var(--color-text-admin-muted)]">
            <li>Önizleme geçicidir; kalıcı yapmak için kaydedin.</li>
            <li>Kaydedilen tema vitrin ve yönetim panelinde geçerli olur.</li>
            <li>İstediğiniz zaman kodda yeni paletler ekleyebilirsiniz.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
