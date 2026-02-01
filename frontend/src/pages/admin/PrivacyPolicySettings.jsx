import { useEffect, useState, useMemo } from "react";
import privacyApi from "../../api/privacy.js";
import PrivacyTranslationModal from "../../components/admin/privacy/PrivacyTranslationModal.jsx";
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  GripVertical,
  Info,
  Tags,
  ToggleLeft,
  ToggleRight,
  Eye,
  Languages,
  Globe,
} from "lucide-react";
import { Link } from "react-router-dom";

/* -------------------- PAGE -------------------- */

const BASE_LANG = "tr";
const BASE_LANGUAGE_LABEL = "Türkçe (TR)";
const TRANSLATION_LANGS = [
  { value: "en", label: "English (EN)" },
  { value: "de", label: "Deutsch (DE)" },
];

export default function PrivacySettings() {
  const [form, setForm] = useState(EMPTY_MODEL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);
  const [translationState, setTranslationState] = useState({
    open: false,
    loading: false,
    privacy: null,
    error: null,
  });

  const loadPrivacy = async () => {
    setLoading(true);
    try {
      const data = await privacyApi.manage(BASE_LANG);
      setForm(normalizeIncoming(data));
      setBanner(null);
      setTranslationState((prev) =>
        prev.open
          ? {
              ...prev,
              privacy: data,
              error: null,
            }
          : prev
      );
    } catch (err) {
      setBanner({
        variant: "danger",
        message: extractMessage(err) || "Gizlilik içeriği yüklenemedi.",
      });
      setForm(EMPTY_MODEL);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrivacy();
  }, []);

  const canSave = useMemo(() => !!form.heroTitle.trim(), [form.heroTitle]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = normalizeOutgoing(form);
      const updated = await privacyApi.upsert(payload, BASE_LANG);
      if (updated) {
        setForm(normalizeIncoming(updated));
        setTranslationState((prev) =>
          prev.open
            ? {
                ...prev,
                privacy: updated,
                error: null,
              }
            : prev
        );
      }
      setBanner({
        variant: "success",
        message: "Gizlilik Politikası başarıyla kaydedildi.",
      });
    } catch (err) {
      setBanner({
        variant: "danger",
        message: extractMessage(err) || "İçerik kaydedilemedi.",
      });
    } finally {
      setSaving(false);
    }
  }

  const openTranslationModal = async () => {
    setTranslationState({
      open: true,
      loading: true,
      privacy: null,
      error: null,
    });
    try {
      const data = await privacyApi.manage(BASE_LANG);
      setTranslationState({
        open: true,
        loading: false,
        privacy: data,
        error: null,
      });
    } catch (err) {
      setTranslationState({
        open: true,
        loading: false,
        privacy: null,
        error: extractMessage(err) || "Çeviri içeriği yüklenemedi.",
      });
    }
  };

  const closeTranslationModal = () => {
    setTranslationState({
      open: false,
      loading: false,
      privacy: null,
      error: null,
    });
  };

  const handleTranslationsUpdated = async () => {
    await loadPrivacy();
  };

  function toggleActive() {
    setForm((p) => ({ ...p, isActive: !p.isActive }));
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* --- LEFT MAIN --- */}
        <div className="xl:col-span-8">
          {/* Header */}
          <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
            <div className="flex flex-col gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs text-[var(--color-text-admin-muted)]">
                <ShieldCheck className="h-4 w-4" />
                İçerik • Gizlilik Politikası
              </div>
              <h1 className="text-2xl font-semibold text-[var(--color-text-admin)]">
                Gizlilik Politikası Sayfası
              </h1>
              <p className="text-sm text-[var(--color-text-admin-muted)]">
                Gizlilik politikası başlığını, bölümleri, alt bilgi ve SEO
                verilerini yönetin. Bu ayarlar{" "}
                <code className="rounded bg-[var(--color-bg-hover)] px-1 py-0.5">
                  /privacy
                </code>{" "}
                sayfasını kontrol eder.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="flex-1 rounded-xl border border-[var(--color-border-admin)]/60 bg-[var(--color-bg-admin)]/40 px-3 py-2 text-[11px] text-[var(--color-text-admin-muted)]">
                  Bu form{" "}
                  <span className="font-semibold text-[var(--color-text-admin)]">
                    {BASE_LANGUAGE_LABEL}
                  </span>{" "}
                  içeriklerini düzenler. Diğer diller için “Dil varyantları”
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

            {banner && (
              <div
                className={`mt-4 rounded-xl border p-4 text-sm ${
                  banner.variant === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {banner.message}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={handleSave}
                disabled={!canSave || saving || loading}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-5 py-2 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Değişiklikleri Kaydet
              </button>

              <Link
                to="/privacy"
                target="_blank"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-5 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
              >
                <Eye className="h-4 w-4" />
                Önizleme
              </Link>

              <button
                onClick={toggleActive}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
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
                  placeholder="Gizlilik Politikası"
                />
              </div>
              <div className="md:col-span-6">
                <Label>Alt Başlık</Label>
                <Input
                  value={form.heroIntro}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, heroIntro: e.target.value }))
                  }
                  placeholder="Gizliliğiniz bizim için önemli..."
                />
              </div>
            </div>
          </div>

          {/* Sections */}
          <SectionsEditor
            sections={form.sections}
            onChange={(next) => setForm((p) => ({ ...p, sections: next }))}
          />

          {/* Footer HTML */}
          <FooterEditor
            value={form.footerHtml}
            onChange={(v) => setForm((p) => ({ ...p, footerHtml: v }))}
          />

          {/* SEO */}
          <SEOEditor
            seo={form.seo}
            onChange={(next) => setForm((p) => ({ ...p, seo: next }))}
          />
        </div>

        {/* --- RIGHT SIDEBAR --- */}
        <aside className="xl:col-span-4">
          <div className="sticky top-4 rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
            <h3 className="text-lg font-semibold">İpuçları</h3>
            <ul className="mt-4 space-y-3 text-sm text-[var(--color-text-admin-muted)]">
              <li>Bölümleri kısa tutun ve net şekilde numaralandırın.</li>
              <li>Hızlı gezinme için anchor bağlantıları kullanın.</li>
              <li>Alt bilgiye iletişim veya uyumluluk metni ekleyin.</li>
              <li>SEO verileri görünürlüğü artırır.</li>
            </ul>
          </div>
        </aside>
      </div>

      <PrivacyTranslationModal
        open={translationState.open}
        loading={translationState.loading}
        error={translationState.error}
        privacy={translationState.privacy}
        baseLang={BASE_LANG}
        langs={TRANSLATION_LANGS}
        onClose={closeTranslationModal}
        onUpdated={handleTranslationsUpdated}
      />
    </div>
  );
}

/* -------------------- COMPONENTS -------------------- */

function SectionsEditor({ sections = [], onChange }) {
  function addSection() {
    onChange([...sections, { id: "", title: "", content: [""] }]);
  }
  function updateSection(i, patch) {
    onChange(sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function removeSection(i) {
    onChange(sections.filter((_, idx) => idx !== i));
  }
  function move(i, dir) {
    const t = i + dir;
    if (t < 0 || t >= sections.length) return;
    const next = [...sections];
    const [item] = next.splice(i, 1);
    next.splice(t, 0, item);
    onChange(next);
  }

  return (
    <div className="mt-6 rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--color-text-admin-muted)]" />
          <h2 className="text-lg font-semibold">Bölümler</h2>
        </div>
        <button
          onClick={addSection}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Bölüm Ekle
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border-admin)] p-6 text-sm text-[var(--color-text-admin-muted)]">
          Henüz bölüm yok. Başlamak için “Bölüm Ekle” butonuna tıklayın.
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((s, i) => (
            <article
              key={i}
              className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/40 p-4"
            >
              <div className="flex justify-between">
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
                    danger
                    title="Bölümü kaldır"
                    onClick={() => removeSection(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-4">
                  <Label>Bölüm Kimliği (anchor)</Label>
                  <Input
                    value={s.id}
                    onChange={(e) =>
                      updateSection(i, { id: e.target.value.trim() })
                    }
                    placeholder="denetleyici, veri-isleme..."
                  />
                </div>
                <div className="md:col-span-8">
                  <Label>Başlık</Label>
                  <Input
                    value={s.title}
                    onChange={(e) =>
                      updateSection(i, { title: e.target.value })
                    }
                    placeholder="1. Veri Sorumlusu"
                  />
                </div>
              </div>

              <div className="mt-4">
                <Label>İçerik Paragrafları</Label>
                <MultiText
                  values={s.content || []}
                  onChange={(vals) => updateSection(i, { content: vals })}
                  placeholder="Bir paragraf girin..."
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FooterEditor({ value, onChange }) {
  return (
    <div className="mt-6 rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
      <h2 className="mb-4 text-lg font-semibold">Alt Bilgi Notu (HTML)</h2>
      <textarea
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='Sorularınız olursa <a href="mailto:privacy@...">privacy@...</a> üzerinden bizimle iletişime geçebilirsiniz'
        className="w-full rounded-2xl border border-[var(--color-border-admin)] bg-white px-4 py-3 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)] focus:ring-2 focus:ring-[var(--color-text-admin)]/10"
      />
    </div>
  );
}

function SEOEditor({ seo, onChange }) {
  const [kwInput, setKwInput] = useState("");
  function addKeyword() {
    const v = kwInput.trim();
    if (!v) return;
    onChange({
      ...seo,
      keywords: Array.from(new Set([...(seo.keywords || []), v])),
    });
    setKwInput("");
  }
  function removeKeyword(k) {
    onChange({
      ...seo,
      keywords: (seo.keywords || []).filter((x) => x !== k),
    });
  }
  return (
    <div className="mt-6 rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <Globe className="h-5 w-5 text-[var(--color-text-admin-muted)]" />
        <h2 className="text-lg font-semibold">SEO Metaverileri</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="md:col-span-6">
          <Label>Meta Başlık</Label>
          <Input
            value={seo.title}
            onChange={(e) => onChange({ ...seo, title: e.target.value })}
            placeholder="Gizlilik Politikası — Evim & Stil"
          />
        </div>
        <div className="md:col-span-6">
          <Label>Meta Açıklama</Label>
          <Input
            value={seo.description}
            onChange={(e) => onChange({ ...seo, description: e.target.value })}
            placeholder="Verilerinizi nasıl işlediğimizi ve koruduğumuzu..."
          />
        </div>
      </div>
      <div className="mt-4">
        <Label>Anahtar Kelimeler</Label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {(seo.keywords || []).map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-1 text-xs font-semibold text-[var(--color-text-admin)]"
            >
              <Tags className="h-3.5 w-3.5" />
              {k}
              <button
                onClick={() => removeKeyword(k)}
                className="rounded-full p-1 hover:bg-[var(--color-bg-hover)]"
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
              onClick={addKeyword}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold hover:bg-[var(--color-bg-hover)]"
            >
              <Plus className="h-3.5 w-3.5" /> Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- TINY UI -------------------- */

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
  function setValue(i, v) {
    onChange(values.map((x, idx) => (idx === i ? v : x)));
  }
  function add() {
    onChange([...(values || []), ""]);
  }
  function remove(i) {
    onChange(values.filter((_, idx) => idx !== i));
  }
  function move(i, dir) {
    const t = i + dir;
    if (t < 0 || t >= values.length) return;
    const next = [...values];
    const [it] = next.splice(i, 1);
    next.splice(t, 0, it);
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
        onClick={add}
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold hover:bg-[var(--color-bg-hover)]"
      >
        <Plus className="h-3.5 w-3.5" />
        Paragraf Ekle
      </button>
    </div>
  );
}

/* -------------------- MODEL & NORMALIZERS -------------------- */

const EMPTY_MODEL = {
  heroTitle: "",
  heroIntro: "",
  sections: [], // [{id,title,content:[...]}]
  footerHtml: "",
  seo: { title: "", description: "", keywords: [] },
  isActive: true,
};

function normalizeIncoming(data) {
  const safe = { ...EMPTY_MODEL, ...(data || {}) };
  safe.heroTitle = String(safe.heroTitle || "");
  safe.heroIntro = String(safe.heroIntro || "");
  safe.footerHtml = String(safe.footerHtml || "");
  safe.sections = Array.isArray(safe.sections)
    ? safe.sections.map((s) => ({
        id: String(s?.id || "").trim(),
        title: String(s?.title || "").trim(),
        content: Array.isArray(s?.content)
          ? s.content.map((p) => String(p ?? ""))
          : [],
      }))
    : [];
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
    footerHtml: String(form.footerHtml || ""),
    sections: (form.sections || []).map((s) => ({
      id: String(s.id || "").trim(),
      title: String(s.title || "").trim(),
      content: (s.content || []).map((p) => String(p ?? "")),
    })),
    seo: {
      title: String(form.seo?.title || "").trim(),
      description: String(form.seo?.description || "").trim(),
      keywords: (form.seo?.keywords || []).map((k) => String(k ?? "")),
    },
    isActive: !!form.isActive,
  };
}

function extractMessage(err) {
  if (!err) return "Beklenmeyen hata";
  try {
    const parsed = JSON.parse(String(err.message || err));
    if (parsed?.message) return parsed.message;
  } catch {
    // ignore
  }
  return err.message || String(err);
}
