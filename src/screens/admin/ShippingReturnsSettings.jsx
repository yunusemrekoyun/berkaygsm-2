import { useEffect, useMemo, useState } from "react";
import { shippingReturnsApi } from "../../api/shippingReturns";
import { Link } from "react-router-dom";
import ShippingReturnsTranslationModal from "../../components/admin/shippingReturns/ShippingReturnsTranslationModal.jsx";
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
  CheckCircle2,
  Info,
  List,
  Pencil,
  Tags,
  Globe,
  ToggleLeft,
  ToggleRight,
  Languages,
} from "lucide-react";
import { HAS_TRANSLATIONS, TRANSLATION_LANGS } from "../../constants/lang.js";

// Varsayılan boş model
const BASE_LANG = "tr";
const BASE_LANGUAGE_LABEL = "Türkçe (TR)";

const EMPTY_MODEL = {
  heroTitle: "",
  heroSubtitle: "",
  sections: [],
  sidebar: { quickFacts: [], helpBoxHtml: "" },
  seo: { title: "", description: "", keywords: [] },
  isActive: true,
};

export default function ShippingReturnsSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);

  const [form, setForm] = useState(EMPTY_MODEL);
  const [translationState, setTranslationState] = useState({
    open: false,
    loading: false,
    page: null,
    error: null,
  });

  function deepMergeKeepDraft(prev, srv) {
    // Basit alanlar
    const out = {
      ...prev,
      ...srv,
      seo: { ...(prev.seo || {}), ...(srv.seo || {}) },
      sidebar: { ...(prev.sidebar || {}), ...(srv.sidebar || {}) },
    };

    // sections: server boş/undefined dönerse prev'i koru
    const srvSecs = Array.isArray(srv.sections) ? srv.sections : undefined;
    const prevSecs = Array.isArray(prev.sections) ? prev.sections : [];
    if (!srvSecs) {
      out.sections = prevSecs;
    } else if (srvSecs.length === 0 && prevSecs.length > 0) {
      // Sunucu boş döndüyse ama kullanıcıda draft varsa → draft'ı koru
      out.sections = prevSecs;
    } else {
      // index bazlı birleştirme: başlık/alt alanlar srv'den gelsin ama
      // paragraf/list uzunluğu ve değerleri prev'de varsa korunur.
      out.sections = srvSecs.map((ss, i) => {
        const ps = prevSecs[i] || {};
        return {
          title: ss.title ?? ps.title ?? "",
          paragraphs: Array.isArray(ss.paragraphs)
            ? mergeArrayKeepDraft(ps.paragraphs, ss.paragraphs)
            : ps.paragraphs || [],
          list: {
            heading: ss?.list?.heading ?? ps?.list?.heading ?? "",
            items: Array.isArray(ss?.list?.items)
              ? mergeArrayKeepDraft(ps?.list?.items, ss.list.items)
              : ps?.list?.items || [],
          },
        };
      });
    }

    // sidebar.quickFacts: srv undefined/boşsa prev'i tut
    const srvFacts = srv?.sidebar?.quickFacts;
    const prevFacts = prev?.sidebar?.quickFacts || [];
    if (!Array.isArray(srvFacts) || srvFacts.length === 0) {
      out.sidebar.quickFacts = prevFacts;
    } else {
      out.sidebar.quickFacts = mergeArrayKeepDraft(prevFacts, srvFacts);
    }

    // helpBoxHtml srv'de varsa onu al, yoksa prev'i koru
    out.sidebar.helpBoxHtml =
      srv?.sidebar?.helpBoxHtml ?? prev?.sidebar?.helpBoxHtml ?? "";

    // seo.keywords: srv boşsa prev'i koru
    const srvKw = srv?.seo?.keywords;
    const prevKw = prev?.seo?.keywords || [];
    if (!Array.isArray(srvKw) || srvKw.length === 0) {
      out.seo.keywords = prevKw;
    } else {
      out.seo.keywords = mergeArrayKeepDraft(prevKw, srvKw);
    }

    // isActive: srv undefined ise prev'i koru
    if (typeof srv.isActive === "undefined") {
      out.isActive = prev.isActive;
    }

    return out;
  }

  const loadPage = async () => {
    setLoading(true);
    try {
      const data = await shippingReturnsApi.manage(BASE_LANG);
      setForm(normalizeIncoming(data));
      setBanner(null);
      setTranslationState((prev) =>
        prev.open
          ? {
              ...prev,
              page: data,
              error: null,
            }
          : prev
      );
    } catch (e) {
      setBanner({
        variant: "danger",
        message: extractMessage(e) || "Kargo ve iade içeriği yüklenemedi.",
      });
      setForm(EMPTY_MODEL);
    } finally {
      setLoading(false);
    }
  };

  // Dizilerde taslağı (draft) koruyarak birleştir.
  // Sunucu dizisi boş/undefined ise prev'i tutar; aksi halde
  // index bazlı birleştirme yapar. srv’deki elemanlar "" ise prev’deki değer korunur.
  function mergeArrayKeepDraft(prevArr = [], srvArr = []) {
    const max = Math.max(prevArr.length, srvArr.length);
    const out = [];
    for (let i = 0; i < max; i++) {
      const p = prevArr[i];
      const s = srvArr[i];
      // Sunucu değeri mevcut ve boş değilse onu kullan, aksi halde draft'ı tut.
      out[i] =
        typeof s !== "undefined" && String(s).length > 0 ? s : p ?? s ?? "";
    }
    return out;
  }
  // Yükleme
  useEffect(() => {
    loadPage();
  }, []);

  const canSave = useMemo(() => {
    if (!form.heroTitle?.trim()) return false;
    return true;
  }, [form]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = normalizeOutgoing(form);
      const updated = await shippingReturnsApi.upsert(payload, BASE_LANG);
      if (updated) {
        const srv = normalizeIncoming(updated);
        setForm((prev) => deepMergeKeepDraft(prev, srv));
        setTranslationState((prev) =>
          prev.open
            ? {
                ...prev,
                page: updated,
                error: null,
              }
            : prev
        );
      } // else: mevcut formu koru

      setBanner({
        variant: "success",
        message: "Kargo ve iade içeriği başarıyla kaydedildi.",
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
      page: null,
      error: null,
    });
    try {
      const data = await shippingReturnsApi.manage(BASE_LANG);
      setTranslationState({
        open: true,
        loading: false,
        page: data,
        error: null,
      });
    } catch (error) {
      setTranslationState({
        open: true,
        loading: false,
        page: null,
        error: extractMessage(error) || "Çeviri içeriği yüklenemedi.",
      });
    }
  };

  const closeTranslationModal = () => {
    setTranslationState({
      open: false,
      loading: false,
      page: null,
      error: null,
    });
  };

  const handleTranslationsUpdated = async () => {
    await loadPage();
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
              İçerik • Kargo ve İade
            </div>
            <h1 className="text-2xl font-semibold">Kargo ve İade Sayfası</h1>
            <p className="text-sm text-[var(--color-text-admin-muted)]">
              Hero başlığını, içerik bölümlerini, hızlı bilgiler ve SEO verilerini yönetin. Bu ayarlar kamuya açık{" "}
              <code className="rounded bg-[var(--color-bg-hover)] px-1 py-0.5">
                /shipping-and-returns
              </code>{" "}
              sayfasını kontrol eder.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="flex-1 rounded-xl border border-[var(--color-border-admin)]/60 bg-[var(--color-bg-admin)]/40 px-3 py-2 text-[11px] text-[var(--color-text-admin-muted)]">
                {HAS_TRANSLATIONS ? (
                  <>
                    Bu form{" "}
                    <span className="font-semibold text-[var(--color-text-admin)]">
                      {BASE_LANGUAGE_LABEL}
                    </span>{" "}
                    içeriklerini günceller. Diğer diller için “Dil varyantları”
                    butonunu kullanın.
                  </>
                ) : (
                  <>
                    Bu form yalnızca{" "}
                    <span className="font-semibold text-[var(--color-text-admin)]">
                      {BASE_LANGUAGE_LABEL}
                    </span>{" "}
                    içeriklerini yönetir.
                  </>
                )}
              </p>
              {HAS_TRANSLATIONS && (
                <button
                  type="button"
                  onClick={openTranslationModal}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
                >
                  <Languages className="h-4 w-4" />
                  Dil varyantları
                </button>
              )}
            </div>
          </div>

          {/* Banner */}
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

          {/* Actions */}
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
              to="/shipping-returns"
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

        {/* Hero Card */}
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
                  setForm((prev) => ({ ...prev, heroTitle: e.target.value }))
                }
                placeholder="Kargo ve İade"
              />
            </div>
            <div className="md:col-span-6">
              <Label>Alt Başlık</Label>
              <Input
                value={form.heroSubtitle}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, heroSubtitle: e.target.value }))
                }
                placeholder="Kısa destekleyici cümle..."
              />
            </div>
          </div>
        </div>

        {/* Sections Editor */}
        <SectionsEditor
          sections={form.sections}
          onChange={(next) => setForm((p) => ({ ...p, sections: next }))}
        />

        {/* Sidebar Editor */}
        <SidebarEditor
          sidebar={form.sidebar}
          onChange={(next) => setForm((p) => ({ ...p, sidebar: next }))}
        />

        {/* SEO Editor */}
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
              <li>Hero alanını kısa ve anlaşılır tutun.</li>
              <li>Kenar çubuğu için 4-6 "Hızlı bilgi" kullanın.</li>
              <li>Bölümleri kargo, ücretler, iadeler ve geri ödemeler şeklinde yapılandırın.</li>
              <li>SEO için benzersiz başlık ve açıklama ekleyin.</li>
            </ul>
          </div>
        </aside>
      </div>

      {HAS_TRANSLATIONS && (
        <ShippingReturnsTranslationModal
          open={translationState.open}
          loading={translationState.loading}
          error={translationState.error}
          page={translationState.page}
          baseLang={BASE_LANG}
          langs={TRANSLATION_LANGS}
          onClose={closeTranslationModal}
          onUpdated={handleTranslationsUpdated}
        />
      )}
    </div>
  );
}

/* -------------------- Sections Editor -------------------- */

function SectionsEditor({ sections = [], onChange }) {
  function addSection() {
    onChange([
      ...sections,
      {
        title: "",
        paragraphs: [""],
        list: { heading: "", items: [] },
      },
    ]);
  }

  function updateSection(index, patch) {
    const next = sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  }

  function removeSection(index) {
    const next = sections.filter((_, i) => i !== index);
    onChange(next);
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
          <h2 className="text-lg font-semibold">İçerik Bölümleri</h2>
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
          Henüz bölüm yok. Başlamak için “Bölüm ekle”yi tıklayın.
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
                    title="Bölümü kaldır"
                    danger
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
                    placeholder="Teslimat bölgeleri ve kargo firmaları"
                  />
                </div>

                <div className="md:col-span-6">
                  <Label>Liste Başlığı (isteğe bağlı)</Label>
                  <Input
                    value={s.list?.heading || ""}
                    onChange={(e) =>
                      updateSection(i, {
                        list: {
                          ...(s.list || { items: [] }),
                          heading: e.target.value,
                        },
                      })
                    }
                    placeholder="Tahmini teslimat süreleri:"
                  />
                </div>
              </div>

              {/* Paragraphs */}
              <div className="mt-4">
                <Label>Paragraflar</Label>
                <MultiText
                  values={s.paragraphs || []}
                  onChange={(vals) => updateSection(i, { paragraphs: vals })}
                  placeholder="Paragraf ekleyin..."
                />
              </div>

              {/* List Items */}
              <div className="mt-4">
                <Label>Liste Öğeleri</Label>
                <MultiLineItems
                  values={s.list?.items || []}
                  onChange={(vals) =>
                    updateSection(i, {
                      list: { heading: s.list?.heading || "", items: vals },
                    })
                  }
                  placeholder="Almanya, Avusturya, Benelüx: 2–3 iş günü"
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------- Sidebar Editor -------------------- */

function SidebarEditor({ sidebar, onChange }) {
  const side = sidebar || { quickFacts: [], helpBoxHtml: "" };
  function convertTextToHtml(raw = "") {
    if (!raw) return "";
    // 1) HTML injection koruması
    const escaped = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    // 2) Satır sonlarını <br> yap
    const withBreaks = escaped.replace(/\n/g, "<br>");
    // 3) Basit e-posta tespiti
    const withMailLinks = withBreaks.replace(
      /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
      `<a href="mailto:$1" class="text-accent underline">$1</a>`
    );
    // 4) URL tespiti (https:// veya www.)
    const withLinks = withMailLinks.replace(
      /\b(https?:\/\/[^\s<]+|www\.[^\s<]+)\b/g,
      (match) => {
        const href = match.startsWith("http") ? match : `https://${match}`;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-accent underline">${match}</a>`;
      }
    );
    return withLinks;
  }
  function updateQuickFacts(values) {
    onChange({ ...side, quickFacts: values });
  }

  return (
    <div className="mt-6 rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <Info className="h-5 w-5 text-[var(--color-text-admin-muted)]" />
        <h2 className="text-lg font-semibold">Kenar Çubuğu</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="md:col-span-7">
          <Label>Hızlı bilgiler</Label>
          <MultiLineItems
            values={side.quickFacts || []}
            onChange={updateQuickFacts}
            placeholder="• Tüm siparişler karbon nötr kargo ile gönderilir."
          />
        </div>
        <div className="md:col-span-5">
          <Label>Yardım kutusu (HTML kullanılabilir)</Label>
          <textarea
            value={side.helpBoxHtmlRaw || ""} // ham metni ayrı saklayalım
            onChange={(e) => {
              const raw = e.target.value;
              const html = convertTextToHtml(raw);
              onChange({
                ...side,
                helpBoxHtml: html, // backend'e gidecek HTML versiyon
                helpBoxHtmlRaw: raw, // formda gösterilecek ham metin
              });
            }}
            rows={10}
            className="mt-2 w-full rounded-2xl border border-[var(--color-border-admin)] bg-white px-4 py-3 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)] focus:ring-2 focus:ring-[var(--color-text-admin)]/10"
            placeholder='Need assistance? Reach us at <a href="mailto:returns@..." class="text-accent underline">returns@...</a>'
          />
          {/* Preview (optional) */}
          {side.helpBoxHtml && (
            <div
              className="mt-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/40 p-3 text-sm"
              dangerouslySetInnerHTML={{ __html: side.helpBoxHtml }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------- SEO Editor -------------------- */

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
            placeholder="Kargo & İade — Berkay GSM"
          />
        </div>
        <div className="md:col-span-6">
          <Label>Meta açıklama</Label>
          <Input
            value={model.description || ""}
            onChange={(e) =>
              onChange({ ...model, description: e.target.value })
            }
            placeholder="Şeffaf teslimat süreleri, kolay iade ve değişim…"
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
                title="Remove keyword"
              >
                ✕
              </button>
            </span>
          ))}
          <div className="inline-flex items-center gap-2">
            <input
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              placeholder="Add keyword"
              className="rounded-full border border-[var(--color-border-admin)] bg-white px-3 py-1 text-xs outline-none focus:border-[var(--color-text-admin)]"
            />
            <button
              type="button"
              onClick={addKeyword}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold hover:bg-[var(--color-bg-hover)]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------- Tiny UI -------------------- */

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

function MultiLineItems({ values = [], onChange, placeholder }) {
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
          <input
            value={v}
            onChange={(e) => setValue(i, e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-2xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)] focus:ring-2 focus:ring-[var(--color-text-admin)]/10"
          />
         <div className="mt-0.5 flex flex-col gap-1">
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
        Liste öğesi ekle
      </button>
    </div>
  );
}

/* -------------------- Normalizers & Utils -------------------- */

function normalizeIncoming(data) {
  const safe = { ...EMPTY_MODEL, ...(data || {}) };
  safe.heroTitle = String(safe.heroTitle || "");
  safe.heroSubtitle = String(safe.heroSubtitle || "");
  safe.sections = Array.isArray(safe.sections) ? safe.sections : [];
  safe.sidebar = {
    quickFacts: Array.isArray(safe.sidebar?.quickFacts)
      ? safe.sidebar.quickFacts
      : [],
    helpBoxHtml: String(safe.sidebar?.helpBoxHtml || ""),
    helpBoxHtmlRaw: safe.sidebar?.helpBoxHtml
      ? safe.sidebar.helpBoxHtml
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]*>/g, "") // HTML'i sade metne çevir
      : "",
  };
  safe.seo = {
    title: String(safe.seo?.title || ""),
    description: String(safe.seo?.description || ""),
    keywords: Array.isArray(safe.seo?.keywords) ? safe.seo.keywords : [],
  };
  safe.isActive = safe.isActive !== false;
  return safe;
}

function normalizeOutgoing(form) {
  // (İsteğe bağlı küçük temizlik)
  return {
    heroTitle: String(form.heroTitle || "").trim(),
    heroSubtitle: String(form.heroSubtitle || "").trim(),
    sections: (form.sections || []).map((s) => ({
      title: String(s.title || "").trim(),
      paragraphs: (s.paragraphs || []).map((p) => String(p ?? "")),
      list: {
        heading: String(s.list?.heading || "").trim(),
        items: (s.list?.items || []).map((x) => String(x ?? "")),
      },
    })),
    sidebar: {
      quickFacts: (form.sidebar?.quickFacts || []).map((x) => String(x ?? "")),
      helpBoxHtml: String(form.sidebar?.helpBoxHtml || ""),
    },
    seo: {
      title: String(form.seo?.title || "").trim(),
      description: String(form.seo?.description || "").trim(),
      keywords: (form.seo?.keywords || []).map((x) => String(x ?? "")),
    },
    isActive: Boolean(form.isActive),
  };
}

function extractMessage(error) {
  if (!error) return "";
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return parsed.message;
    } catch (err) {
      console.log(err);

      // ignore
    }
    return error.message;
  }
  return String(error);
}
