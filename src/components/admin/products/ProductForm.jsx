import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import AdminModal from "../common/AdminModal";
import TagInput from "../common/TagInput";
import ColorSelector from "./ColorSelector.jsx";
import ColorBadge from "../common/ColorBadge.jsx";
import { dedupeColors, normalizeColorValue } from "../../../utils/colors.js";

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

const makeKey = ({ color, size, attributeValue }) =>
  [color || "", size || "", attributeValue || ""].join("||");

function normalizeDetailsList(details) {
  if (!details) return [];
  if (Array.isArray(details)) {
    return details
      .map((item) => String(item).trim())
      .filter((item) => item.length);
  }
  if (typeof details === "string") {
    const trimmed = details.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter((item) => item.length);
      }
    } catch {
      // fall through to newline split
    }
    return trimmed
      .split(/\r?\n+/)
      .map((item) => item.trim())
      .filter((item) => item.length);
  }
  return [];
}

function normalizeOptionList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item) => item.length);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter((item) => item.length);
      }
    } catch {
      // fall through to delimiter split
    }
    return trimmed
      .split(/[,;\r?\n]+/)
      .map((item) => item.trim())
      .filter((item) => item.length);
  }
  return [];
}

export default function ProductForm({
  open,
  onClose,
  onSubmit,
  initialProduct = null,
  categories = [],
}) {
  const isEditing = Boolean(initialProduct?.id);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [careInstructions, setCareInstructions] = useState("");
  const [detailsInput, setDetailsInput] = useState("");
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [showColors, setShowColors] = useState(true);
  const [showSizes, setShowSizes] = useState(true);
  const [attributeTitle, setAttributeTitle] = useState("");
  const [attributeValues, setAttributeValues] = useState([]);
  const [showAttribute, setShowAttribute] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [newImages, setNewImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [removeImageIds, setRemoveImageIds] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialProduct?.name ?? "");
    setPrice(initialProduct?.price != null ? String(initialProduct.price) : "");
    setCategoryId(resolveCategoryId(initialProduct?.category));
    setDescription(initialProduct?.description ?? "");
    setCareInstructions(initialProduct?.careInstructions ?? "");
    setDetailsInput(normalizeDetailsList(initialProduct?.details).join("\n"));

    // ✅ renk/beden/opsiyonlar product meta’dan geliyor
    const inv = initialProduct?.inventory || [];
    const invColors = dedupeColors(inv.map((i) => i.color).filter(Boolean));
    const invSizes = Array.from(
      new Set(inv.map((i) => i.size).filter(Boolean)),
    );
    const invAttrs = Array.from(
      new Set(inv.map((i) => i.attributeValue).filter(Boolean)),
    );

    const normalizedColors = normalizeOptionList(initialProduct?.colors);
    const normalizedSizes = normalizeOptionList(initialProduct?.sizes);

    setColors(
      dedupeColors(normalizedColors.length ? normalizedColors : invColors),
    );
    setSizes(normalizedSizes.length ? normalizedSizes : invSizes);
    setShowColors(initialProduct?.showColors ?? true);
    setShowSizes(initialProduct?.showSizes ?? true);

    const attr = initialProduct?.customAttribute || {};
    const normalizedAttrValues = normalizeOptionList(attr.values);
    setAttributeTitle(attr.title || "");
    setAttributeValues(
      normalizedAttrValues.length ? normalizedAttrValues : invAttrs,
    );
    setShowAttribute(attr.show ?? false);

    // ✅ stoklar artık sadece görsel tablo için; backend'e ayrı gönderilecek
    setInventory(
      (initialProduct?.inventory || []).map((item) => ({
        color: normalizeColorValue(item.color),
        size: sanitizeOption(item.size),
        attributeValue: sanitizeOption(item.attributeValue),
        stock: Number(item.stock) || 0,
      })),
    );
    setInventoryOpen((initialProduct?.inventory || []).length > 1);
    setIsActive(initialProduct?.isActive ?? true);
    setExistingImages(initialProduct?.images || []);
    setNewImages([]);
    setRemoveImageIds([]);
    setError("");
    setSubmitting(false);
  }, [initialProduct, open]);

  useEffect(() => {
    return () => {
      newImages.forEach((image) => URL.revokeObjectURL(image.preview));
    };
  }, [newImages]);

  const attributeActive = useMemo(() => {
    return (
      showAttribute &&
      Boolean(attributeTitle.trim()) &&
      attributeValues.length > 0
    );
  }, [showAttribute, attributeTitle, attributeValues.length]);

  useEffect(() => {
    if (!open) return;
    const inv = initialProduct?.inventory || [];

    const invColors = Array.from(
      new Set(inv.map((i) => i?.color).filter(Boolean)),
    );
    const invSizes = Array.from(
      new Set(inv.map((i) => i?.size).filter(Boolean)),
    );
    const invAttrs = Array.from(
      new Set(inv.map((i) => i?.attributeValue).filter(Boolean)),
    );

    const colorList = showColors
      ? colors.length
        ? colors
        : isEditing && invColors.length
          ? invColors
          : [null]
      : [null];

    const sizeList = showSizes
      ? sizes.length
        ? sizes
        : isEditing && invSizes.length
          ? invSizes
          : [null]
      : [null];

    const attributeList = attributeActive
      ? attributeValues.length
        ? attributeValues
        : isEditing && invAttrs.length
          ? invAttrs
          : [null]
      : [null];

    const nextCombos = [];
    colorList.forEach((color) => {
      sizeList.forEach((size) => {
        attributeList.forEach((attributeValue) => {
          nextCombos.push({
            color: showColors ? normalizeColorValue(color) : null,
            size: sanitizeOption(size),
            attributeValue: sanitizeOption(attributeValue),
          });
        });
      });
    });

    setInventory((prev) => {
      const aggregated = new Map();
      prev.forEach((item) => {
        const colorValue = showColors ? normalizeColorValue(item.color) : null;
        const sizeValue = showSizes ? sanitizeOption(item.size) : null;
        const attrVal = attributeActive
          ? sanitizeOption(item.attributeValue)
          : null;
        const k = makeKey({
          color: colorValue,
          size: sizeValue,
          attributeValue: attrVal,
        });
        aggregated.set(k, (aggregated.get(k) || 0) + (Number(item.stock) || 0));
      });

      return nextCombos.map((combo) => ({
        ...combo,
        stock: aggregated.get(makeKey(combo)) || 0,
      }));
    });
  }, [
    open,
    colors,
    sizes,
    attributeValues,
    showColors,
    showSizes,
    attributeActive,
    isEditing,
    initialProduct?.inventory,
  ]);

  const totalImages = useMemo(
    () => existingImages.length + newImages.length,
    [existingImages.length, newImages.length],
  );

  const handleImageSelection = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const remainingSlots = Math.max(
      0,
      8 - (existingImages.length + newImages.length),
    );
    if (remainingSlots <= 0) {
      setError("En fazla 8 görsel eklenebilir");
      return;
    }

    const mapped = files
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, remainingSlots)
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));

    if (!mapped.length) return;
    setNewImages((prev) => [...prev, ...mapped]);
    setError("");
  };

  const removeExistingImage = (image) => {
    setExistingImages((prev) =>
      prev.filter((item) => item.publicId !== image.publicId),
    );
    setRemoveImageIds((prev) => [...prev, image.publicId]);
    setError("");
  };

  const removeNewImage = (image) => {
    setNewImages((prev) => {
      const next = prev.filter((item) => item.preview !== image.preview);
      URL.revokeObjectURL(image.preview);
      return next;
    });
    setError("");
  };

  const handleStockChange = (comboKey, value) => {
    const numeric = Math.max(0, Math.floor(Number(value)));
    setInventory((prev) =>
      prev.map((item) =>
        makeKey(item) === comboKey
          ? { ...item, stock: Number.isFinite(numeric) ? numeric : 0 }
          : item,
      ),
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Ürün adı zorunludur");
      return;
    }
    const priceValue = Number(price);
    if (Number.isNaN(priceValue) || priceValue < 0) {
      setError("Geçerli bir ürün fiyatı girin");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const normalizedColors = dedupeColors(normalizeOptionList(colors));

      // ✅ ÜRÜN PAYLOAD (stok hariç!)
      const productPayload = {
        name: name.trim(),
        price: priceValue,
        category: categoryId || "",
        description,
        careInstructions,
        details: detailsInput
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean),
        colors: showColors ? normalizedColors : [],
        sizes: showSizes ? normalizeOptionList(sizes) : [],
        showColors,
        showSizes,
        customAttribute: {
          title: attributeTitle.trim(),
          values: attributeValues,
          show:
            showAttribute &&
            attributeTitle.trim() &&
            attributeValues.length > 0,
        },
        isActive,
        images: newImages.map((item) => item.file),
        removeImagePublicIds: removeImageIds,
      };

      // ✅ STOK SATIRLARI (StockItem.replace için)
      const stockLines = inventory.map((item) => ({
        color:
          showColors && item.color ? normalizeColorValue(item.color) : null,
        size: showSizes && item.size ? item.size : null,
        attributeValue:
          attributeActive && item.attributeValue ? item.attributeValue : null,
        qtyOnHand: Number(item.stock) || 0,
      }));

      // Ürün + stok ayrı gönderilecek → üst komponentte stocksApi.replace çağrısı yapılır
      await onSubmit?.({ productPayload, stockLines });
      onClose?.();
    } catch (err) {
      const message = extractMessage(err) || "Ürün kaydedilemedi";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const variantColumns = useMemo(() => {
    const columns = [];
    if (showColors && colors.length)
      columns.push({ key: "color", label: "Renk" });
    if (showSizes && sizes.length)
      columns.push({ key: "size", label: "Beden" });
    if (attributeActive)
      columns.push({
        key: "attributeValue",
        label: attributeTitle || "Seçenek",
      });
    if (!columns.length) columns.push({ key: "variant", label: "Varyant" });
    return columns;
  }, [
    showColors,
    colors.length,
    showSizes,
    sizes.length,
    attributeActive,
    attributeTitle,
  ]);

  const renderVariantValue = (columnKey, combo) => {
    if (columnKey === "variant") return "Varsayılan";
    if (columnKey === "color") {
      return <ColorBadge value={combo.color} className="text-sm" />;
    }
    return combo[columnKey] || "—";
  };

  return (
    <AdminModal
      open={open}
      onClose={() => {
        if (submitting) return;
        onClose?.();
      }}
      title={isEditing ? "Ürünü Düzenle" : "Ürün Oluştur"}
      description="Katalog kayıtlarını, fiyatları ve görselleri yönetin."
      footer={
        <>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
            disabled={submitting}
          >
            İptal
          </button>
          <button
            type="submit"
            form="admin-product-form"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
          >
            {submitting
              ? "Kaydediliyor..."
              : isEditing
                ? "Ürünü Güncelle"
                : "Ürün Oluştur"}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <form
          id="admin-product-form"
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* ... form alanları aynı (ad/fiyat/kategori/açıklama/detaylar) ... */}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* sol taraf */}
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
                  Ürün adı
                  <span className="text-[var(--color-accent)]">*</span>
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={160}
                  className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                  placeholder="örn. Kablosuz Şarj Cihazı"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
                  Fiyat (TL)
                  <span className="text-[var(--color-accent)]">*</span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                  placeholder="129.90"
                />
                {price && !Number.isNaN(Number(price)) && (
                  <p className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
                    {currencyFormatter.format(Number(price))}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
                  Kategori
                </span>
                <select
                  value={categoryId || ""}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                >
                  <option value="">Kategori atanmadı</option>
                  {categories.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-[var(--color-text-admin)]">
                  Görünürlük
                </span>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(event) => setIsActive(event.target.checked)}
                    className="h-4 w-4 rounded border-[var(--color-border-admin)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                  />
                  <span className="text-sm text-[var(--color-text-admin)]">
                    {isActive ? "Vitrinde görünür" : "Gizli"}
                  </span>
                </label>
              </div>
            </div>

            {/* sağ taraf */}
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
                  Açıklama
                </span>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                  placeholder="Ürün sayfasında gösterilen kısa tanıtım yazısı."
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
                  Bakım talimatları
                </span>
                <textarea
                  rows={3}
                  value={careInstructions}
                  onChange={(event) => setCareInstructions(event.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                  placeholder="Örn. Nemden uzak tutun, sadece kuru bezle silin."
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
                  Madde madde detaylar
                </span>
                <textarea
                  rows={4}
                  value={detailsInput}
                  onChange={(event) => setDetailsInput(event.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                  placeholder="Her satıra bir detay"
                />
                <p className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
                  Bu maddeler “Detaylar” bölümünde liste halinde görünür.
                </p>
              </label>
            </div>
          </div>

          {/* Varyant eksenleri */}
          <div className="grid gap-4 lg:grid-cols-3">
            <SelectionCard
              title="Renkler"
              description="İsteğe bağlı renk örnekleri ekleyin."
              checked={showColors}
              onToggle={() => setShowColors((prev) => !prev)}
            >
              <ColorSelector
                values={colors}
                onChange={setColors}
                disabled={!showColors}
              />
              <p className="text-[11px] text-[var(--color-text-admin-muted)]">
                Bu ürün için seçili örneklerden yararlanın veya özel HEX
                renkleri ekleyin.
              </p>
            </SelectionCard>

            <SelectionCard
              title="Modeller"
              description="Uyumlu telefon modellerini yönetin."
              checked={showSizes}
              onToggle={() => setShowSizes((prev) => !prev)}
            >
              <TagInput
                label="Model seçenekleri"
                values={sizes}
                onChange={setSizes}
                placeholder="Model ekleyip Enter’a basın"
                helper="Örnek: iPhone 15, Galaxy S24, Pixel 8"
                disabled={!showSizes}
              />
            </SelectionCard>

            <SelectionCard
              title="Ürün özelliği"
              description="Uzunluk veya materyal gibi özel bir seçenek ekleyin."
              checked={showAttribute}
              onToggle={() => setShowAttribute((prev) => !prev)}
            >
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
                  Özellik başlığı
                </span>
                <input
                  value={attributeTitle}
                  onChange={(event) => setAttributeTitle(event.target.value)}
                  disabled={!showAttribute}
                  className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)] disabled:opacity-60"
                  placeholder="Örn. Kablo uzunluğu"
                />
              </label>
              <TagInput
                label="Özellik seçenekleri"
                values={attributeValues}
                onChange={setAttributeValues}
                placeholder="Seçenek ekleyip Enter’a basın"
                helper="Özellik başlığının altında gösterilir."
                disabled={!showAttribute || !attributeTitle.trim()}
              />
            </SelectionCard>
          </div>

          {/* Stok yönetimi: sadece UI, kaydetme ayrı çağrı ile yapılır */}
          <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-admin)]">
                  Stok yönetimi
                </h4>
                <p className="text-xs text-[var(--color-text-admin-muted)]">
                  Her varyant için stok girin. Boş bırakılanlar sıfır kabul
                  edilir.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInventoryOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
              >
                {inventoryOpen ? "Stoku gizle" : "Stoku yönet"}
              </button>
            </div>
            {inventoryOpen && (
              <div className="admin-table-container mt-4 overflow-x-auto">
                <table className="admin-table min-w-full divide-y divide-[var(--color-border-admin)]/70 text-sm">
                  <thead className="bg-[var(--color-bg-hover)]/60 text-[var(--color-text-admin-muted)]">
                    <tr>
                      {variantColumns.map((column) => (
                        <th
                          key={column.key}
                          className="px-3 py-2 text-left font-medium"
                        >
                          {column.label}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left font-medium">Stok</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-admin)]/60 text-[var(--color-text-admin)]">
                    {inventory.map((combo) => {
                      const comboKey = makeKey(combo);
                      return (
                        <tr key={comboKey}>
                          {variantColumns.map((column) => (
                            <td
                              key={column.key}
                              className="px-3 py-2"
                              data-label={column.label}
                            >
                              {renderVariantValue(column.key, combo)}
                            </td>
                          ))}
                          <td className="px-3 py-2" data-label="Stok">
                            <input
                              type="number"
                              min="0"
                              value={combo.stock}
                              onChange={(event) =>
                                handleStockChange(comboKey, event.target.value)
                              }
                              className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)] md:w-32"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Medya */}
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--color-text-admin)]">
                Medya galerisi
              </h4>
              <span className="text-xs text-[var(--color-text-admin-muted)]">
                {totalImages} / 8 görsel
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
              Yüksek kaliteli kare görseller yükleyin. Kaydettikten sonra
              sürükleyerek sıralayabilirsiniz.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[var(--color-border-admin)] px-4 py-3 text-sm text-[var(--color-text-admin)] hover:border-[var(--color-text-admin)]">
                <Upload className="h-4 w-4" />
                Görsel ekle
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelection}
                />
              </label>
              {existingImages.map((image) => (
                <figure
                  key={image.publicId}
                  className="relative overflow-hidden rounded-xl border border-[var(--color-border-admin)]"
                >
                  <img
                    src={image.url}
                    alt={image.publicId}
                    className="h-24 w-24 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(image)}
                    className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-xs font-semibold text-white"
                  >
                    Kaldır
                  </button>
                </figure>
              ))}
              {newImages.map((image) => (
                <figure
                  key={image.preview}
                  className="relative overflow-hidden rounded-xl border border-[var(--color-border-admin)]"
                >
                  <img
                    src={image.preview}
                    alt="Yeni yükleme"
                    className="h-24 w-24 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeNewImage(image)}
                    className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-xs font-semibold text-white"
                  >
                    Kaldır
                  </button>
                </figure>
              ))}
              {!existingImages.length && !newImages.length && (
                <div className="grid h-24 w-24 place-items-center rounded-xl border border-dashed border-[var(--color-border-admin)] text-[var(--color-text-admin-muted)]">
                  <ImagePlus className="h-6 w-6" />
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-[var(--color-bg-hover)] px-4 py-3 text-sm text-[var(--color-accent)]">
              {error}
            </div>
          )}
        </form>
      </div>
    </AdminModal>
  );
}

function ProductTranslationEditors({
  langs,
  drafts,
  onFieldChange,
  onCopyFromBase,
  onReset,
  onSave,
  savingMap,
  baseDraft,
  savedDrafts,
  hasCustomAttribute,
}) {
  const [openStates, setOpenStates] = useState(() => {
    const initial = {};
    langs.forEach(({ value }) => {
      initial[value] = false;
    });
    return initial;
  });

  useEffect(() => {
    const reset = {};
    langs.forEach(({ value }) => {
      reset[value] = false;
    });
    setOpenStates(reset);
  }, [langs, savedDrafts]);

  const defaultDraft = {
    name: "",
    description: "",
    careInstructions: "",
    details: "",
    customAttributeTitle: "",
    customAttributeValues: "",
  };

  return (
    <section className="space-y-4">
      <header>
        <h4 className="text-lg font-semibold text-[var(--color-text-admin)]">
          Çeviri varyantları
        </h4>
        <p className="text-sm text-[var(--color-text-admin-muted)]">
          Buradaki metinler seçilen dil için kaydedilir. Boş bıraktığınız
          alanlar otomatik olarak Türkçe içeriği gösterir.
        </p>
      </header>

      <div className="space-y-4">
        {langs.map(({ value, label }) => {
          const draft = drafts?.[value] || defaultDraft;
          const savedDraft = savedDrafts?.[value] || defaultDraft;
          const isOpen = openStates[value];
          const isSaving = Boolean(savingMap?.[value]);
          const isDirty =
            (draft.name ?? "") !== (savedDraft.name ?? "") ||
            (draft.description ?? "") !== (savedDraft.description ?? "") ||
            (draft.careInstructions ?? "") !==
              (savedDraft.careInstructions ?? "") ||
            (draft.details ?? "") !== (savedDraft.details ?? "") ||
            (draft.customAttributeTitle ?? "") !==
              (savedDraft.customAttributeTitle ?? "") ||
            (draft.customAttributeValues ?? "") !==
              (savedDraft.customAttributeValues ?? "");

          const summary = savedDraft.name
            ? savedDraft.name
            : "Türkçe metin kullanılıyor";

          const toggleOpen = () =>
            setOpenStates((prev) => ({
              ...prev,
              [value]: !prev[value],
            }));

          const handleCopy = () => {
            onCopyFromBase(value);
            setOpenStates((prev) => ({ ...prev, [value]: true }));
          };

          return (
            <div
              key={value}
              className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]"
            >
              <div className="flex flex-col gap-3 border-b border-[var(--color-border-admin)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-admin)]">
                    {label}
                  </p>
                  <p className="text-xs text-[var(--color-text-admin-muted)]">
                    Kaydedilen: {summary}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleOpen}
                    className="rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
                  >
                    {isOpen ? "Kapat" : "Çeviri düzenle"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
                    disabled={!baseDraft}
                  >
                    TR’den kopyala
                  </button>
                  <button
                    type="button"
                    onClick={() => onReset(value)}
                    className="rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
                    disabled={!isDirty}
                  >
                    Kaydedileni geri al
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="space-y-4 px-4 py-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                      Ürün adı ({label})
                    </span>
                    <input
                      value={draft.name}
                      onChange={(event) =>
                        onFieldChange(value, "name", event.target.value)
                      }
                      className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                      placeholder="örn. Kablosuz Şarj Cihazı"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                      Açıklama
                    </span>
                    <textarea
                      rows={3}
                      value={draft.description}
                      onChange={(event) =>
                        onFieldChange(value, "description", event.target.value)
                      }
                      className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                      placeholder="Ürün sayfasında gösterilen kısa tanıtım."
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                      Bakım talimatları
                    </span>
                    <textarea
                      rows={3}
                      value={draft.careInstructions}
                      onChange={(event) =>
                        onFieldChange(
                          value,
                          "careInstructions",
                          event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                      placeholder="Örneğin: Nemden uzak tutun, sadece kuru bezle silin."
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                      Detaylar (her satır bir madde)
                    </span>
                    <textarea
                      rows={4}
                      value={draft.details}
                      onChange={(event) =>
                        onFieldChange(value, "details", event.target.value)
                      }
                      className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                      placeholder={"Her satıra bir madde yazın"}
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                        Özellik başlığı
                      </span>
                      <input
                        value={draft.customAttributeTitle}
                        onChange={(event) =>
                          onFieldChange(
                            value,
                            "customAttributeTitle",
                            event.target.value,
                          )
                        }
                        className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)] disabled:opacity-60"
                        placeholder="Örn. Malzeme"
                        disabled={!hasCustomAttribute}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                        Özellik değerleri (her satır bir seçenek)
                      </span>
                      <textarea
                        rows={hasCustomAttribute ? 3 : 1}
                        value={draft.customAttributeValues}
                        onChange={(event) =>
                          onFieldChange(
                            value,
                            "customAttributeValues",
                            event.target.value,
                          )
                        }
                        className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)] disabled:opacity-60"
                        placeholder="Örn. Pamuk, Saten"
                        disabled={!hasCustomAttribute}
                      />
                    </label>
                  </div>
                  {!hasCustomAttribute && (
                    <p className="text-xs text-[var(--color-text-admin-muted)]">
                      Bu üründe özel özellik seçeneği kullanılmıyor; başlık ve
                      değerler boş bırakılabilir.
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onReset(value)}
                      className="rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
                      disabled={!isDirty}
                    >
                      Kaydedileni geri al
                    </button>
                    <button
                      type="button"
                      onClick={() => onSave(value)}
                      className="rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
                      disabled={!isDirty || isSaving}
                    >
                      {isSaving ? "Kaydediliyor" : "Kaydet"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function resolveCategoryId(category) {
  if (!category) return "";
  if (typeof category === "string") return category;
  return category?.id || category?._id || "";
}

function sanitizeOption(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function extractMessage(error) {
  if (!error) return "";
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return parsed.message;
    } catch {
      /* ignore */
    }
    return error.message;
  }
  return String(error);
}

function SelectionCard({ title, description, checked, onToggle, children }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-admin)]">
            {title}
          </h4>
          <p className="text-xs text-[var(--color-text-admin-muted)]">
            {description}
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-admin)]">
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="h-4 w-4 rounded border-[var(--color-border-admin)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
          />
          Göster
        </label>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}
