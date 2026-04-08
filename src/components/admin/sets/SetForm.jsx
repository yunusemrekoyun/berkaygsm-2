import { useEffect, useMemo, useRef, useState } from "react";
import AdminModal from "../common/AdminModal";
import { Plus, Trash2, ChevronDown, Search } from "lucide-react";
import { DEFAULT_LANG } from "../../../constants/lang.js";
import AppImage from "../../ui/AppImage.jsx";

const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

const uid = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/* Buffer ObjectId -> String ObjectId */
const normalizeId = (raw) => {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw?.buffer?.data && Array.isArray(raw.buffer.data)) {
    return raw.buffer.data.map((n) => n.toString(16).padStart(2, "0")).join("");
  }
  if (raw?.data && Array.isArray(raw.data)) {
    return raw.data.map((n) => n.toString(16).padStart(2, "0")).join("");
  }
  if (raw?._id) return normalizeId(raw._id);
  return String(raw);
};

export default function SetForm({
  open,
  onClose,
  onSubmit,
  onDelete,
  initialSet,
  products = [],
  categories = [],
  contentLang = DEFAULT_LANG,
}) {
  const languageLabel = (contentLang || DEFAULT_LANG).toUpperCase();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [show, setShow] = useState(true);
  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [removeImageIds, setRemoveImageIds] = useState([]);
  const [entries, setEntries] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  /* Form açıldığında initial değerleri yükle */
  useEffect(() => {
    if (!open) return;
    setName(initialSet?.name ?? "");
    setDescription(initialSet?.description ?? "");
    setPrice(initialSet?.price != null ? String(initialSet.price) : "");
    setCategoryId(
      normalizeId(
        initialSet?.category?.id ||
          initialSet?.category?._id ||
          initialSet?.category
      ) || ""
    );
    setShow(initialSet?.show ?? true);
    setExistingImages(initialSet?.images || []);
    setNewImages([]);
    setRemoveImageIds([]);
    setEntries(
      (initialSet?.products || []).map((entry) => ({
        key: uid(),
        productId: normalizeId(entry.product?.id || entry.product?._id),
        product: entry.product,
        quantity: entry.quantity || 1,
      }))
    );
    setError("");
    setSubmitting(false);
  }, [initialSet, open]);

  /* Product listesi (id normalize edilerek) */
  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        id: normalizeId(p.id || p._id),
        label: p.name,
        price: p.price,
      })),
    [products]
  );

  const handleAddEntry = () => {
    setEntries((prev) => [
      ...prev,
      { key: uid(), productId: "", product: null, quantity: 1 },
    ]);
  };

  const handleRemoveEntry = (key) => {
    setEntries((prev) => prev.filter((entry) => entry.key !== key));
  };

  const handleProductChange = (key, productId) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.key === key
          ? {
              ...entry,
              productId: normalizeId(productId),
              product:
                products.find(
                  (p) => normalizeId(p.id || p._id) === normalizeId(productId)
                ) || null,
            }
          : entry
      )
    );
  };

  const handleQuantityChange = (key, quantity) => {
    const next = Math.max(1, Number(quantity) || 1);
    setEntries((prev) =>
      prev.map((entry) =>
        entry.key === key ? { ...entry, quantity: next } : entry
      )
    );
  };

  // Görsel işlemleri
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const mapped = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setNewImages((prev) => [...prev, ...mapped]);
  };

  const handleRemoveExistingImage = (publicId) => {
    setExistingImages((prev) =>
      prev.filter((image) => image.publicId !== publicId)
    );
    setRemoveImageIds((prev) => [...prev, publicId]);
  };

  const handleRemoveNewImage = (preview) => {
    setNewImages((prev) => {
      const next = prev.filter((image) => image.preview !== preview);
      const removed = prev.find((image) => image.preview === preview);
      if (removed) {
        try {
          URL.revokeObjectURL(removed.preview);
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  };

  const composedSetProducts = () =>
    entries.map((entry) => ({
      productId: normalizeId(entry.productId),
      quantity: entry.quantity,
    }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Set adı zorunludur");
      return;
    }
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setError("Set fiyatı geçerli olmalıdır");
      return;
    }
    if (!entries.length) {
      setError("Sete en az bir ürün ekleyin");
      return;
    }
    if (entries.some((e) => !e.productId)) {
      setError("Tüm satırlarda ürün seçilmelidir");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        price: numericPrice,
        categoryId: categoryId || undefined,
        show,
        products: composedSetProducts(),
        images: newImages.map((image) => image.file),
        removeImagePublicIds: removeImageIds,
      };
      await onSubmit?.(payload);
    } catch (err) {
      setError(err.message || "Set kaydedilemedi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminModal
      open={open}
      onClose={() => {
        if (submitting) return;
        onClose?.();
      }}
      title={initialSet?.id ? "Seti düzenle" : "Set oluştur"}
      description="Kataloğunuzdaki ürünlerden paketler oluşturun."
      footer={
        <>
          {initialSet?.id && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 sm:mr-auto sm:w-auto"
            >
              <Trash2 className="h-4 w-4" /> Sil
            </button>
          )}
          <button
            type="button"
            onClick={() => onClose?.()}
            className="w-full rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] sm:w-auto"
            disabled={submitting}
          >
            İptal
          </button>
          <button
            type="submit"
            form="admin-set-form"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60 sm:w-auto"
            disabled={submitting}
          >
            {submitting
              ? "Kaydediliyor..."
              : initialSet?.id
                ? "Değişiklikleri kaydet"
                : "Set oluştur"}
          </button>
        </>
      }
    >
      <form id="admin-set-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]/80 px-3 py-2 text-[11px] text-[var(--color-text-admin-muted)]">
          Set başlığı ve açıklaması{" "}
          <span className="font-semibold text-[var(--color-text-admin)]">
            {languageLabel}
          </span>{" "}
          diline kaydedilir. Fiyat ve ürün listesi burada yönetilir.
        </div>

        {/* Genel bilgiler */}
        <section className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              Set adı<span className="text-[var(--color-accent)]">*</span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="Yeni Telefon Aksesuar Seti"
              maxLength={160}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              Fiyat (TL)<span className="text-[var(--color-accent)]">*</span>
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="499.00"
            />
            {price && (
              <span className="mt-1 block text-xs text-[var(--color-text-admin-muted)]">
                {currency.format(Number(price) || 0)}
              </span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              Kategori
            </span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
            >
              <option value="">— Kategori seçin —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-2 block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              Açıklama
            </span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="Bu seti özel kılan özellikleri açıklayın."
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-admin)]">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border-admin)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            Vitrinde görünür
          </label>
        </section>

        {/* Görseller */}
        <section>
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-text-admin)]">
              Görseller
            </h3>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-[var(--color-border-admin)] px-4 py-2 text-sm text-[var(--color-text-admin)] hover:border-[var(--color-text-admin)]">
              <Plus className="h-4 w-4" /> Yükle
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>
          </header>

          <div className="mt-3 flex flex-wrap gap-3">
            {existingImages.map((img) => (
              <figure
                key={img.publicId}
                className="relative overflow-hidden rounded-xl border border-[var(--color-border-admin)]"
              >
                <AppImage
                  src={img.url}
                  alt={img.publicId}
                  width={96}
                  height={96}
                  sizes="96px"
                  className="h-24 w-24 object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveExistingImage(img.publicId)}
                  className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-xs font-semibold text-white"
                >
                  Kaldır
                </button>
              </figure>
            ))}

            {newImages.map((img) => (
              <figure
                key={img.preview}
                className="relative overflow-hidden rounded-xl border border-[var(--color-border-admin)]"
              >
                <AppImage
                  src={img.preview}
                  alt="Yeni yükleme"
                  width={96}
                  height={96}
                  sizes="96px"
                  className="h-24 w-24 object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveNewImage(img.preview)}
                  className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-xs font-semibold text-white"
                >
                  Kaldır
                </button>
              </figure>
            ))}
          </div>
        </section>

        {/* Ürün listesi */}
        <section>
          <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-admin)]">
                Set ürünleri
              </h3>
              <p className="text-xs text-[var(--color-text-admin-muted)]">
                Mevcut kataloğunuzdan ürün seçin.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddEntry}
              disabled={!productOptions.length}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Ürün ekle
            </button>
          </header>

          <div className="mt-4 space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.key}
                className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-admin-muted)]">
                    Ürün {entries.indexOf(entry) + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEntry(entry.key)}
                    className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Kaldır
                  </button>
                </div>

                <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <ProductCombobox
                    value={entry.productId}
                    options={productOptions}
                    onChange={(id) => handleProductChange(entry.key, id)}
                    autoFocus={!entry.productId}
                  />

                  <label className="flex items-center gap-2">
                    <span className="shrink-0 text-xs text-[var(--color-text-admin-muted)]">
                      Adet
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={entry.quantity}
                      onChange={(e) =>
                        handleQuantityChange(entry.key, e.target.value)
                      }
                      className="w-20 rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-2 py-2 text-center text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                    />
                  </label>
                </div>
              </div>
            ))}

            {entries.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--color-border-admin)] px-4 py-6 text-center text-sm text-[var(--color-text-admin-muted)]">
                Henüz ürün eklenmedi. &ldquo;Ürün ekle&rdquo; ile başlayın.
              </div>
            )}
          </div>
        </section>

        {error && (
          <div className="rounded-xl bg-[var(--color-bg-hover)] px-4 py-3 text-sm text-[var(--color-accent)]">
            {error}
          </div>
        )}
      </form>
    </AdminModal>
  );
}

/* ─────────────────────────── ProductCombobox ─────────────────────────── */

function ProductCombobox({ value, options, onChange, autoFocus = false }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(autoFocus);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => o.id === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 60);
    return options
      .filter((o) => o.label.toLowerCase().includes(q))
      .slice(0, 60);
  }, [query, options]);

  /* Dışarı tıklayınca kapat */
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* autoFocus: yeni satır eklenince dropdown açık gelsin */
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSelect = (id) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    if (!open) setOpen(true);
  };

  const handleFocus = () => {
    setQuery("");
    setOpen(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  const displayValue = open ? query : (selected?.label ?? "");
  const placeholder = open ? "Ürün adı yazın…" : "Ürün seçin…";

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-[var(--color-bg-card)] px-3 py-2 transition-colors ${
          open
            ? "border-[var(--color-text-admin)]"
            : "border-[var(--color-border-admin)]"
        }`}
      >
        <Search className="h-3.5 w-3.5 shrink-0 opacity-40" />
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-admin)] outline-none"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setOpen((v) => !v);
            if (!open) {
              setQuery("");
              inputRef.current?.focus();
            }
          }}
          className="shrink-0 opacity-40 hover:opacity-70"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-[var(--color-text-admin-muted)]">
              Sonuç bulunamadı
            </li>
          ) : (
            filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(o.id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-bg-hover)] ${
                    o.id === value
                      ? "font-semibold text-[var(--color-text-admin)]"
                      : "text-[var(--color-text-admin)]"
                  }`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.price != null && (
                    <span className="shrink-0 text-xs text-[var(--color-text-admin-muted)]">
                      {currency.format(o.price)}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
