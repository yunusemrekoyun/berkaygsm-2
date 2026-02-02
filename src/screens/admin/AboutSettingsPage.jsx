import { useEffect, useState } from "react";
import { aboutApi } from "../../api/about";
import {
  Loader2,
  Save,
  Image as ImageIcon,
  X,
  Languages,
  Trash2,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import AboutTranslationModal from "../../components/admin/about/AboutTranslationModal.jsx";

const BASE_LANG = "tr";
const TRANSLATION_LANGS = [
  { value: "en", label: "English (EN)" },
  { value: "de", label: "Deutsch (DE)" },
];

// Yardımcılar: array <-> textarea metni

export default function AboutSettingsPage() {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState({});
  const [translationState, setTranslationState] = useState({
    open: false,
    loading: false,
    about: null,
    error: null,
  });

  const loadAbout = async () => {
    setLoading(true);
    setFiles({});
    try {
      const res = await aboutApi.get(BASE_LANG);
      setData(res.about);
    } catch (err) {
      toast.error(err?.message || "Veri yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAbout();
  }, []);

  if (loading)
    return (
      <div className="flex h-96 items-center justify-center text-[var(--color-text-admin-muted)]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  const handleInput = (key, value) =>
    setData((p) => ({ ...(p || {}), [key]: value }));

  const handleFile = (key, file) => {
    setFiles((f) => ({ ...f, [key]: file }));
  };

  const handleSubmit = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const payload = { ...(data || {}), ...(files || {}) };
      const res = await aboutApi.update(payload, BASE_LANG);
      setData(res.about);
      toast.success("Hakkımızda sayfası güncellendi");
      await loadAbout();
    } catch (err) {
      toast.error(err.message || "Kaydedilirken hata oluştu");
    } finally {
      setSaving(false);
    }
  };

  const openTranslationModal = async () => {
    setTranslationState({
      open: true,
      loading: true,
      about: null,
      error: null,
    });
    try {
      const res = await aboutApi.get(BASE_LANG);
      setTranslationState({
        open: true,
        loading: false,
        about: res.about,
        error: null,
      });
    } catch (err) {
      setTranslationState({
        open: true,
        loading: false,
        about: null,
        error: err?.message || "Veri yüklenemedi",
      });
    }
  };

  const closeTranslationModal = () => {
    setTranslationState({
      open: false,
      loading: false,
      about: null,
      error: null,
    });
  };

  const handleTranslationsUpdated = async () => {
    await loadAbout();
    toast.success("Çeviri kaydedildi");
  };

  if (!data) {
    return (
      <div className="flex h-96 items-center justify-center text-[var(--color-text-admin-muted)]">
        Veri bulunamadı.
      </div>
    );
  }

  const ctas = Array.isArray(data.ctas) ? data.ctas : [];

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-admin)]">
            Hakkımızda Sayfası İçeriği
          </h1>
          <p className="text-sm text-[var(--color-text-admin-muted)]">
            Türkçe (varsayılan) içerikleri düzenleyin; diğer diller için “Dil
            varyantları” butonunu kullanın.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openTranslationModal}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
          >
            <Languages className="h-4 w-4" />
            Dil varyantları
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-5 py-2.5 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            Kaydet
          </button>
        </div>
      </div>

      {/* HERO SECTION */}
      <SectionCard title="Hero Bölümü">
        <TextInput
          label="Hero Başlığı"
          value={data.heroTitle}
          onChange={(v) => handleInput("heroTitle", v)}
        />
        <TextArea
          label="Hero Alt Başlık"
          value={data.heroSubtitle}
          onChange={(v) => handleInput("heroSubtitle", v)}
        />
        <ImageUpload
          label="Hero Görseli"
          current={data.heroImage?.url}
          onChange={(f) => handleFile("heroImage", f)}
        />
      </SectionCard>

      {/* STORY / VALUES */}
      <SectionCard title="Hikaye, Vizyon ve Değerler">
        {data.dotBlocks?.map((b, i) => (
          <div
            key={i}
            className="mb-4 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4"
          >
            <TextInput
              label="Başlık"
              value={b.title}
              onChange={(v) =>
                handleInput(
                  "dotBlocks",
                  data.dotBlocks.map((x, idx) =>
                    idx === i ? { ...x, title: v } : x
                  )
                )
              }
            />
            <TextArea
              label="Metin"
              value={b.text}
              onChange={(v) =>
                handleInput(
                  "dotBlocks",
                  data.dotBlocks.map((x, idx) =>
                    idx === i ? { ...x, text: v } : x
                  )
                )
              }
            />
          </div>
        ))}
        <ImageUpload
          label="Sol Görsel"
          current={data.leftImage?.url}
          onChange={(f) => handleFile("leftImage", f)}
        />
      </SectionCard>

      {/* STATS */}
      <SectionCard title="İstatistikler / Rozetler">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.stats?.map((s, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4"
            >
              <TextInput
                label="Değer"
                value={s.value}
                onChange={(v) =>
                  handleInput(
                    "stats",
                    data.stats.map((x, idx) =>
                      idx === i ? { ...x, value: v } : x
                    )
                  )
                }
              />
              <TextInput
                label="Etiket"
                value={s.label}
                onChange={(v) =>
                  handleInput(
                    "stats",
                    data.stats.map((x, idx) =>
                      idx === i ? { ...x, label: v } : x
                    )
                  )
                }
              />
            </div>
          ))}
        </div>
      </SectionCard>

      {/* MATERIALS */}
      <SectionCard title="Materyaller ve Sorumluluk">
        <TextInput
          label="Başlık"
          value={data.materialsTitle}
          onChange={(v) => handleInput("materialsTitle", v)}
        />
        <TextArea
          label="Metin"
          value={data.materialsText}
          onChange={(v) => handleInput("materialsText", v)}
        />

        {/* ENTER İLE MADDE EKLEME */}
        <div>
          <span className="text-sm font-medium text-[var(--color-text-admin)]">
            Maddeler (Enter ile ekleyin, maks. 4)
          </span>
          <div className="mt-2 space-y-2">
            {(data.materialsBullets || []).map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2"
              >
                <span className="flex-1 text-sm text-[var(--color-text-admin)]">
                  {item}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleInput(
                      "materialsBullets",
                      data.materialsBullets.filter((_, idx) => idx !== i)
                    )
                  }
                  className="rounded-full bg-rose-50 p-1 text-rose-600 hover:bg-rose-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Yeni madde girişi */}
            {(!data.materialsBullets || data.materialsBullets.length < 4) && (
              <input
                type="text"
                placeholder="Yeni madde yazıp Enter’a basın"
                className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = e.target.value.trim();
                    if (val && data.materialsBullets.length < 4) {
                      handleInput("materialsBullets", [
                        ...data.materialsBullets,
                        val,
                      ]);
                      e.target.value = "";
                    }
                  }
                }}
              />
            )}
            {data.materialsBullets.length >= 4 && (
              <p className="text-xs text-[var(--color-text-admin-muted)]">
                Maksimum 4 madde eklenebilir.
              </p>
            )}
          </div>
        </div>

        <ImageUpload
          label="Materyaller Görseli"
          current={data.materialsImage?.url}
          onChange={(f) => handleFile("materialsImage", f)}
        />
      </SectionCard>
      {/* CTA */}
      <SectionCard title="Eyleme Çağrı (CTA)">
        <TextInput
          label="Başlık"
          value={data.ctaTitle}
          onChange={(v) => handleInput("ctaTitle", v)}
        />
        <TextArea
          label="Alt Başlık"
          value={data.ctaSubtitle}
          onChange={(v) => handleInput("ctaSubtitle", v)}
        />

        {/* YENİ: CTA kartları düzenleme */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--color-text-admin-muted)]">
              CTA butonları
            </p>
            <button
              type="button"
              onClick={() =>
                handleInput("ctas", [
                  ...ctas,
                  { text: "", to: "/", variant: "primary" },
                ])
              }
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
            >
              <Plus className="h-3 w-3" />
              Yeni CTA ekle
            </button>
          </div>

          {ctas.length === 0 && (
            <p className="text-xs text-[var(--color-text-admin-muted)]">
              Henüz CTA eklenmemiş. “Yeni CTA ekle” butonuyla buton
              oluşturabilirsiniz.
            </p>
          )}

          {ctas.map((cta, i) => (
            <div
              key={i}
              className="space-y-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[var(--color-text-admin-muted)]">
                  CTA #{i + 1}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleInput(
                      "ctas",
                      ctas.filter((_, idx) => idx !== i)
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100"
                >
                  <Trash2 className="h-3 w-3" />
                  Sil
                </button>
              </div>

              <TextInput
                label="Buton Metni"
                value={cta.text}
                onChange={(v) =>
                  handleInput(
                    "ctas",
                    ctas.map((x, idx) => (idx === i ? { ...x, text: v } : x))
                  )
                }
              />
              <TextInput
                label="Bağlantı (URL)"
                value={cta.to}
                onChange={(v) =>
                  handleInput(
                    "ctas",
                    ctas.map((x, idx) => (idx === i ? { ...x, to: v } : x))
                  )
                }
              />

              <label className="block">
                <span className="text-xs font-medium text-[var(--color-text-admin-muted)]">
                  Buton stili
                </span>
                <select
                  value={cta.variant === "secondary" ? "secondary" : "primary"}
                  onChange={(e) =>
                    handleInput(
                      "ctas",
                      ctas.map((x, idx) =>
                        idx === i
                          ? {
                              ...x,
                              variant:
                                e.target.value === "secondary"
                                  ? "secondary"
                                  : "primary",
                            }
                          : x
                      )
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                >
                  <option value="primary">Birincil (dolu buton)</option>
                  <option value="secondary">İkincil (çerçeveli buton)</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      </SectionCard>

      <AboutTranslationModal
        open={translationState.open}
        loading={translationState.loading}
        error={translationState.error}
        about={translationState.about || data}
        baseLang={BASE_LANG}
        langs={TRANSLATION_LANGS}
        onClose={closeTranslationModal}
        onUpdated={handleTranslationsUpdated}
      />
    </div>
  );
}

/* ---------- Small reusable UI bits ---------- */

function SectionCard({ title, children }) {
  return (
    <div className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] p-6">
      <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-admin)]">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function TextInput({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[var(--color-text-admin)]">
        {label}
      </span>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[var(--color-text-admin)]">
        {label}
      </span>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      />
    </label>
  );
}

function ImageUpload({ label, current, onChange }) {
  return (
    <div>
      <span className="text-sm font-medium text-[var(--color-text-admin)]">
        {label}
      </span>
      <div className="mt-2 flex items-center gap-4">
        {current ? (
          <div className="relative">
            <img
              src={current}
              alt=""
              className="h-24 w-32 rounded-lg border border-[var(--color-border-admin)] object-cover"
            />
            <button
              onClick={() => onChange(null)}
              type="button"
              className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="grid h-24 w-32 place-items-center rounded-lg border border-dashed border-[var(--color-border-admin)] bg-[var(--color-bg-card)]">
            <ImageIcon className="h-6 w-6 text-[var(--color-text-admin-muted)]" />
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
          className="text-xs text-[var(--color-text-admin-muted)]"
        />
      </div>
    </div>
  );
}
