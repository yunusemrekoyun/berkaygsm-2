import { useMemo, useState } from "react";
import { Edit3, Trash2, Search, Languages } from "lucide-react";
import { getColorInfo } from "../../../utils/colors.js";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

const INFTY = Number.MAX_SAFE_INTEGER;
const displaySetStock = (stock) =>
  Number.isFinite(stock) ? (stock >= INFTY ? "∞" : String(stock)) : "Varyantlara bağlı";

export default function SetTable({
  sets = [],
  loading = false,
  onEdit,
  onDelete,
  onTranslate,
}) {
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectSet, setInspectSet] = useState(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl bg-[var(--color-bg-hover)]"
          />
        ))}
      </div>
    );
  }

  if (!sets.length) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-6 py-12 text-center">
        <p className="max-w-md text-sm text-[var(--color-text-admin-muted)]">
          Henüz set oluşturulmadı. Seçkili bir paket hazırlamak için “Yeni set”i
          kullanın.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-table-container overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-sm">
        <table className="admin-table min-w-full divide-y divide-[var(--color-border-admin)]/70 text-sm">
          <thead className="bg-[var(--color-bg-hover)]/60 text-[var(--color-text-admin-muted)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Set</th>
              <th className="px-4 py-3 text-left font-medium">Fiyat</th>
              <th className="px-4 py-3 text-left font-medium">Stok</th>
              <th className="px-4 py-3 text-left font-medium">Görünürlük</th>
              <th className="px-4 py-3 text-right font-medium">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-admin)]/60 text-[var(--color-text-admin)]">
            {sets.map((set) => (
              <tr key={set.id} className="hover:bg-[var(--color-bg-hover)]/40">
                <td className="px-4 py-3" data-label="Set">
                  <div className="flex items-center gap-3">
                    {set.images?.[0]?.url ? (
                      <img
                        src={set.images[0].url}
                        alt={set.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-lg bg-[var(--color-bg-hover)] text-[var(--color-text-admin-muted)]">
                        {set.name?.[0] ?? "S"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{set.name}</div>
                      <div className="text-xs text-[var(--color-text-admin-muted)]">
                        {set.products?.length || 0} ürün
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3" data-label="Fiyat">
                  {currency.format(set.price || 0)}
                </td>
                <td className="px-4 py-3" data-label="Stok">
                  <div className="flex items-center gap-2">
                    <span>{displaySetStock(set.stock)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectSet(set);
                        setInspectOpen(true);
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
                      title="Varyant stoklarını incele"
                    >
                      <Search className="h-4 w-4" />
                      İncele
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3" data-label="Görünürlük">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      set.show
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {set.show ? "Görünür" : "Gizli"}
                  </span>
                </td>
                <td className="px-4 py-3 text-left md:text-right" data-label="İşlemler">
                  <div className="mobile-full flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                    <button
                      onClick={() => onTranslate?.(set)}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] md:w-auto"
                    >
                      <Languages className="h-4 w-4" /> Dil varyantı
                    </button>
                    <button
                      onClick={() => onEdit?.(set)}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] md:w-auto"
                    >
                      <Edit3 className="h-4 w-4" /> Düzenle
                    </button>
                    <button
                      onClick={() => onDelete?.(set)}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 md:w-auto"
                    >
                      <Trash2 className="h-4 w-4" /> Sil
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inspectOpen && inspectSet && (
        <StockInspectModal
          setItem={inspectSet}
          onClose={() => {
            setInspectOpen(false);
            setInspectSet(null);
          }}
        />
      )}
    </>
  );
}

/* ------------------------- Inspect Modal ------------------------- */

function StockInspectModal({ setItem, onClose }) {
  // Her ürün için varyantları hazırla
  const rows = useMemo(() => {
    const items = [];
    (setItem.products || []).forEach((sp) => {
      const p = sp.product || {};
      const inv = Array.isArray(p.inventory) ? p.inventory : [];
      if (inv.length === 0) {
        items.push({
          key: `${p.id || p._id || "p"}::default`,
          productName: p.name || "İsimsiz ürün",
          qtyInSet: sp.quantity || 1,
          variant: { color: null, size: null, attributeValue: null },
          stockCatalog: 0,
          stockSet: 0,
          stock: 0,
        });
        return;
      }
      inv.forEach((v, idx) => {
        const stockCatalog = Number.isFinite(v.stockCatalog)
          ? Number(v.stockCatalog)
          : null;
        const stockSet = Number.isFinite(v.stockSet)
          ? Number(v.stockSet)
          : null;
        const legacy = Number.isFinite(v.stock) ? Number(v.stock) : null;

        items.push({
          key: `${p.id || p._id || "p"}::${idx}`,
          productName: p.name || "İsimsiz ürün",
          qtyInSet: sp.quantity || 1,
          variant: {
            color: v.color ?? null,
            size: v.size ?? null,
            attributeValue: v.attributeValue ?? null,
          },
          stockCatalog,
          stockSet,
          stock: legacy,
        });
      });
    });
    return items;
  }, [setItem]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-xl">
        <header className="flex items-center justify-between border-b border-[var(--color-border-admin)] px-5 py-3">
          <div>
            <h3 className="font-semibold text-[var(--color-text-admin)]">
              Stok detayları — {setItem.name}
            </h3>
            <p className="text-xs text-[var(--color-text-admin-muted)]">
              Varyant seviyesinde stok (renk · beden · özellik)
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
          >
            Kapat
          </button>
        </header>

        <div className="max-h-[70vh] overflow-auto p-5">
          <table className="admin-table min-w-full divide-y divide-[var(--color-border-admin)]/70 text-sm">
            <thead className="bg-[var(--color-bg-hover)]/60 text-[var(--color-text-admin-muted)]">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Ürün</th>
                <th className="px-3 py-2 text-left font-medium">Varyant</th>
                <th className="px-3 py-2 text-right font-medium">
                  Set içi adet
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Stok (Katalog)
                </th>
                <th className="px-3 py-2 text-right font-medium">Stok (Set)</th>
                <th className="px-3 py-2 text-right font-medium">
                  Stok (Eski)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-admin)]/60 text-[var(--color-text-admin)]">
              {rows.map((r) => (
                <tr key={r.key} className="hover:bg-[var(--color-bg-hover)]/40">
                  <td className="px-3 py-2" data-label="Ürün">{r.productName}</td>
                  <td className="px-3 py-2" data-label="Varyant">
                    <VariantLabel
                      color={r.variant.color}
                      size={r.variant.size}
                      attributeValue={r.variant.attributeValue}
                    />
                  </td>
                  <td className="px-3 py-2 text-left md:text-right" data-label="Set içi adet">
                    {r.qtyInSet}
                  </td>
                  <td className="px-3 py-2 text-left md:text-right" data-label="Stok (Katalog)">
                    {r.stockCatalog ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-left md:text-right" data-label="Stok (Set)">
                    {r.stockSet ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-left md:text-right" data-label="Stok (Eski)">
                    {r.stock ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* --------------------- Variant label (renkli) --------------------- */

function VariantLabel({ color, size, attributeValue }) {
  const info = getColorInfo(color);
  const parts = [
    info.label || null,
    size || null,
    attributeValue || null,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-2">
      {info.value && (
        <span
          className="inline-block h-4 w-4 rounded-full border border-gray-300"
          style={{ background: info.swatch }}
          aria-hidden="true"
        />
      )}
      <span>{parts.length ? parts.join(" · ") : "Varsayılan"}</span>
    </div>
  );
}
