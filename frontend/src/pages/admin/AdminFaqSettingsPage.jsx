// src/pages/admin/settings/AdminFaqSettingsPageInner.jsx
import { useEffect, useState } from "react";
import {
  FileQuestion,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Save,
  RefreshCcw,
  Type,
  MessageSquareText,
  Eye,
  Tags,
  ToggleLeft,
  ToggleRight,
  Languages,
} from "lucide-react";
import { faqApi } from "../../api/faq";
import FaqTranslationModal from "../../components/admin/faq/FaqTranslationModal.jsx";

const BASE_LANG = "tr";
const BASE_LANGUAGE_LABEL = "Türkçe (TR)";
const TRANSLATION_LANGS = [
  { value: "en", label: "English (EN)" },
  { value: "de", label: "Deutsch (DE)" },
];

const createEmptyFaq = () => ({
  heroTitle: "",
  heroIntro: "",
  isActive: true,
  sections: [],
  seo: { title: "", description: "", keywords: [] },
  translations: {},
});

const sortItems = (items = []) =>
  [...(Array.isArray(items) ? items : [])]
    .map((item) => ({ ...item }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

const sortSections = (sections = []) =>
  [...(Array.isArray(sections) ? sections : [])]
    .map((section) => ({
      ...section,
      items: sortItems(section.items),
    }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

const normalizeFaq = (raw = null) => {
  const base = raw ? { ...raw } : {};
  const merged = {
    ...createEmptyFaq(),
    ...base,
  };
  return {
    ...merged,
    sections: sortSections(base.sections || []),
    seo: {
      title: base.seo?.title || "",
      description: base.seo?.description || "",
      keywords: Array.isArray(base.seo?.keywords) ? base.seo.keywords : [],
    },
    translations: base.translations || {},
    updatedAt: base.updatedAt || merged.updatedAt || null,
    updatedBy: base.updatedBy || merged.updatedBy || null,
    id: base.id || merged.id || null,
  };
};

export default function AdminFaqSettingsPageInner() {
  const [data, setData] = useState(() => normalizeFaq());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);
  const [expanded, setExpanded] = useState({}); // section index -> open?
  const [translationState, setTranslationState] = useState({
    open: false,
    loading: false,
    faq: null,
    error: null,
  });

  const loadFaq = async () => {
    setLoading(true);
    setBanner(null);
    try {
      const res = await faqApi.manage(BASE_LANG);
      const normalized = normalizeFaq(res);
      setData(normalized);
      setTranslationState((prev) =>
        prev.open ? { ...prev, faq: normalized, error: null } : prev
      );
    } catch (e) {
      setBanner({ ok: false, msg: e?.message || "SSS yüklenemedi" });
      setData(normalizeFaq());
    } finally {
      setLoading(false);
    }
  };

  // initial load
  useEffect(() => {
    loadFaq();
  }, []);

  const updateRoot = (patch) => setData((p) => ({ ...p, ...patch }));

  const toggleSection = (i) =>
    setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  const addSection = () => {
    const next = {
      title: "Yeni Bölüm",
      subtitle: "",
      isActive: true,
      sortOrder: (data?.sections?.length || 0) + 1,
      items: [],
    };
    updateRoot({ sections: [...(data?.sections || []), next] });
    setExpanded((prev) => ({ ...prev, [data?.sections?.length || 0]: true }));
  };

  const removeSection = (i) => {
    if (!confirm("Bu bölümü ve sorularını silmek istiyor musun?")) return;
    const next = [...data.sections];
    next.splice(i, 1);
    updateRoot({ sections: next });
  };

  const updateSection = (i, patch) => {
    const next = [...data.sections];
    next[i] = { ...next[i], ...patch };
    updateRoot({ sections: next });
  };

  const addItem = (si) => {
    const sec = data.sections[si];
    const nextItem = {
      question: "Yeni Soru",
      answer: "",
      isActive: true,
      sortOrder: (sec.items?.length || 0) + 1,
    };
    updateSection(si, { items: [...(sec.items || []), nextItem] });
  };

  const updateItem = (si, qi, patch) => {
    const sec = data.sections[si];
    const items = [...(sec.items || [])];
    items[qi] = { ...items[qi], ...patch };
    updateSection(si, { items });
  };

  const removeItem = (si, qi) => {
    if (!confirm("Bu soruyu silmek istiyor musun?")) return;
    const sec = data.sections[si];
    const items = [...(sec.items || [])];
    items.splice(qi, 1);
    updateSection(si, { items });
  };

  const openTranslationModal = async () => {
    setTranslationState({
      open: true,
      loading: true,
      faq: null,
      error: null,
    });
    try {
      const res = await faqApi.manage(BASE_LANG);
      setTranslationState({
        open: true,
        loading: false,
        faq: normalizeFaq(res),
        error: null,
      });
    } catch (err) {
      setTranslationState({
        open: true,
        loading: false,
        faq: null,
        error: err?.message || "SSS içeriği yüklenemedi",
      });
    }
  };

  const closeTranslationModal = () => {
    setTranslationState({
      open: false,
      loading: false,
      faq: null,
      error: null,
    });
  };

  const handleTranslationsUpdated = async () => {
    await loadFaq();
  };

  const save = async () => {
    setSaving(true);
    setBanner(null);
    try {
      // sortOrder’ları normalize et
      const normalized = {
        ...data,
        sections: (data.sections || []).map((s, si) => ({
          ...s,
          sortOrder: si + 1,
          items: (s.items || []).map((it, qi) => ({
            ...it,
            sortOrder: qi + 1,
          })),
        })),
      };
      const saved = await faqApi.upsert(normalized, BASE_LANG);
      const nextData = normalizeFaq(saved || normalized);
      setData(nextData);
      setTranslationState((prev) =>
        prev.open ? { ...prev, faq: nextData } : prev
      );
      setBanner({ ok: true, msg: "SSS içeriği başarıyla kaydedildi." });
    } catch (e) {
      setBanner({ ok: false, msg: e?.message || "Kaydetme başarısız" });
    } finally {
      setSaving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const reset = async () => {
    if (!confirm("Değişiklikleri iptal edip yeniden yüklemek istiyor musun?")) return;
    setBanner(null);
    await loadFaq();
  };

  const content = loading ? (
    <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-8 text-[var(--color-text-admin-muted)]">
      SSS yapılandırması yükleniyor...
    </div>
  ) : (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="xl:col-span-8">
        <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6 shadow-sm">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs text-[var(--color-text-admin-muted)]">
              <FileQuestion className="h-4 w-4" />
              SSS Ayarları
            </div>
            <h2 className="text-2xl font-semibold">SSS Sayfa İçeriği</h2>
            <p className="text-sm text-[var(--color-text-admin-muted)]">
              Bölümleri, soru-cevapları ve SEO verilerini yönetin.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="flex-1 rounded-xl border border-[var(--color-border-admin)]/60 bg-[var(--color-bg-admin)]/40 px-3 py-2 text-[11px] text-[var(--color-text-admin-muted)]">
                Bu form{" "}
                <span className="font-semibold text-[var(--color-text-admin)]">
                  {BASE_LANGUAGE_LABEL}
                </span>{" "}
                içeriklerini günceller. İngilizce ve Almanca içerikler için “Dil varyantları”
                butonunu kullanın.
              </p>
              <button
                type="button"
                onClick={openTranslationModal}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
              >
                <Languages className="h-4 w-4" />
                Dil varyantları
              </button>
            </div>
          </div>

          {/* Banner */}
          {banner && (
            <div
              className={`mt-4 rounded-xl border p-3 text-sm ${
                banner.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {banner.msg}
            </div>
          )}

          {/* Global toggle */}
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/50 p-4">
            <div className="text-sm">
              <div className="font-semibold text-[var(--color-text-admin)]">
                Sayfa Görünürlüğü
              </div>
              <div className="text-[var(--color-text-admin-muted)]">
                SSS sayfasını genel olarak yayınlamak veya gizlemek için anahtarlayın.
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateRoot({ isActive: !data.isActive })}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-sm font-semibold hover:bg-[var(--color-bg-hover)]"
            >
              {data.isActive ? (
                <>
                  <ToggleRight className="h-5 w-5 text-emerald-600" />
                  Aktif
                </>
              ) : (
                <>
                  <ToggleLeft className="h-5 w-5 text-rose-600" />
                  Pasif
                </>
              )}
            </button>
          </div>

          {/* Hero text */}
          <section className="mt-6 grid gap-4 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/50 p-5">
            <Field
              icon={Type}
              label="Hero Başlığı"
              value={data.heroTitle || ""}
              onChange={(v) => updateRoot({ heroTitle: v })}
            />
            <TextArea
              icon={MessageSquareText}
              label="Giriş / Hero Paragrafı"
              value={data.heroIntro || ""}
              onChange={(v) => updateRoot({ heroIntro: v })}
              rows={3}
            />
          </section>

          {/* Sections */}
          <section className="mt-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--color-text-admin)]">
                SSS Bölümleri
              </h3>
              <button
                onClick={addSection}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
              >
                <Plus className="h-4 w-4" /> Bölüm Ekle
              </button>
            </div>

            {(data.sections || []).map((sec, si) => (
              <div
                key={si}
                className="overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] shadow-sm"
              >
                <button
                  onClick={() => toggleSection(si)}
                  className="flex w-full items-center justify-between border-b border-[var(--color-border-admin)] bg-white px-5 py-3 text-left hover:bg-[var(--color-bg-hover)]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        sec.isActive ? "bg-emerald-500" : "bg-rose-400"
                      }`}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        {sec.title || "Başlıksız bölüm"}
                      </span>
                      {sec.subtitle ? (
                        <span className="text-xs text-[var(--color-text-admin-muted)]">
                          {sec.subtitle}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {expanded[si] ? (
                    <ChevronUp className="h-5 w-5 text-accent" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-[var(--color-text-admin-muted)]" />
                  )}
                </button>

                {expanded[si] && (
                  <div className="space-y-4 bg-[var(--color-bg-card)] p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="Bölüm Başlığı"
                        value={sec.title || ""}
                        onChange={(v) => updateSection(si, { title: v })}
                      />
                      <Field
                        label="Alt Başlık"
                        value={sec.subtitle || ""}
                        onChange={(v) => updateSection(si, { subtitle: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-[var(--color-border-admin)]/70 bg-white px-3 py-2">
                      <div className="text-sm text-[var(--color-text-admin-muted)]">
                        Görünürlük
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateSection(si, { isActive: !sec.isActive })
                        }
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--color-bg-hover)]"
                      >
                        {sec.isActive ? (
                          <>
                            <ToggleRight className="h-4 w-4 text-emerald-600" />
                            Aktif
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-4 w-4 text-rose-600" />
                            Pasif
                          </>
                        )}
                      </button>
                    </div>

                    {/* Questions */}
                    <div className="mt-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Sorular</h4>
                        <button
                          onClick={() => addItem(si)}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)] px-2 py-1 text-xs font-semibold hover:bg-[var(--color-bg-hover)]"
                        >
                          <Plus className="h-3 w-3" /> Soru & Cevap Ekle
                        </button>
                      </div>

                      {(sec.items || []).map((it, qi) => (
                        <div
                          key={qi}
                          className="rounded-xl border border-[var(--color-border-admin)] bg-white p-3 transition hover:shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={it.question || ""}
                              onChange={(e) =>
                                updateItem(si, qi, { question: e.target.value })
                              }
                              placeholder="Soru"
                              className="flex-1 rounded-md border-none bg-transparent text-sm font-medium outline-none"
                            />
                            <button
                              onClick={() =>
                                updateItem(si, qi, { isActive: !it.isActive })
                              }
                              className={`rounded-full border px-2 py-1 text-xs font-semibold ${
                                it.isActive
                                  ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                                  : "border-rose-300 text-rose-600 hover:bg-rose-50"
                              }`}
                            >
                              {it.isActive ? "Aktif" : "Gizli"}
                            </button>
                            <button
                              onClick={() => removeItem(si, qi)}
                              className="rounded-full border border-rose-300 p-1.5 text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={it.answer || ""}
                            onChange={(e) =>
                              updateItem(si, qi, { answer: e.target.value })
                            }
                            placeholder="Cevap metni"
                            className="mt-2 w-full rounded-md border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-2 py-1 text-sm outline-none focus:border-accent"
                          />
                        </div>
                      ))}

                      {!sec.items?.length && (
                        <div className="rounded-xl border border-dashed border-[var(--color-border-admin)] p-3 text-center text-xs text-[var(--color-text-admin-muted)]">
                          Henüz soru yok
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => removeSection(si)}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" /> Bölümü Sil
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* SEO */}
          <section className="mt-8 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/50 p-5">
            <h4 className="mb-2 text-lg font-semibold">SEO</h4>
            <Field
              icon={Eye}
              label="SEO Başlığı"
              value={data.seo?.title || ""}
              onChange={(v) => updateRoot({ seo: { ...data.seo, title: v } })}
            />
            <TextArea
              label="SEO Açıklaması"
              value={data.seo?.description || ""}
              onChange={(v) =>
                updateRoot({ seo: { ...data.seo, description: v } })
              }
            />
            <Field
              icon={Tags}
              label="SEO Anahtar Kelimeleri (virgül ile ayırın)"
              value={(data.seo?.keywords || []).join(", ")}
              onChange={(v) =>
                updateRoot({
                  seo: {
                    ...data.seo,
                    keywords: v
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </section>

          {/* Save / Reset */}
          <div className="mt-6 flex justify-end gap-3 border-t border-[var(--color-border-admin)] pt-4">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold hover:bg-[var(--color-bg-hover)]"
            >
              <RefreshCcw className="h-4 w-4" /> Sıfırla
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-5 py-2.5 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90"
            >
              <Save className={`h-4 w-4 ${saving ? "animate-pulse" : ""}`} />
              {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="xl:col-span-4">
        <div className="sticky top-20 space-y-6">
          <TipsCard />
          <PreviewCard data={data} />
        </div>
      </aside>
    </div>
  );

  return (
    <div className="space-y-6">
      {content}
      <FaqTranslationModal
        open={translationState.open}
        loading={translationState.loading}
        error={translationState.error}
        faq={translationState.faq}
        baseLang={BASE_LANG}
        langs={TRANSLATION_LANGS}
        onClose={closeTranslationModal}
        onUpdated={handleTranslationsUpdated}
      />
    </div>
  );
}

/* ---- atoms ---- */
function Field({ icon: Icon, label, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase text-[var(--color-text-admin-muted)]">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        {Icon && (
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3, icon: Icon }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase text-[var(--color-text-admin-muted)]">
        {label}
      </label>
      <div className="mt-1 flex items-start gap-2">
        {Icon && (
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>
    </div>
  );
}

function TipsCard() {
  return (
    <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6 shadow-sm">
      <h3 className="text-lg font-semibold">İpuçları</h3>
      <ul className="mt-3 space-y-2 text-sm text-[var(--color-text-admin-muted)]">
        <li>Benzer konuları gruplayın (Siparişler, Kargo, İadeler...).</li>
        <li>Soruları kısa ve hızlı taranabilir tutun.</li>
        <li>Cevaplar kısa ve anlaşılır olmalı.</li>
        <li>SEO açıklamasını ~150 karakterde sınırlayın.</li>
      </ul>
    </div>
  );
}

function PreviewCard({ data }) {
  const totalQ =
    data?.sections?.reduce((sum, s) => sum + (s.items?.length || 0), 0) || 0;
  return (
    <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6 shadow-sm">
      <h3 className="text-lg font-semibold">Genel Bakış</h3>
      <div className="mt-3 space-y-1 text-sm text-[var(--color-text-admin-muted)]">
        <p>
          <strong>{data?.sections?.length || 0}</strong> bölüm
        </p>
        <p>
          <strong>{totalQ}</strong> toplam soru
        </p>
        <p>
          Son güncelleme:{" "}
          {new Date(data?.updatedAt || Date.now()).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
