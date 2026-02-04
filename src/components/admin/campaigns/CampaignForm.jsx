import { useEffect, useMemo, useState } from "react";
import { UploadCloud, Image as ImageIcon, X } from "lucide-react";
import EntityPicker from "../discounts/EntityPicker.jsx";
import { DEFAULT_LANG } from "../../../constants/lang.js";

function mapSelected(ids = [], options = []) {
  if (!ids.length) return [];
  const optionMap = new Map(
    options.map((option) => [String(option.id), option])
  );
  return ids
    .map((raw) => {
      const id =
        typeof raw === "string"
          ? raw
          : raw?.id || raw?._id || raw?.value || String(raw || "");
      if (!id) return null;
      const option = optionMap.get(String(id));
      return (
        option || {
          id: String(id),
          label: `#${String(id)}`,
        }
      );
    })
    .filter(Boolean);
}

function computeSummary({
  selectedProducts,
  selectedSets,
  selectedCategories,
  selectedDiscounts,
}) {
  const discountSets = selectedDiscounts.reduce(
    (acc, discount) => acc + (discount.appliesTo?.sets?.length || 0),
    0
  );
  const discountProducts = selectedDiscounts.reduce(
    (acc, discount) =>
      acc +
      (discount.appliesTo?.products?.length || 0) +
      (discount.appliesTo?.categories?.length || 0),
    0
  );

  const hasSets = selectedSets.length > 0 || discountSets > 0;
  const hasProducts =
    selectedProducts.length > 0 ||
    selectedCategories.length > 0 ||
    discountProducts > 0;

  const discountConflicts = selectedDiscounts.filter((discount) => {
    const appliesTo = discount.appliesTo || {};
    const coversSets = (appliesTo.sets || []).length > 0;
    const coversProducts =
      (appliesTo.products || []).length > 0 ||
      (appliesTo.categories || []).length > 0;
    return coversSets && coversProducts;
  });

  return {
    targetType: hasSets ? "SETS" : "PRODUCTS",
    hasSets,
    hasProducts,
    discountConflicts,
  };
}

export default function CampaignForm({
  mode = "create",
  initialCampaign = null,
  onSubmit,
  onCancel,
  submitting = false,
  productOptions = [],
  setOptions = [],
  categoryOptions = [],
  discountOptions = [],
  contentLang = DEFAULT_LANG,
}) {
  const languageLabel = (contentLang || DEFAULT_LANG).toUpperCase();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [badge, setBadge] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [layout, setLayout] = useState("SMALL");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedSets, setSelectedSets] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedDiscounts, setSelectedDiscounts] = useState([]);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [error, setError] = useState("");

  useEffect(() => {
    if (!initialCampaign) {
      setName("");
      setDescription("");
      setBadge("");
      setCtaText("");
      setLayout("SMALL");
      setIsActive(true);
      setSortOrder(0);
      setSelectedProducts([]);
      setSelectedSets([]);
      setSelectedCategories([]);
      setSelectedDiscounts([]);
      setImageFile(null);
      setImagePreview("");
      setError("");
      return;
    }

    setName(initialCampaign.name || "");
    setDescription(initialCampaign.description || "");
    setBadge(initialCampaign.badge || "");
    setCtaText(initialCampaign.ctaText || "");
    setLayout(initialCampaign.layout || "SMALL");
    setIsActive(Boolean(initialCampaign.isActive));
    setSortOrder(initialCampaign.sortOrder ?? 0);
    setSelectedProducts(
      mapSelected(initialCampaign.target?.products, productOptions)
    );
    setSelectedSets(mapSelected(initialCampaign.target?.sets, setOptions));
    setSelectedCategories(
      mapSelected(initialCampaign.target?.categories, categoryOptions)
    );
    setSelectedDiscounts(
      mapSelected(initialCampaign.target?.discounts, discountOptions)
    );
    setImageFile(null);
    setImagePreview(initialCampaign.image?.url || "");
    setError("");
  }, [
    initialCampaign,
    productOptions,
    setOptions,
    categoryOptions,
    discountOptions,
  ]);

  const summary = useMemo(
    () =>
      computeSummary({
        selectedProducts,
        selectedSets,
        selectedCategories,
        selectedDiscounts,
      }),
    [selectedProducts, selectedSets, selectedCategories, selectedDiscounts]
  );

  const targetConflict = summary.hasSets && summary.hasProducts;

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Kampanya adı zorunludur.");
      return;
    }

    if (summary.discountConflicts.length) {
      setError(
        `Seçili indirim(ler) hem setleri hem ürünleri kapsıyor: ${summary.discountConflicts
          .map((d) => d.label || d.name || d.id)
          .join(", ")}`
      );
      return;
    }

    if (targetConflict) {
      setError(
        "Setleri ürünler/kategoriler ile birlikte hedefleyemezsiniz. Lütfen seçimleri düzenleyin."
      );
      return;
    }

    if (!summary.hasSets && !summary.hasProducts) {
      setError(
        "Bu kampanya için en az bir ürün, kategori, set veya indirim seçin."
      );
      return;
    }

    if (mode === "create" && !imageFile) {
      setError("Lütfen bir kampanya görseli yükleyin.");
      return;
    }

    const payload = {
      name: name.trim(),
      description,
      badge,
      ctaText,
      layout,
      isActive,
      sortOrder: Number(sortOrder) || 0,
      products: selectedProducts,
      sets: selectedSets,
      categories: selectedCategories,
      discounts: selectedDiscounts,
    };

    if (imageFile) payload.image = imageFile;

    try {
      await onSubmit?.(payload, { targetType: summary.targetType });
    } catch (err) {
      const message =
        err?.message ||
        (err instanceof Error
          ? err.message
          : String(err || "Beklenmeyen hata"));
      setError(message);
    }
  };

  const resetImage = () => {
    setImageFile(null);
    if (initialCampaign?.image?.url) {
      setImagePreview(initialCampaign.image.url);
    } else {
      setImagePreview("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-5"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-admin-muted)]">
            {mode === "create" ? "Yeni Kampanya" : "Kampanyayı Düzenle"}
          </p>
          <h2 className="text-xl font-semibold text-[var(--color-text-admin)]">
            {mode === "create" ? "Kampanya oluştur" : initialCampaign?.name}
          </h2>
          <p className="text-xs text-[var(--color-text-admin-muted)]">
            Ana sayfada görünen kampanya kartını yapılandırın.
          </p>
        </div>

        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
            >
              İptal
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-4 py-2 text-xs font-semibold text-[var(--color-bg-admin)] transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting
              ? "Kaydediliyor…"
              : mode === "create"
              ? "Oluştur"
              : "Kaydet"}
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/40 px-3 py-2 text-[11px] text-[var(--color-text-admin-muted)]">
        Kampanya başlığı, açıklaması ve CTA metinleri{" "}
        <span className="font-semibold text-[var(--color-text-admin)]">
          {languageLabel}
        </span>{" "}
        diline aittir. Görsel ve hedef seçimleri burada yönetilir.
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
            Kampanya adı
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
            placeholder="Yaz Kapsülü"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
            Rozet (opsiyonel)
          </span>
          <input
            type="text"
            value={badge}
            onChange={(event) => setBadge(event.target.value)}
            className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
            placeholder="Sınırlı"
          />
        </label>
        <label className="sm:col-span-2 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
            Açıklama (opsiyonel)
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
            placeholder="Bu kampanya kartı için teklifi veya hikâyeyi vurgulayın."
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
            CTA metni
          </span>
          <input
            type="text"
            value={ctaText}
            onChange={(event) => setCtaText(event.target.value)}
            className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
            placeholder="Hemen alışveriş yap"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
            Yerleşim
          </span>
          <select
            value={layout}
            onChange={(event) => setLayout(event.target.value)}
            className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
          >
            <option value="BIG">Büyük (2x2 vitrin)</option>
            <option value="WIDE">Geniş (2x1 banner)</option>
            <option value="SMALL">Küçük karo</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
            Sıra
          </span>
          <input
            type="number"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
            Görünürlük
          </span>
          <button
            type="button"
            onClick={() => setIsActive((prev) => !prev)}
            className={`inline-flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${
              isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            <span>{isActive ? "Aktif" : "Gizli"}</span>
            <span className="text-xs">
              {isActive ? "Ana sayfada görünür" : "Görünmez"}
            </span>
          </button>
        </label>
      </div>

      <div>
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
          Kampanya görseli
        </span>
        <div className="flex items-start gap-3">
          <label className="flex cursor-pointer flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--color-border-admin)]/80 bg-[var(--color-bg-admin)]/60 px-6 py-10 text-center text-sm text-[var(--color-text-admin-muted)] hover:border-[var(--color-text-admin)]">
            {imagePreview ? (
              <div className="w-full">
                <div className="relative mx-auto h-40 w-full max-w-xs overflow-hidden rounded-xl border border-[var(--color-border-admin)]">
                  <img
                    src={imagePreview}
                    alt="Kampanya önizleme"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      resetImage();
                    }}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    title="Görseli kaldır"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-admin-muted)]">
                  Değiştirmek için tıklayın
                </p>
              </div>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-[var(--color-text-admin)]" />
                <span>
                  Bir görsel bırakın ya da{" "}
                  <span className="font-semibold text-[var(--color-text-admin)]">
                    göz atın
                  </span>
                </span>
                <span className="text-[11px] text-[var(--color-text-admin-muted)]">
                  Önerilen 1200x800 JPG/PNG
                </span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {!imagePreview && (
            <div className="hidden h-40 w-40 items-center justify-center rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] text-[var(--color-text-admin-muted)] sm:flex">
              <ImageIcon className="h-10 w-10" />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/60 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Hedef özeti
            </p>
            <p className="text-sm font-semibold text-[var(--color-text-admin)]">
              {summary.targetType === "SETS"
                ? "Sets sayfası /sets?campaign=…"
                : "Mağaza sayfası /shop?campaign=…"}
            </p>
          </div>
          <div className="text-xs text-[var(--color-text-admin-muted)]">
            Ürünler: {selectedProducts.length} • Setler: {selectedSets.length} •
            Kategoriler: {selectedCategories.length} • İndirimler:{" "}
            {selectedDiscounts.length}
          </div>
        </div>

        {targetConflict && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Karışık seçimler tespit edildi. Kampanyalar ya setleri ya da
            ürünler/kategorileri hedeflemelidir; ikisi birden olmaz.
          </div>
        )}

        {summary.discountConflicts.length > 0 && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            Hem setleri hem ürünleri kapsayan indirimlere izin verilmez:{" "}
            {summary.discountConflicts
              .map((d) => d.label || d.name || d.id)
              .join(", ")}
          </div>
        )}
      </div>

      <EntityPicker
        label="Ürünler"
        options={productOptions}
        value={selectedProducts}
        onChange={setSelectedProducts}
        placeholder="Ürünlerde ara…"
        helper=" /shop üzerinde görünür."
      />

      <EntityPicker
        label="Kategoriler"
        options={categoryOptions}
        value={selectedCategories}
        onChange={setSelectedCategories}
        placeholder="Kategorilerde ara…"
        helper="Alt kırılımları da içerir."
      />

      <EntityPicker
        label="Setler"
        options={setOptions}
        value={selectedSets}
        onChange={setSelectedSets}
        placeholder="Setlerde ara…"
        helper="Set kampanyaları /sets adresine yönlendirir."
      />

      <EntityPicker
        label="İndirim grupları"
        options={discountOptions}
        value={selectedDiscounts}
        onChange={setSelectedDiscounts}
        placeholder="İndirimlerde ara…"
        helper="Kampanya indirim kapsamını devralır."
      />
    </form>
  );
}
