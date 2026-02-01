import { useEffect, useMemo, useState } from "react";
import AdminModal from "../common/AdminModal";
import EntityPicker from "./EntityPicker.jsx";
import AlertBanner from "../../ui/AlertBanner.jsx";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
});

export default function DiscountForm({
  open,
  onClose,
  onSubmit,
  initialDiscount = null,
  productOptions = [],
  setOptions = [],
  categoryOptions = [],
  submitting = false,
  conflict = null,
  onResolveConflict,
}) {
  const isEditing = Boolean(initialDiscount?.id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [percentage, setPercentage] = useState("");
  const [active, setActive] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedSets, setSelectedSets] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initialDiscount?.name ?? "");
    setDescription(initialDiscount?.description ?? "");
    setPercentage(
      initialDiscount?.percentage != null
        ? String(initialDiscount.percentage)
        : ""
    );
    setActive(initialDiscount?.active ?? true);

    const mapInitial = (items = [], options = []) => {
      const optionMap = new Map(options.map((opt) => [opt.id, opt]));
      return items.map((item) => {
        const match = optionMap.get(item.id || item);
        return (
          match || {
            id: item.id || item,
            label: item.name || item.slug || String(item.id || item),
            hint: undefined,
          }
        );
      });
    };

    setSelectedProducts(
      mapInitial(initialDiscount?.appliesTo?.products, productOptions)
    );
    setSelectedSets(mapInitial(initialDiscount?.appliesTo?.sets, setOptions));
    setSelectedCategories(
      mapInitial(initialDiscount?.appliesTo?.categories, categoryOptions)
    );
    setError("");
  }, [open, initialDiscount, productOptions, setOptions, categoryOptions]);

  const productNameMap = useMemo(() => {
    const map = new Map();
    productOptions.forEach((opt) => map.set(opt.id, opt.label));
    selectedProducts.forEach((item) => map.set(item.id, item.label));
    return map;
  }, [productOptions, selectedProducts]);

  const setNameMap = useMemo(() => {
    const map = new Map();
    setOptions.forEach((opt) => map.set(opt.id, opt.label));
    selectedSets.forEach((item) => map.set(item.id, item.label));
    return map;
  }, [setOptions, selectedSets]);

  const categoryNameMap = useMemo(() => {
    const map = new Map();
    categoryOptions.forEach((opt) => map.set(opt.id, opt.label));
    selectedCategories.forEach((item) => map.set(item.id, item.label));
    return map;
  }, [categoryOptions, selectedCategories]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting) return;

    if (!name.trim()) {
      setError("İndirim adı zorunludur");
      return;
    }
    const perc = Number(percentage);
    if (!Number.isFinite(perc) || perc <= 0 || perc > 100) {
      setError("Yüzde değeri 1 ile 100 arasında olmalıdır");
      return;
    }
    if (
      selectedProducts.length === 0 &&
      selectedSets.length === 0 &&
      selectedCategories.length === 0
    ) {
      setError("En az bir ürün, set veya kategori seçin");
      return;
    }

    setError("");
    onSubmit?.({
      name: name.trim(),
      description: description.trim(),
      percentage: perc,
      active,
      products: selectedProducts
        .map((item) => normalizeId(item.id))
        .filter(Boolean),
      sets: selectedSets.map((item) => normalizeId(item.id)).filter(Boolean),
      categories: selectedCategories
        .map((item) => normalizeId(item.id))
        .filter(Boolean),
    });
  };

  const coverageHint = useMemo(() => {
    const productCount = selectedProducts.length;
    const setCount = selectedSets.length;
    const categoryCount = selectedCategories.length;
    const parts = [];
    if (productCount) parts.push(`${productCount} ürün`);
    if (setCount) parts.push(`${setCount} set`);
    if (categoryCount) parts.push(`${categoryCount} kategori`);
    return parts.join(" • ");
  }, [selectedProducts.length, selectedSets.length, selectedCategories.length]);

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={isEditing ? "İndirimi Düzenle" : "İndirim Oluştur"}
      description="Yüzdelik indirimler tanımlayın ve ürün, set veya kategorilere atayın."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
            disabled={submitting}
          >
            İptal
          </button>
          <button
            type="submit"
            form="discount-form"
            className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            disabled={submitting}
          >
            {isEditing ? "Değişiklikleri Kaydet" : "İndirim Oluştur"}
          </button>
        </>
      }
    >
      <form id="discount-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <AlertBanner
            variant="danger"
            message={error}
            onClose={() => setError("")}
          />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              İsim
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="Yaz indirimi"
              disabled={submitting}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              Yüzde
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2">
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={percentage}
                onChange={(event) => setPercentage(event.target.value)}
                className="w-full border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none"
                placeholder="15"
                disabled={submitting}
              />
              <span className="text-sm text-[var(--color-text-admin-muted)]">
                %
              </span>
            </div>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
            Açıklama{" "}
            <span className="text-[var(--color-text-admin-muted)]">
              (isteğe bağlı)
            </span>
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
            placeholder="Yalnızca personele görünür"
            disabled={submitting}
          />
        </label>

        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-4 py-3">
          <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-admin)]">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border-admin)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              disabled={submitting}
            />
            Hemen aktif et
          </label>
          {coverageHint && (
            <span className="text-xs text-[var(--color-text-admin-muted)]">
              Hedefler: {coverageHint}
            </span>
          )}
        </div>

        <EntityPicker
          label="Ürünler"
          options={productOptions}
          value={selectedProducts}
          onChange={setSelectedProducts}
          placeholder="Ürün adıyla ara"
          helper="İndirim doğrudan seçili ürünlere uygulanır."
          disabled={submitting}
        />

        <EntityPicker
          label="Setler"
          options={setOptions}
          value={selectedSets}
          onChange={setSelectedSets}
          placeholder="Setleri ara"
          helper="İndirim seçilen setlerin tamamına uygulanır."
          disabled={submitting}
        />

        <EntityPicker
          label="Kategoriler"
          options={categoryOptions}
          value={selectedCategories}
          onChange={setSelectedCategories}
          placeholder="Kategorileri ara"
          helper="Seçili kategoriler ve alt kategorilerindeki tüm ürünleri kapsar."
          disabled={submitting}
        />

        {conflict && (
          <div className="space-y-3">
            <AlertBanner
              variant="warning"
              title="Çakışan indirimler tespit edildi"
              message={
                conflict.message ||
                "Seçilen hedeflerde zaten indirim bulunuyor."
              }
            />
            <div className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-4 py-3 text-sm">
              <p className="mb-2 font-medium text-[var(--color-text-admin)]">
                Etkilenen indirimler
              </p>
              <ul className="space-y-2">
                {conflict.conflicts.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-lg bg-[var(--color-bg-hover)] px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--color-text-admin)]">
                          {entry.name || "İsimsiz indirim"}
                        </p>
                        <p className="text-xs text-[var(--color-text-admin-muted)]">
                          %{entry.percentage} indirim
                        </p>
                      </div>
                      <div className="text-xs text-[var(--color-text-admin-muted)] text-right">
                        {entry.productIds?.length
                          ? `${entry.productIds.length} ürün`
                          : null}
                        {entry.setIds?.length
                          ? `${entry.productIds?.length ? " • " : ""}${
                              entry.setIds.length
                            } set`
                          : null}
                        {entry.categoryIds?.length
                          ? `${
                              entry.productIds?.length || entry.setIds?.length
                                ? " • "
                                : ""
                            }${entry.categoryIds.length} kategori`
                          : null}
                      </div>
                    </div>
                    {(entry.productIds?.length ||
                      entry.setIds?.length ||
                      entry.categoryIds?.length) && (
                      <ul className="mt-2 space-y-1 text-xs text-[var(--color-text-admin-muted)]">
                        {entry.productIds?.slice(0, 5).map((id) => (
                          <li key={id}>{productNameMap.get(id) || id}</li>
                        ))}
                        {entry.productIds?.length > 5 && (
                          <li>… {entry.productIds.length - 5} daha</li>
                        )}
                        {entry.setIds?.slice(0, 5).map((id) => (
                          <li key={id}>{setNameMap.get(id) || id}</li>
                        ))}
                        {entry.setIds?.length > 5 && (
                          <li>… {entry.setIds.length - 5} daha</li>
                        )}
                        {entry.categoryIds?.slice(0, 5).map((id) => (
                          <li key={id}>{categoryNameMap.get(id) || id}</li>
                        ))}
                        {entry.categoryIds?.length > 5 && (
                          <li>… {entry.categoryIds.length - 5} daha</li>
                        )}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onResolveConflict?.("overwrite")}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
                disabled={submitting}
              >
                Mevcut olanın üzerine yaz
              </button>
              <button
                type="button"
                onClick={() => onResolveConflict?.("skip")}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
                disabled={submitting}
              >
                Yalnızca çakışmayanlara uygula
              </button>
              <button
                type="button"
                onClick={() => onResolveConflict?.("cancel")}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
                disabled={submitting}
              >
                İşlemi iptal et
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-dashed border-[var(--color-border-admin)] px-4 py-3 text-xs text-[var(--color-text-admin-muted)]">
          <p>
            Fiyat önizleme örneği: {currency.format(120)} →{" "}
            {percentage
              ? currency.format(
                  Math.max(0, 120 - (120 * Number(percentage || 0)) / 100)
                )
              : currency.format(120)}
          </p>
        </div>
      </form>
    </AdminModal>
  );
}

function normalizeId(value) {
  if (!value) return null;
  try {
    return String(value).trim();
  } catch {
    return null;
  }
}
