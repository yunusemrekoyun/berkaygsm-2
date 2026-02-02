import { useEffect, useMemo, useState } from "react";
import { termsApi } from "../../api/terms";
import TermsTranslationModal from "../../components/admin/terms/TermsTranslationModal.jsx";
import { Link } from "react-router-dom";
import {
  Loader2,
  Save,
  Eye,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Info,
  List,
  Tags,
  Globe,
  ToggleLeft,
  ToggleRight,
  Languages,
} from "lucide-react";

const BASE_LANG = "tr";
const BASE_LANGUAGE_LABEL = "Türkçe (TR)";
const TRANSLATION_LANGS = [
  { value: "en", label: "English (EN)" },
  { value: "de", label: "Deutsch (DE)" },
];

/** ------- Empty Model (UI state) ------- */
const EMPTY_MODEL = {
  heroTitle: "",
  heroIntro: "",
  sections: [], // [{ title, paragraphs:[] }]
  footerNote: "",
  seo: { title: "", description: "", keywords: [] },
  isActive: true,
};

export default function TermsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);
  const [form, setForm] = useState(EMPTY_MODEL);
  const [translationState, setTranslationState] = useState({
    open: false,
    loading: false,
    terms: null,
    error: null,
  });

  const loadTerms = async () => {
    setLoading(true);
    try {
      const data = await termsApi.manage(BASE_LANG);
      setForm(normalizeIncoming(data));
      setBanner(null);
      setTranslationState((prev) =>
        prev.open
          ? {
              ...prev,
              terms: data,
              error: null,
            }
          : prev
      );
    } catch (e) {
      setBanner({
        variant: "danger",
        message: extractMessage(e) || "Şartlar içeriği yüklenemedi.",
      });
      setForm(EMPTY_MODEL);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, []);

  const canSave = useMemo(() => {
    if (!form.heroTitle?.trim()) return false;
    if (!Array.isArray(form.sections)) return false;
    return true;
  }, [form]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = normalizeOutgoing(form);
      const updated = await termsApi.upsert(payload, BASE_LANG);

      if (updated) {
        const srv = normalizeIncoming(updated);
        setForm((prev) => deepMergeKeepDraft(prev, srv));
        setTranslationState((prev) =>
          prev.open
            ? {
                ...prev,
                terms: updated,
                error: null,
              }
            : prev
        );
      }
      setBanner({
        variant: "success",
        message: "Kullanım Koşulları içeriği başarıyla kaydedildi.",
      });
    } catch (e) {
      setBanner({
        variant: "danger",
        message: extractMessage(e) || "İçerik kaydedilemedi.",
      });
    } finally {
      setSaving(false);
    }
  }

  const openTranslationModal = async () => {
    setTranslationState({
      open: true,
      loading: true,
      terms: null,
      error: null,
    });
    try {
      const data = await termsApi.manage(BASE_LANG);
      setTranslationState({
        open: true,
        loading: false,
        terms: data,
        error: null,
      });
    } catch (error) {
      setTranslationState({
        open: true,
        loading: false,
        terms: null,
        error: extractMessage(error) || "Çeviri içeriği yüklenemedi.",
      });
    }
  };

  const closeTranslationModal = () => {
    setTranslationState({
      open: false,
      loading: false,
      terms: null,
      error: null,
    });
  };

  const handleTranslationsUpdated = async () => {
    await loadTerms();
  };

  function toggleActive() {
    setForm((prev) => ({ ...prev, isActive: !prev.isActive }));
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="xl:col-span-8">
        {/* Header */}
        <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
          <div className="flex flex-col gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs text-[var(--color-text-admin-muted)]">
              <Sparkles className="h-4 w-4" />
              İçerik • Kullanım Koşulları
            </div>
            <h1 className="text-2xl font-semibold">Kullanım Koşulları Sayfası</h1>
            <p className="text-sm text-[var(--color-text-admin-muted)]">
              Başlığı, girişi, madde bölümlerini ve alt bilgi notunu yönetin. Bu ayarlar kamuya açık{" "}
              <code className="rounded bg-[var(--color-bg-hover)] px-1 py-0.5">
                /terms
              </code>{" "}
              sayfasını kontrol eder.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="flex-1 rounded-xl border border-[var(--color-border-admin)]/60 bg-[var(--color-bg-admin)]/40 px-3 py-2 text-[11px] text-[var(--color-text-admin-muted)]">
                Bu form{" "}
                <span className="font-semibold text-[var(--color-text-admin)]">
                  {BASE_LANGUAGE_LABEL}
                </span>{" "}
                içeriklerini düzenler. Diğer diller için “Dil varyantları” butonunu kullanın.
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

          {banner ? (
            <div
              className={`mt-4 rounded-xl border p-4 text-sm ${
                banner.variant === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {banner.message}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saving || loading}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-5 py-2 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Değişiklikleri kaydet
            </button>

            <Link
              to="/terms"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-5 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
            >
              <Eye className="h-4 w-4" />
              Önizleme
            </Link>

            <button
              type="button"
              onClick={toggleActive}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
              title={form.isActive ? "Sayfayı pasifleştir" : "Sayfayı etkinleştir"}
            >
              {form.isActive ? (
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
        </div>

        {/* Hero */}
        <div className="mt-6 rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-[var(--color-text-admin-muted)]" />
            <h2 className="text-lg font-semibold">Hero</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-6">
              <Label>Sayfa Başlığı</Label>
              <Input
                value={form.heroTitle}
                onChange={(e) =>
                  setForm((p) => ({ ...p, heroTitle: e.target.value }))
                }
                placeholder="Kullanım Koşulları"
              />
            </div>
            <div className="md:col-span-6">
              <Label>Giriş</Label>
              <Input
                value={form.heroIntro}
                onChange={(e) =>
                  setForm((p) => ({ ...p, heroIntro: e.target.value }))
                }
                placeholder="Sayfa için kısa bir giriş..."
              />
            </div>
          </div>
        </div>

        {/* Sections Editor */}
        <SectionsEditor
          sections={form.sections}
          onChange={(next) => setForm((p) => ({ ...p, sections: next }))}
        />

        {/* Footer Note */}
        <div className="mt-6 rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-[var(--color-text-admin-muted)]" />
            <h2 className="text-lg font-semibold">Alt Bilgi Notu</h2>
          </div>
          <textarea
            rows={3}
            value={form.footerNote || ""}
            onChange={(e) =>
              setForm((p) => ({ ...p, footerNote: e.target.value }))
            }
            placeholder="Son güncelleme: ..."
            className="mt-2 w-full rounded-2xl border border-[var(--color-border-admin)] bg-white px-4 py-3 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)] focus:ring-2 focus:ring-[var(--color-text-admin)]/10"
          />
        </div>

        {/* SEO */}
        <SEOEditor
          seo={form.seo}
          onChange={(next) => setForm((p) => ({ ...p, seo: next }))}
        />
      </div>

      {/* Tips */}
      <aside className="xl:col-span-4">
        <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
          <h3 className="text-lg font-semibold">İpuçları</h3>
          <ul className="mt-4 space-y-3 text-sm text-[var(--color-text-admin-muted)]">
            <li>Uzun metinleri başlıklı ve anlaşılır bölümlere ayırın.</li>
            <li>Giriş isteğe bağlıdır; kısa tutun.</li>
            <li>Şeffaflık için “Son güncelleme” notu ekleyin.</li>
            <li>Daha iyi arama sonuçları için SEO metalarını doldurun.</li>
          </ul>
        </div>
      </aside>
    </div>

      <TermsTranslationModal
        open={translationState.open}
        loading={translationState.loading}
        error={translationState.error}
        terms={translationState.terms}
        baseLang={BASE_LANG}
        langs={TRANSLATION_LANGS}
        onClose={closeTranslationModal}
        onUpdated={handleTranslationsUpdated}
      />
    </div>
  );
}

/** ---------------- Sections Editor ---------------- */
function SectionsEditor({ sections = [], onChange }) {
  function addSection() {
    onChange([...sections, { title: "", paragraphs: [""] }]);
  }
  function updateSection(index, patch) {
    const next = sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  }
  function removeSection(index) {
    onChange(sections.filter((_, i) => i !== index));
  }
  function move(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  }

  return (
    <div className="mt-6 rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <List className="h-5 w-5 text-[var(--color-text-admin-muted)]" />
          <h2 className="text-lg font-semibold">Bölümler</h2>
        </div>
        <button
          type="button"
          onClick={addSection}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Bölüm ekle
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border-admin)] p-6 text-sm text-[var(--color-text-admin-muted)]">
          Henüz bölüm yok. Başlamak için “Bölüm ekle”ye tıklayın.
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((s, i) => (
            <article
              key={i}
              className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/40 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-admin-muted)]">
                  <GripVertical className="h-4 w-4" />
                  Bölüm {i + 1}
                </div>
                <div className="flex items-center gap-2">
                  <IconButton onClick={() => move(i, -1)} title="Yukarı taşı">
                    <ChevronUp className="h-4 w-4" />
                  </IconButton>
                  <IconButton onClick={() => move(i, +1)} title="Aşağı taşı">
                    <ChevronDown className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    onClick={() => removeSection(i)}
                    danger
                    title="Bölümü kaldır"
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-6">
                  <Label>Bölüm Başlığı</Label>
                  <Input
                    value={s.title}
                    onChange={(e) =>
                      updateSection(i, { title: e.target.value })
                    }
                    placeholder="1. Kapsam ve sözleşmenin kurulması"
                  />
                </div>
              </div>

              <div className="mt-4">
                <Label>Paragraflar</Label>
                <MultiText
                  values={s.paragraphs || []}
                  onChange={(vals) => updateSection(i, { paragraphs: vals })}
                  placeholder="Paragraf ekleyin..."
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/** ---------------- SEO Editor ---------------- */
function SEOEditor({ seo, onChange }) {
  const model = seo || { title: "", description: "", keywords: [] };
  const [kwInput, setKwInput] = useState("");

  function addKeyword() {
    const v = kwInput.trim();
    if (!v) return;
    const next = Array.from(new Set([...(model.keywords || []), v]));
    onChange({ ...model, keywords: next });
    setKwInput("");
  }
  function removeKeyword(k) {
    onChange({
      ...model,
      keywords: (model.keywords || []).filter((x) => x !== k),
    });
  }

  return (
    <div className="mt-6 rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <Globe className="h-5 w-5 text-[var(--color-text-admin-muted)]" />
        <h2 className="text-lg font-semibold">SEO</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="md:col-span-6">
          <Label>Meta başlık</Label>
          <Input
            value={model.title || ""}
            onChange={(e) => onChange({ ...model, title: e.target.value })}
            placeholder="Kullanım Koşulları — Berkay GSM"
          />
        </div>
        <div className="md:col-span-6">
          <Label>Meta açıklama</Label>
          <Input
            value={model.description || ""}
            onChange={(e) =>
              onChange({ ...model, description: e.target.value })
            }
            placeholder="Kullanım Koşullarımızı okuyun..."
          />
        </div>
      </div>

      <div className="mt-4">
        <Label>Anahtar kelimeler</Label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {(model.keywords || []).map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-1 text-xs font-semibold text-[var(--color-text-admin)]"
            >
              <Tags className="h-3.5 w-3.5" />
              {k}
              <button
                type="button"
                className="rounded-full p-1 hover:bg-[var(--color-bg-hover)]"
                onClick={() => removeKeyword(k)}
                title="Anahtar kelimeyi kaldır"
              >
                ✕
              </button>
            </span>
          ))}
          <div className="inline-flex items-center gap-2">
            <input
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              placeholder="Anahtar kelime ekle"
              className="rounded-full border border-[var(--color-border-admin)] bg-white px-3 py-1 text-xs outline-none focus:border-[var(--color-text-admin)]"
            />
            <button
              type="button"
              onClick={addKeyword}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold hover:bg-[var(--color-bg-hover)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ---------------- Tiny UI ---------------- */
function Label({ children }) {
  return (
    <label className="block text-sm font-semibold text-[var(--color-text-admin)]">
      {children}
    </label>
  );
}
function Input({ value, onChange, placeholder }) {
  return (
    <input
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder}
      className="mt-2 w-full rounded-2xl border border-[var(--color-border-admin)] bg-white px-4 py-3 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)] focus:ring-2 focus:ring-[var(--color-text-admin)]/10"
    />
  );
}
function IconButton({ children, onClick, danger, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-full border px-2 py-1 text-[var(--color-text-admin)] transition hover:bg-[var(--color-bg-hover)] ${
        danger
          ? "border-rose-300 text-rose-600 hover:bg-rose-50"
          : "border-[var(--color-border-admin)]"
      }`}
    >
      {children}
    </button>
  );
}
function MultiText({ values = [], onChange, placeholder }) {
  function setValue(index, v) {
    const next = values.map((x, i) => (i === index ? v : x));
    onChange(next);
  }
  function add() {
    onChange([...(values || []), ""]);
  }
  function remove(index) {
    onChange(values.filter((_, i) => i !== index));
  }
  function move(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    const [it] = next.splice(index, 1);
    next.splice(target, 0, it);
    onChange(next);
  }
  return (
    <div className="space-y-2">
      {(values || []).map((v, i) => (
        <div key={i} className="flex items-start gap-2">
          <textarea
            rows={3}
            value={v}
            onChange={(e) => setValue(i, e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-2xl border border-[var(--color-border-admin)] bg-white px-4 py-3 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)] focus:ring-2 focus:ring-[var(--color-text-admin)]/10"
          />
          <div className="mt-1 flex flex-col gap-1">
            <IconButton onClick={() => move(i, -1)} title="Yukarı taşı">
              <ChevronUp className="h-4 w-4" />
            </IconButton>
            <IconButton onClick={() => move(i, +1)} title="Aşağı taşı">
              <ChevronDown className="h-4 w-4" />
            </IconButton>
            <IconButton onClick={() => remove(i)} danger title="Kaldır">
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold hover:bg-[var(--color-bg-hover)]"
      >
        <Plus className="h-3.5 w-3.5" />
        Paragraf ekle
      </button>
    </div>
  );
}

/** ---------------- Normalizers & Utils ---------------- */
function normalizeIncoming(data) {
  const safe = { ...EMPTY_MODEL, ...(data || {}) };
  safe.heroTitle = String(safe.heroTitle || "");
  safe.heroIntro = String(safe.heroIntro || "");
  safe.footerNote = String(safe.footerNote || "");
  safe.sections = Array.isArray(safe.sections) ? safe.sections : [];
  safe.seo = {
    title: String(safe.seo?.title || ""),
    description: String(safe.seo?.description || ""),
    keywords: Array.isArray(safe.seo?.keywords) ? safe.seo.keywords : [],
  };
  safe.isActive = safe.isActive !== false;
  return safe;
}

function normalizeOutgoing(form) {
  return {
    heroTitle: String(form.heroTitle || "").trim(),
    heroIntro: String(form.heroIntro || "").trim(),
    sections: (form.sections || []).map((s) => ({
      title: String(s.title || "").trim(),
      paragraphs: (s.paragraphs || []).map((p) => String(p ?? "")),
    })),
    footerNote: String(form.footerNote || ""),
    seo: {
      title: String(form.seo?.title || "").trim(),
      description: String(form.seo?.description || "").trim(),
      keywords: (form.seo?.keywords || []).map((x) => String(x ?? "")),
    },
    isActive: Boolean(form.isActive),
  };
}

function deepMergeKeepDraft(prev, srv) {
  const out = {
    ...prev,
    ...srv,
    seo: { ...(prev.seo || {}), ...(srv.seo || {}) },
  };

  const srvSecs = Array.isArray(srv.sections) ? srv.sections : undefined;
  const prevSecs = Array.isArray(prev.sections) ? prev.sections : [];
  if (!srvSecs) out.sections = prevSecs;
  else if (srvSecs.length === 0 && prevSecs.length > 0) out.sections = prevSecs;
  else {
    out.sections = srvSecs.map((ss, i) => {
      const ps = prevSecs[i] || {};
      return {
        title: ss.title ?? ps.title ?? "",
        paragraphs: Array.isArray(ss.paragraphs)
          ? mergeArrayKeepDraft(ps.paragraphs, ss.paragraphs)
          : ps.paragraphs || [],
      };
    });
  }

  if (typeof srv.isActive === "undefined") out.isActive = prev.isActive;
  return out;
}

function mergeArrayKeepDraft(prevArr = [], srvArr = []) {
  const max = Math.max(prevArr.length, srvArr.length);
  const out = [];
  for (let i = 0; i < max; i++) {
    const p = prevArr[i];
    const s = srvArr[i];
    out[i] =
      typeof s !== "undefined" && String(s).length > 0 ? s : p ?? s ?? "";
  }
  return out;
}

function extractMessage(error) {
  if (!error) return "";
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return parsed.message;
    } catch {
      // ignore
    }
    return error.message;
  }
  return String(error);
}
