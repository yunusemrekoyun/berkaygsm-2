import { useEffect, useRef, useState } from "react";
import {
  TrendingUp,
  X,
  Search,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { productApi } from "../../../api/products";

const SCOPE_OPTIONS = [
  { value: "all", label: "Tüm ürünler" },
  { value: "category", label: "Kategoriye göre" },
  { value: "product", label: "Belirli ürünler" },
];

const ADJUST_OPTIONS = [
  { value: "percent", label: "Yüzdelik (%)" },
  { value: "fixed", label: "Sabit tutar (₺)" },
];

export default function BulkPriceModal({ open, onClose, onSuccess, categories = [] }) {
  const [scope, setScope] = useState("all");
  const [adjustType, setAdjustType] = useState("percent");
  const [value, setValue] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [catDropOpen, setCatDropOpen] = useState(false);

  const searchRef = useRef(null);
  const catDropRef = useRef(null);
  const debounceRef = useRef(null);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setScope("all");
      setAdjustType("percent");
      setValue("");
      setSelectedCategories([]);
      setSelectedProducts([]);
      setProductSearch("");
      setProductResults([]);
      setError(null);
      setSuccess(null);
      setCatDropOpen(false);
    }
  }, [open]);

  // Close category dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (catDropRef.current && !catDropRef.current.contains(e.target)) {
        setCatDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced product search
  useEffect(() => {
    if (scope !== "product") return;
    clearTimeout(debounceRef.current);
    const q = productSearch.trim();
    if (!q) {
      setProductResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await productApi.list({ search: q, limit: 12, page: 1, includeHidden: true }, "tr");
        const results = (data.products || []).map((p) => ({
          id: p.id || String(p._id),
          name: p.name,
          price: p.price,
          slug: p.slug,
        }));
        setProductResults(results);
      } catch {
        setProductResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [productSearch, scope]);

  const toggleCategory = (catId) => {
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const addProduct = (product) => {
    setSelectedProducts((prev) => {
      if (prev.find((p) => p.id === product.id)) return prev;
      return [...prev, product];
    });
    setProductSearch("");
    setProductResults([]);
    searchRef.current?.focus();
  };

  const removeProduct = (productId) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const numValue = Number(value);
  const isValidValue = Number.isFinite(numValue) && numValue > 0;

  const scopeReady =
    scope === "all"
      ? true
      : scope === "category"
      ? selectedCategories.length > 0
      : selectedProducts.length > 0;

  const canSubmit = isValidValue && scopeReady && !submitting;

  const previewText = () => {
    if (!isValidValue) return null;
    const amount =
      adjustType === "percent"
        ? `%${numValue}`
        : `₺${Number(numValue).toFixed(2)}`;
    const target =
      scope === "all"
        ? "tüm ürünlere"
        : scope === "category"
        ? `${selectedCategories.length} kategorideki ürünlere`
        : `${selectedProducts.length} ürüne`;
    return `${target} ${amount} zam uygulanacak`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        scope,
        adjustType,
        value: numValue,
        categoryIds: scope === "category" ? selectedCategories : undefined,
        productIds: scope === "product" ? selectedProducts.map((p) => p.id) : undefined,
      };
      const result = await productApi.bulkUpdatePrice(payload);
      setSuccess(result.message || `${result.updated} ürün güncellendi`);
      onSuccess?.();
    } catch (err) {
      let msg = "Zam uygulanamadı";
      try {
        const parsed = JSON.parse(err.message);
        if (parsed?.message) msg = parsed.message;
      } catch {
        if (err?.message) msg = err.message;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-3 py-4 sm:px-4">
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-2xl"
        style={{ maxHeight: "90dvh" }}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border-admin)] px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[var(--color-text-admin)]">
              Toplu Zam Uygula
            </h2>
            <p className="truncate text-xs text-[var(--color-text-admin-muted)]">
              Seçili ürünlerin fiyatlarını güncelle
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-text-admin-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-admin)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="text-sm font-medium text-[var(--color-text-admin)]">
                {success}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
              >
                Kapat
              </button>
            </div>
          ) : (
            <form id="bulk-price-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Scope */}
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
                  Kapsam
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {SCOPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setScope(opt.value);
                        setSelectedCategories([]);
                        setSelectedProducts([]);
                        setProductSearch("");
                        setProductResults([]);
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                        scope === opt.value
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                          : "border-[var(--color-border-admin)] text-[var(--color-text-admin-muted)] hover:bg-[var(--color-bg-hover)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Category multi-select */}
              {scope === "category" && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
                    Kategoriler
                  </span>
                  <div ref={catDropRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setCatDropOpen((v) => !v)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
                    >
                      <span className="truncate text-left">
                        {selectedCategories.length === 0
                          ? "Kategori seçin..."
                          : `${selectedCategories.length} kategori seçildi`}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[var(--color-text-admin-muted)] transition-transform ${catDropOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {catDropOpen && (
                      <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-lg">
                        {categories.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-[var(--color-text-admin-muted)]">
                            Kategori bulunamadı
                          </p>
                        ) : (
                          categories.map((cat) => {
                            const checked = selectedCategories.includes(cat.id);
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => toggleCategory(cat.id)}
                                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-bg-hover)] ${
                                  checked ? "text-[var(--color-accent)]" : "text-[var(--color-text-admin)]"
                                }`}
                              >
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    checked
                                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                                      : "border-[var(--color-border-admin)]"
                                  }`}
                                >
                                  {checked && (
                                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </span>
                                <span
                                  className="truncate"
                                  style={{ paddingLeft: `${(cat.level ?? 0) * 12}px` }}
                                >
                                  {cat.label}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                  {/* Selected category chips */}
                  {selectedCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCategories.map((catId) => {
                        const cat = categories.find((c) => c.id === catId);
                        return (
                          <span
                            key={catId}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-accent)]"
                          >
                            {cat?.label || catId}
                            <button
                              type="button"
                              onClick={() => toggleCategory(catId)}
                              className="ml-0.5 rounded-full hover:text-red-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Product search */}
              {scope === "product" && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
                    Ürünler
                  </span>
                  {/* Selected product chips */}
                  {selectedProducts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProducts.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-accent)]"
                        >
                          <span className="max-w-[120px] truncate">{p.name}</span>
                          <button
                            type="button"
                            onClick={() => removeProduct(p.id)}
                            className="ml-0.5 rounded-full hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Search input */}
                  <div className="relative">
                    <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5 focus-within:border-[var(--color-accent)]">
                      <Search className="h-4 w-4 shrink-0 text-[var(--color-text-admin-muted)]" />
                      <input
                        ref={searchRef}
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Ürün ara ve ekle..."
                        className="w-full border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none placeholder:text-[var(--color-text-admin-muted)]"
                      />
                      {searching && (
                        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
                      )}
                    </div>
                    {productResults.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-lg">
                        {productResults.map((p) => {
                          const alreadySelected = selectedProducts.some((s) => s.id === p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={alreadySelected}
                              onClick={() => addProduct(p)}
                              className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-bg-hover)] ${
                                alreadySelected
                                  ? "cursor-default opacity-50"
                                  : "text-[var(--color-text-admin)]"
                              }`}
                            >
                              <span className="min-w-0 truncate font-medium">{p.name}</span>
                              <span className="shrink-0 text-xs text-[var(--color-text-admin-muted)]">
                                ₺{Number(p.price ?? 0).toFixed(2)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Adjust type + value */}
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
                  Zam türü ve değer
                </span>
                <div className="flex gap-2">
                  {ADJUST_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAdjustType(opt.value)}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                        adjustType === opt.value
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                          : "border-[var(--color-border-admin)] text-[var(--color-text-admin-muted)] hover:bg-[var(--color-bg-hover)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center overflow-hidden rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] focus-within:border-[var(--color-accent)]">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={adjustType === "percent" ? "Örn: 15" : "Örn: 50.00"}
                    className="w-full border-0 bg-transparent px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none placeholder:text-[var(--color-text-admin-muted)]"
                  />
                  <span className="shrink-0 border-l border-[var(--color-border-admin)] bg-[var(--color-bg-hover)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-admin-muted)]">
                    {adjustType === "percent" ? "%" : "₺"}
                  </span>
                </div>
              </div>

              {/* Preview */}
              {previewText() && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-xs leading-relaxed text-amber-800">
                    <span className="font-semibold capitalize">{previewText()}</span>
                    . Bu işlem geri alınamaz.
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700">
                  {error}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <footer className="flex shrink-0 flex-col gap-2 border-t border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="order-2 inline-flex items-center justify-center rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60 sm:order-1"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              form="bulk-price-form"
              disabled={!canSubmit}
              className="order-1 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50 sm:order-2"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Uygulanıyor...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4" />
                  Zam Uygula
                </>
              )}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
