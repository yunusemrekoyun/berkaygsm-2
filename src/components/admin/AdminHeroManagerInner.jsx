import { useEffect, useMemo, useState } from "react";
import { heroApi } from "../../api/heroes";
import { categoryApi } from "../../api/categories";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Circle,
  X,
  Save,
  ChevronLeft,
  Languages,
} from "lucide-react";
import AlertBanner from "../ui/AlertBanner.jsx";
import { useConfirm } from "../ui/ConfirmDialog.jsx";
import {
  DEFAULT_LANG,
  HAS_TRANSLATIONS,
  TRANSLATION_LANGS,
} from "../../constants/lang.js";
import HeroTranslationModal from "./hero/HeroTranslationModal.jsx";

/* ----- Liste + Modal tetik ----- */
export default function AdminHeroManagerInner() {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null); // item | "new" | null
  const [cats, setCats] = useState([]);
  const [banner, setBanner] = useState(null);
  const [translationState, setTranslationState] = useState({
    open: false,
    loading: false,
    hero: null,
    error: null,
  });

  const BASE_LANG = "tr";

  useEffect(() => {
    loadHeroes();
    loadCategories();
  }, []);

  async function loadHeroes() {
    try {
      const list = await heroApi.list({ includeInactive: true }, BASE_LANG);

      setItems(list || []);
    } catch (error) {
      setBanner({
        variant: "danger",
        message: error?.message || "Hero listesi yüklenemedi",
      });
    }
  }

  async function loadCategories() {
    try {
      const list = await categoryApi.list({}, BASE_LANG);
      setCats(list || []);
    } catch (error) {
      setBanner({
        variant: "danger",
        message: error?.message || "Kategoriler yüklenemedi",
      });
    }
  }

  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [items]
  );

  async function toggleActive(item) {
    const id = item?.id;

    if (!id) {
      setBanner({
        variant: "danger",
        message: "Hero kimliği okunamadı. Lütfen sayfayı yenileyin.",
      });
      return;
    }
    const updated = await heroApi.update(
      id,
      { isActive: !item.isActive },
      BASE_LANG
    );
    setItems((arr) => arr.map((x) => (x.id === updated.id ? updated : x)));
    setBanner({
      variant: "success",
      message: `Hero “${updated.title}” artık ${
        updated.isActive ? "aktif" : "gizli"
      }.`,
    });
  }

  async function remove(item) {
    const ok = await confirm({
      title: "Hero’yu sil",
      description: `“${item.title}” silinsin mi? Bu işlem geri alınamaz.`,
      tone: "danger",
      confirmText: "Sil",
    });
    if (!ok) return;
    try {
      const id = item?.id;

      if (!id) {
        setBanner({
          variant: "danger",
          message: "Hero kimliği okunamadı. Lütfen sayfayı yenileyin.",
        });
        return;
      }
      await heroApi.remove(id);
      setItems((arr) => arr.filter((x) => x.id !== id));
      setBanner({
        variant: "warning",
        message: `Hero “${item.title}” silindi.`,
      });
    } catch (error) {
      setBanner({
        variant: "danger",
        message: error?.message || "Hero silinemedi",
      });
    }
  }

  async function move(item, dir) {
    const id = item?.id;

    if (!id) return;

    const list = sorted;
    const from = list.findIndex((x) => x.id === id);
    const to = from + dir;
    if (to < 0 || to >= list.length) return;

    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    const nextWithOrders = next.map((h, i) => ({ ...h, sortOrder: i }));
    setItems(nextWithOrders);

    await heroApi.reorder(
      nextWithOrders.map((h, i) => ({
        id: h.id,
        sortOrder: i,
      }))
    );
  }

  const openTranslationModal = async (hero) => {
    const id = hero?.id;

    if (!id) {
      setTranslationState({
        open: true,
        loading: false,
        hero: null,
        error: "Hero kimliği okunamadı. Lütfen sayfayı yenileyin.",
      });
      return;
    }
    setTranslationState({
      open: true,
      loading: true,
      hero: null,
      error: null,
    });
    try {
      const detail = await heroApi.get(id, BASE_LANG);

      setTranslationState({
        open: true,
        loading: false,
        hero: detail,
        error: null,
      });
    } catch (error) {
      setTranslationState({
        open: true,
        loading: false,
        hero: null,
        error: error?.message || "Hero verisi alınamadı",
      });
    }
  };

  const closeTranslationModal = () => {
    setTranslationState({
      open: false,
      loading: false,
      hero: null,
      error: null,
    });
  };

  const handleTranslationsUpdated = async () => {
    await loadHeroes();
    setBanner({
      variant: "success",
      message: "Hero çeviri varyantı kaydedildi.",
    });
  };

  return (
    <div className="space-y-6">
      {banner && (
        <AlertBanner
          variant={banner.variant}
          message={banner.message}
          onClose={() => setBanner(null)}
        />
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-[var(--color-text-admin-muted)]">
            Anasayfa
          </div>
          <h2 className="text-xl font-semibold">Hero Yöneticisi</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/settings"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm hover:bg-[var(--color-bg-hover)]"
          >
            <ChevronLeft className="h-4 w-4" />
            Ayarlara Dön
          </Link>
          <button
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Yeni Hero
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((h) => (
          <article
            key={h.id}
            className="overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]"
          >
            <div className="relative aspect-[16/9] w-full bg-[var(--color-bg-admin)]">
              {h.image ? (
                <img
                  src={h.image.url}
                  alt={h.title}
                  className="h-full w-full object-cover"
                />
              ) : h.video ? (
                <video
                  className="h-full w-full object-cover"
                  src={h.video.url}
                  muted
                  playsInline
                  autoPlay
                  loop
                />
              ) : (
                <div className="grid h-full place-items-center text-[var(--color-text-admin-muted)]">
                  Medya yok
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent p-4 text-white">
                <div className="font-semibold line-clamp-1">{h.title}</div>
                <div className="text-xs opacity-90 line-clamp-2">
                  {h.subtitle}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {h.buttonText || "—"}
                </div>
                <div className="text-xs text-[var(--color-text-admin-muted)]">
                  Hedef:{" "}
                  {h.target?.type === "CATEGORIES"
                    ? `Kategoriler(${h.target.categories?.length || 0})`
                    : "Mağaza"}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => move(h, -1)}
                  className="rounded-lg p-2 hover:bg-[var(--color-bg-hover)]"
                  title="Yukarı taşı"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => move(h, +1)}
                  className="rounded-lg p-2 hover:bg-[var(--color-bg-hover)]"
                  title="Aşağı taşı"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                {HAS_TRANSLATIONS && (
                  <button
                    onClick={() => openTranslationModal(h)}
                    className="rounded-lg p-2 hover:bg-[var(--color-bg-hover)]"
                    title="Dil varyantları"
                  >
                    <Languages className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setEditing(h)}
                  className="rounded-lg p-2 hover:bg-[var(--color-bg-hover)]"
                  title="Düzenle"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleActive(h)}
                  className="rounded-lg p-2 hover:bg-[var(--color-bg-hover)]"
                  title={h.isActive ? "Devre dışı bırak" : "Etkinleştir"}
                >
                  {h.isActive ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => remove(h)}
                  className="rounded-lg p-2 hover:bg-[var(--color-bg-hover)]"
                  title="Sil"
                >
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Modal */}
      {editing && (
        <HeroModal
          cats={cats}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            setItems((arr) => {
              const index = arr.findIndex((x) => x.id === saved.id);
              if (index === -1) return [saved, ...arr];
              const copy = [...arr];
              copy[index] = saved;
              return copy;
            });
            setBanner({
              variant: "success",
              message: `Hero “${saved.title}” kaydedildi.`,
            });
          }}
          contentLang={BASE_LANG}
        />
      )}

      {HAS_TRANSLATIONS && (
        <HeroTranslationModal
          open={translationState.open}
          loading={translationState.loading}
          error={translationState.error}
          hero={translationState.hero}
          baseLang={BASE_LANG}
          langs={TRANSLATION_LANGS}
          onClose={closeTranslationModal}
          onUpdated={handleTranslationsUpdated}
        />
      )}
    </div>
  );
}

/* ----- Modal ----- */
function HeroModal({
  initial,
  onClose,
  onSaved,
  cats,
  contentLang = DEFAULT_LANG,
}) {
  const [form, setForm] = useState(() => ({
    title: initial?.title || "",
    subtitle: initial?.subtitle || "",
    buttonText: initial?.buttonText || "",
    targetType: initial?.target?.type || "SHOP",
    categories: initial?.target?.categories || [],
    isActive: initial?.isActive ?? true,
    sortOrder: initial?.sortOrder ?? 0,
  }));
  const [file, setFile] = useState(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const languageLabel = (contentLang || DEFAULT_LANG).toUpperCase();

  const mediaPreview = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    if (initial?.image?.url) return initial.image.url;
    if (initial?.video?.url) return initial.video.url;
    return null;
  }, [file, initial]);

  const initialHasVideo = !!initial?.video;
  const initialHasImage = !!initial?.image;

  const submit = async (e) => {
    e?.preventDefault?.();

    setSaving(true);
    setError(null);
    try {
      let saved;
      if (initial?.id) {
        saved = await heroApi.update(
          initial.id,
          {
            ...form,
            file: file || undefined,
            removeMedia: removeMedia || undefined,
          },
          contentLang
        );
      } else {
        if (!file) {
          setError("Lütfen bir görsel veya video seçin.");
          setSaving(false);
          return;
        }
        saved = await heroApi.create({ ...form, file }, contentLang);
      }
      onSaved(saved);
    } catch (err) {
      setError(parseErr(err));
    } finally {
      setSaving(false);
    }
  };

  const allCategories = Array.isArray(cats) ? cats : [];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-0 top-0 mx-auto mt-8 w-[min(900px,92vw)] overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border-admin)] px-5 py-3">
          <div className="text-lg font-semibold">
            {initial ? "Hero’yu Düzenle" : "Yeni Hero"}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-[var(--color-bg-hover)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="grid gap-5 p-5 md:grid-cols-12">
          {error && (
            <div className="md:col-span-12">
              <AlertBanner
                variant="danger"
                message={error}
                onClose={() => setError(null)}
              />
            </div>
          )}
          <div className="md:col-span-12 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]/80 px-3 py-2 text-[11px] text-[var(--color-text-admin-muted)]">
            Başlık, alt başlık ve buton metni{" "}
            <span className="font-semibold text-[var(--color-text-admin)]">
              {languageLabel}
            </span>{" "}
            dilinde saklanır. Medya ve hedef seçimi burada yönetilir.
          </div>
          {/* SOL */}
          <div className="md:col-span-7 space-y-4">
            <Field
              label="Başlık"
              value={form.title}
              onChange={(v) => setForm((s) => ({ ...s, title: v }))}
              required
            />
            <Field
              label="Alt başlık"
              value={form.subtitle}
              onChange={(v) => setForm((s) => ({ ...s, subtitle: v }))}
              required
            />
            <Field
              label="Buton Metni"
              value={form.buttonText}
              onChange={(v) => setForm((s) => ({ ...s, buttonText: v }))}
              placeholder="(opsiyonel)"
            />

            {/* Hedef */}
            <div>
              <div className="mb-1 text-sm font-medium">Hedef</div>
              <div className="flex flex-wrap items-center gap-2">
                {["SHOP", "CATEGORIES"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((s) => ({ ...s, targetType: t }))}
                    className={[
                      "rounded-full border px-3 py-1.5 text-sm",
                      form.targetType === t
                        ? "border-[var(--color-text-admin)] text-[var(--color-text-admin)]"
                        : "border-[var(--color-border-admin)] text-[var(--color-text-admin-muted)] hover:bg-[var(--color-bg-hover)]",
                    ].join(" ")}
                  >
                    {t === "SHOP" ? "Mağaza" : "Kategoriler"}
                  </button>
                ))}
              </div>

              {form.targetType === "CATEGORIES" && (
                <div className="mt-3">
                  <div className="mb-1 text-xs text-[var(--color-text-admin-muted)]">
                    Bir veya daha fazla kategori seçin
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map((c) => {
                      const id = c.id || c._id;
                      const on = form.categories.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            setForm((s) => ({
                              ...s,
                              categories: on
                                ? s.categories.filter((x) => x !== id)
                                : [...s.categories, id],
                            }))
                          }
                          className={[
                            "rounded-full border px-3 py-1.5 text-sm",
                            on
                              ? "border-[var(--color-text-admin)] text-[var(--color-text-admin)]"
                              : "border-[var(--color-border-admin)] text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]",
                          ].join(" ")}
                          title={c.name}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Aktif"
                type="checkbox"
                checked={!!form.isActive}
                onChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
              />
              <Field
                label="Sıra"
                type="number"
                value={form.sortOrder}
                onChange={(v) =>
                  setForm((s) => ({
                    ...s,
                    sortOrder: Math.max(0, Number(v) || 0),
                  }))
                }
              />
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-5 py-2.5 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                Kaydet
              </button>
            </div>
          </div>

          {/* SAĞ: MEDYA */}
          <div className="md:col-span-5">
            <div className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] p-3">
              <div className="mb-2 text-sm font-medium">
                Medya (görsel veya video)
              </div>

              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]">
                {mediaPreview ? (
                  file ? (
                    file.type?.startsWith("video/") ? (
                      <video
                        src={mediaPreview}
                        className="h-full w-full object-cover"
                        controls
                      />
                    ) : (
                      <img
                        src={mediaPreview}
                        alt="Önizleme"
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : initialHasVideo ? (
                    <video
                      src={mediaPreview}
                      className="h-full w-full object-cover"
                      controls
                    />
                  ) : initialHasImage ? (
                    <img
                      src={mediaPreview}
                      alt="Önizleme"
                      className="h-full w-full object-cover"
                    />
                  ) : null
                ) : (
                  <div className="grid h-full place-items-center text-[var(--color-text-admin-muted)]">
                    Medya yok
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-full border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm hover:bg-[var(--color-bg-hover)]">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  Yükle
                </label>
                {initial?.id && (
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!removeMedia}
                      onChange={(e) => setRemoveMedia(e.target.checked)}
                    />
                    Mevcut medyayı kaldır
                  </label>
                )}
              </div>

              <div className="mt-2 text-xs text-[var(--color-text-admin-muted)]">
                Yalnızca tek bir medya öğesine izin verilir (görsel veya video).
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ----- küçük UI yardımcıları ----- */
function Field({
  label,
  value,
  onChange,
  type = "text",
  checked,
  required,
  placeholder,
}) {
  if (type === "checkbox") {
    return (
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-sm font-medium">{label}</span>
      </label>
    );
  }
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2 text-sm outline-none"
      />
    </label>
  );
}

function parseErr(e) {
  try {
    const msg = JSON.parse(e?.message || "")?.message;
    return msg || e?.message || "Beklenmeyen hata";
  } catch {
    return e?.message || "Beklenmeyen hata";
  }
}
