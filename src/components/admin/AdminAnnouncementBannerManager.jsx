"use client";

import { useEffect, useRef, useState } from "react";
import { Megaphone, Loader2, Eye, EyeOff } from "lucide-react";
import { announcementBannerApi } from "../../api/announcementBanner.js";

const DEFAULT_FORM = {
  isEnabled: false,
  text: "",
  bgColor: "#0c4a6e",
  textColor: "#ffffff",
};

function BannerPreview({ text, bgColor, textColor, isEnabled }) {
  if (!isEnabled || !text) {
    return (
      <div
        className="flex h-9 items-center justify-center rounded-xl border border-dashed border-[var(--color-border-admin)] text-xs text-[var(--color-text-admin-muted)]"
      >
        Banner devre dışı veya metin boş — önizleme yok
      </div>
    );
  }

  const copies = Array.from({ length: 6 }, (_, i) => (
    <span key={i} className="mx-12 inline-block shrink-0 select-none">
      {text}
    </span>
  ));

  return (
    <>
      <style>{`
        @keyframes ab-preview-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ab-preview-track {
          animation: ab-preview-scroll 28s linear infinite;
        }
      `}</style>
      <div
        className="overflow-hidden rounded-xl"
        style={{ height: 36, backgroundColor: bgColor, color: textColor }}
      >
        <div
          className="ab-preview-track flex h-full items-center whitespace-nowrap text-sm font-medium"
          style={{ width: "max-content" }}
        >
          {copies}{copies}
        </div>
      </div>
    </>
  );
}

export default function AdminAnnouncementBannerManager() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saved, setSaved] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const successTimer = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const banner = await announcementBannerApi.getManage();
        if (!mounted) return;
        const data = {
          isEnabled: Boolean(banner?.isEnabled),
          text: banner?.text || "",
          bgColor: banner?.bgColor || "#0c4a6e",
          textColor: banner?.textColor || "#ffffff",
        };
        setForm(data);
        setSaved(data);
      } catch (err) {
        if (mounted) setError(err?.message || "Banner yüklenemedi");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    clearTimeout(successTimer.current);
    try {
      const updated = await announcementBannerApi.update({
        isEnabled: form.isEnabled,
        text: form.text.trim(),
        bgColor: form.bgColor,
        textColor: form.textColor,
      });
      const data = {
        isEnabled: Boolean(updated?.isEnabled),
        text: updated?.text || "",
        bgColor: updated?.bgColor || "#0c4a6e",
        textColor: updated?.textColor || "#ffffff",
      };
      setForm(data);
      setSaved(data);
      setSuccessMsg("Banner başarıyla güncellendi.");
      successTimer.current = setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err?.message || "Banner güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  const isDirty =
    form.isEnabled !== saved.isEnabled ||
    form.text !== saved.text ||
    form.bgColor !== saved.bgColor ||
    form.textColor !== saved.textColor;

  return (
    <div className="grid min-h-screen grid-cols-1 gap-6 xl:grid-cols-12 auto-rows-fr">
      <div className="xl:col-span-12 h-full flex flex-col">
        <div className="flex h-full flex-col rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
          {/* Başlık */}
          <div className="flex flex-col gap-2 mb-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs text-[var(--color-text-admin-muted)]">
              <Megaphone className="h-4 w-4" />
              Duyuru Şeridi
            </div>
            <h2 className="text-2xl font-semibold text-[var(--color-text-admin)]">
              Kayan Duyuru Şeridi
            </h2>
            <p className="text-sm text-[var(--color-text-admin-muted)]">
              Sitenin en üstünde kayan metinli bir duyuru şeridi gösterin. İndirim haberleri, kampanya duyuruları veya kargo bilgileri için kullanabilirsiniz.
            </p>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-admin-muted)]" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="flex flex-1 flex-col gap-8 max-w-2xl">
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {successMsg}
                </div>
              )}

              {/* Aktif / Pasif */}
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/30 px-5 py-4">
                <div>
                  <div className="font-medium text-[var(--color-text-admin)]">Şeridi göster</div>
                  <div className="text-xs text-[var(--color-text-admin-muted)]">
                    Kapalıyken şerit sitede görünmez
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => set("isEnabled", !form.isEnabled)}
                  className={[
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    form.isEnabled
                      ? "bg-[var(--color-accent)]"
                      : "bg-[var(--color-border-admin)]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block h-4 w-4 translate-y-0 rounded-full bg-white shadow transition-transform",
                      form.isEnabled ? "translate-x-6" : "translate-x-1",
                    ].join(" ")}
                  />
                </button>
              </div>

              {/* Metin */}
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--color-text-admin)]">
                  Şerit metni
                </span>
                <input
                  type="text"
                  value={form.text}
                  onChange={(e) => set("text", e.target.value)}
                  placeholder="🎉  Kargo bedava — 500 ₺ ve üzeri tüm siparişlerde"
                  disabled={saving}
                  className="w-full rounded-xl border border-[var(--color-border-admin)] bg-white px-4 py-2.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 disabled:opacity-60"
                />
                <span className="mt-1 block text-xs text-[var(--color-text-admin-muted)]">
                  Emoji ekleyebilirsiniz. Metin otomatik olarak sürekli dönecektir.
                </span>
              </label>

              {/* Renkler */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--color-text-admin)]">
                    Arka plan rengi
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.bgColor}
                      onChange={(e) => set("bgColor", e.target.value)}
                      disabled={saving}
                      className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--color-border-admin)] p-1 disabled:opacity-60"
                    />
                    <input
                      type="text"
                      value={form.bgColor}
                      onChange={(e) => set("bgColor", e.target.value)}
                      disabled={saving}
                      className="flex-1 rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm font-mono text-[var(--color-text-admin)] outline-none focus:border-[var(--color-accent)] disabled:opacity-60"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--color-text-admin)]">
                    Yazı rengi
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.textColor}
                      onChange={(e) => set("textColor", e.target.value)}
                      disabled={saving}
                      className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--color-border-admin)] p-1 disabled:opacity-60"
                    />
                    <input
                      type="text"
                      value={form.textColor}
                      onChange={(e) => set("textColor", e.target.value)}
                      disabled={saving}
                      className="flex-1 rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm font-mono text-[var(--color-text-admin)] outline-none focus:border-[var(--color-accent)] disabled:opacity-60"
                    />
                  </div>
                </label>
              </div>

              {/* Canlı önizleme */}
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--color-text-admin)]">
                  {form.isEnabled && form.text ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  Canlı Önizleme
                </div>
                <BannerPreview
                  text={form.text}
                  bgColor={form.bgColor}
                  textColor={form.textColor}
                  isEnabled={form.isEnabled}
                />
              </div>

              {/* Kaydet */}
              <div className="flex items-center gap-4 border-t border-[var(--color-border-admin)]/60 pt-6">
                <button
                  type="submit"
                  disabled={saving || !isDirty}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-6 py-2.5 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
                </button>
                {isDirty && (
                  <span className="text-xs text-[var(--color-text-admin-muted)]">
                    Kaydedilmemiş değişiklikler var
                  </span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
