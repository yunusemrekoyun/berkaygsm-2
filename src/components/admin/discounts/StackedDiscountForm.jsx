import { useEffect, useMemo, useState } from "react";
import AdminModal from "../common/AdminModal";
import EntityPicker from "./EntityPicker.jsx";
import AlertBanner from "../../ui/AlertBanner.jsx";

function normalizeId(value) {
  if (!value) return null;
  try {
    return String(value).trim();
  } catch {
    return null;
  }
}

function createNextTier(previousTier = null) {
  const previousQuantity = Number(previousTier?.quantity || 1);
  const previousPercentage = Number(previousTier?.percentage || 0);
  return {
    quantity: previousQuantity + 1,
    percentage: Math.min(100, Math.max(1, previousPercentage + 5)),
  };
}

export default function StackedDiscountForm({
  open,
  onClose,
  onSubmit,
  initialDiscount = null,
  productOptions = [],
  setOptions = [],
  categoryOptions = [],
  submitting = false,
}) {
  const [active, setActive] = useState(false);
  const [allowCouponStacking, setAllowCouponStacking] = useState(true);
  const [allowDiscountStacking, setAllowDiscountStacking] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedSets, setSelectedSets] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [tiers, setTiers] = useState([{ quantity: 2, percentage: 5 }]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setActive(initialDiscount?.active ?? false);
    setAllowCouponStacking(initialDiscount?.allowCouponStacking ?? true);
    setAllowDiscountStacking(initialDiscount?.allowDiscountStacking ?? true);

    const mapInitial = (items = [], options = []) => {
      const optionMap = new Map(options.map((opt) => [opt.id, opt]));
      return items.map((item) => {
        const match = optionMap.get(item.id || item);
        return (
          match || {
            id: item.id || item,
            label: item.name || item.slug || String(item.id || item),
          }
        );
      });
    };

    setSelectedProducts(
      mapInitial(initialDiscount?.targets?.products, productOptions)
    );
    setSelectedSets(mapInitial(initialDiscount?.targets?.sets, setOptions));
    setSelectedCategories(
      mapInitial(initialDiscount?.targets?.categories, categoryOptions)
    );
    setTiers(
      Array.isArray(initialDiscount?.tiers) && initialDiscount.tiers.length
        ? initialDiscount.tiers.map((tier) => ({
            quantity: Number(tier.quantity || 0),
            percentage: Number(tier.percentage || 0),
          }))
        : [{ quantity: 2, percentage: 5 }]
    );
    setError("");
  }, [open, initialDiscount, productOptions, setOptions, categoryOptions]);

  const coverageHint = useMemo(() => {
    const parts = [];
    if (selectedProducts.length) parts.push(`${selectedProducts.length} ürün`);
    if (selectedSets.length) parts.push(`${selectedSets.length} set`);
    if (selectedCategories.length) parts.push(`${selectedCategories.length} kategori`);
    return parts.join(" • ");
  }, [selectedCategories.length, selectedProducts.length, selectedSets.length]);

  const handleTierChange = (index, field, value) => {
    setTiers((prev) =>
      prev.map((tier, tierIndex) =>
        tierIndex === index
          ? {
              ...tier,
              [field]: value,
            }
          : tier
      )
    );
  };

  const handleAddTier = () => {
    setTiers((prev) => [...prev, createNextTier(prev[prev.length - 1])]);
  };

  const handleRemoveTier = (index) => {
    setTiers((prev) => prev.filter((_, tierIndex) => tierIndex !== index));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting) return;

    if (
      selectedProducts.length === 0 &&
      selectedSets.length === 0 &&
      selectedCategories.length === 0
    ) {
      setError("En az bir ürün, set veya kategori seçin");
      return;
    }

    const normalizedTiers = tiers
      .map((tier) => ({
        quantity: Math.floor(Number(tier.quantity || 0)),
        percentage: Number(tier.percentage || 0),
      }))
      .sort((left, right) => left.quantity - right.quantity);

    if (!normalizedTiers.length) {
      setError("En az bir kademe girin");
      return;
    }

    for (let index = 0; index < normalizedTiers.length; index += 1) {
      const current = normalizedTiers[index];
      const previous = normalizedTiers[index - 1];
      if (!Number.isFinite(current.quantity) || current.quantity < 2) {
        setError("Katlanan indirim için ilk kademe en az 2 üründen başlamalı");
        return;
      }
      if (
        !Number.isFinite(current.percentage) ||
        current.percentage <= 0 ||
        current.percentage > 100
      ) {
        setError("Kademe yüzdeleri 1 ile 100 arasında olmalı");
        return;
      }
      if (!previous) continue;
      if (current.quantity === previous.quantity) {
        setError("Aynı ürün adedi için tekrar kademe eklenemez");
        return;
      }
      if (current.percentage <= previous.percentage) {
        setError("Katlanan indirim yüzdeleri artarak ilerlemeli");
        return;
      }
    }

    setError("");
    onSubmit?.({
      active,
      allowCouponStacking,
      allowDiscountStacking,
      products: selectedProducts.map((item) => normalizeId(item.id)).filter(Boolean),
      sets: selectedSets.map((item) => normalizeId(item.id)).filter(Boolean),
      categories: selectedCategories
        .map((item) => normalizeId(item.id))
        .filter(Boolean),
      tiers: normalizedTiers,
    });
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Katlanan İndirim"
      description="Tek bir global katlanan indirim kuralı tanımlayın."
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
            form="stacked-discount-form"
            className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            disabled={submitting}
          >
            Kaydet
          </button>
        </>
      }
    >
      <form
        id="stacked-discount-form"
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {error && (
          <AlertBanner
            variant="danger"
            message={error}
            onClose={() => setError("")}
          />
        )}

        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-4 py-3">
          <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-admin)]">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border-admin)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              disabled={submitting}
            />
            Kural aktif
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-admin)]">
            <input
              type="checkbox"
              checked={allowCouponStacking}
              onChange={(event) => setAllowCouponStacking(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border-admin)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              disabled={submitting}
            />
            Kuponlarla birlikte uygulanabilir
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-admin)]">
            <input
              type="checkbox"
              checked={allowDiscountStacking}
              onChange={(event) => setAllowDiscountStacking(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border-admin)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              disabled={submitting}
            />
            Normal indirimlerle birlikte uygulanabilir
          </label>
          {coverageHint && (
            <span className="text-xs text-[var(--color-text-admin-muted)]">
              Hedefler: {coverageHint}
            </span>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-admin)]">
                Katmanlar
              </p>
              <p className="text-xs text-[var(--color-text-admin-muted)]">
                Ürün adedi arttıkça uygulanacak indirim basamaklarını tanımlayın.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddTier}
              className="rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
              disabled={submitting}
            >
              + Kademe ekle
            </button>
          </div>

          <div className="space-y-3">
            {tiers.map((tier, index) => (
              <div
                key={`${index}-${tier.quantity}-${tier.percentage}`}
                className="grid gap-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/30 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                    Adet
                  </span>
                  <input
                    type="number"
                    min="2"
                    step="1"
                    value={tier.quantity}
                    onChange={(event) =>
                      handleTierChange(index, "quantity", event.target.value)
                    }
                    className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none"
                    disabled={submitting}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                    İndirim yüzdesi
                  </span>
                  <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="0.01"
                      value={tier.percentage}
                      onChange={(event) =>
                        handleTierChange(index, "percentage", event.target.value)
                      }
                      className="w-full border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none"
                      disabled={submitting}
                    />
                    <span className="text-sm text-[var(--color-text-admin-muted)]">
                      %
                    </span>
                  </div>
                </label>
                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveTier(index)}
                    className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                    disabled={submitting || tiers.length <= 1}
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <EntityPicker
          label="Ürünler"
          options={productOptions}
          value={selectedProducts}
          onChange={setSelectedProducts}
          placeholder="Ürün adıyla ara"
          helper="Seçili ürünler katlanan indirim grubuna dahil edilir."
          disabled={submitting}
        />

        <EntityPicker
          label="Setler"
          options={setOptions}
          value={selectedSets}
          onChange={setSelectedSets}
          placeholder="Setleri ara"
          helper="Her set bir ürün adedi gibi sayılır."
          disabled={submitting}
        />

        <EntityPicker
          label="Kategoriler"
          options={categoryOptions}
          value={selectedCategories}
          onChange={setSelectedCategories}
          placeholder="Kategorileri ara"
          helper="Seçili kategoriler ve alt kategorileri kapsar."
          disabled={submitting}
        />
      </form>
    </AdminModal>
  );
}

