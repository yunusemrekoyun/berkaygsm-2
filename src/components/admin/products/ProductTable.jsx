import { Edit3, ExternalLink, Languages, Trash2 } from "lucide-react";
import AppImage from "../../ui/AppImage.jsx";

const formatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

export default function ProductTable({
  products = [],
  loading = false,
  onEdit,
  onDelete,
  onTranslate,
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-2xl bg-[var(--color-bg-hover)]"
          />
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-6 py-12 text-center">
        <p className="max-w-sm text-sm text-[var(--color-text-admin-muted)]">
          Henüz ürün yok. Kataloğu doldurmak için ilk ürününü ekle.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-table-container overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-sm">
      <table className="admin-table min-w-full divide-y divide-[var(--color-border-admin)]/70 text-sm">
        <thead className="bg-[var(--color-bg-hover)]/60 text-[var(--color-text-admin-muted)]">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Ürün</th>
            <th className="px-4 py-3 text-left font-medium">Kategori</th>
            <th className="px-4 py-3 text-left font-medium">Fiyat</th>
            <th className="px-4 py-3 text-left font-medium">Setler</th>
            <th className="px-4 py-3 text-left font-medium">Durum</th>
            <th className="px-4 py-3 text-left font-medium">Mağaza</th>
            <th className="px-4 py-3 text-left font-medium">Güncellendi</th>
            <th className="px-4 py-3 text-right font-medium">İşlemler</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-admin)]/60 text-[var(--color-text-admin)]">
          {products.map((product) => (
            <tr
              key={product.id}
              className="hover:bg-[var(--color-bg-hover)]/40"
            >
              <td className="px-4 py-3" data-label="Ürün">
                <div className="flex items-center gap-3">
                  {product.images?.[0]?.url ? (
                    <AppImage
                      src={product.images[0].url}
                      alt={product.name}
                      width={48}
                      height={48}
                      sizes="48px"
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-[var(--color-bg-hover)]" />
                  )}
                  <div>
                    <div className="font-semibold">{product.name}</div>
                    {product.slug && (
                      <div className="text-xs text-[var(--color-text-admin-muted)]">
                        {product.slug}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3" data-label="Kategori">
                <span className="text-sm text-[var(--color-text-admin-muted)]">
                  {product.category?.name || product.category?.label || "—"}
                </span>
              </td>
              <td className="px-4 py-3" data-label="Fiyat">
                {formatter.format(product.price ?? 0)}
              </td>
              <td className="px-4 py-3" data-label="Setler">
                <SetBadge count={product.setsCount} />
              </td>
              <td className="px-4 py-3" data-label="Durum">
                <StatusBadge active={product.isActive} />
              </td>
              <td className="px-4 py-3" data-label="Mağaza">
                {product.isActive && product.slug ? (
                  <a
                    href={`/product/${product.slug}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center justify-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
                  >
                    <ExternalLink className="h-4 w-4" /> Mağazada Gör
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center justify-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin-muted)] opacity-60"
                  >
                    <ExternalLink className="h-4 w-4" /> Mağazada Gör
                  </button>
                )}
              </td>
              <td className="px-4 py-3 text-[var(--color-text-admin-muted)]" data-label="Güncellenme">
                {new Date(
                  product.updatedAt || product.createdAt
                ).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-left md:text-right" data-label="İşlemler">
                <div className="mobile-full flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                  {typeof onTranslate === "function" && (
                    <button
                      onClick={() => onTranslate(product)}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] md:w-auto"
                    >
                      <Languages className="h-4 w-4" /> Dil varyantı
                    </button>
                  )}
                  <button
                    onClick={() => onEdit?.(product)}
                    className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] md:w-auto"
                  >
                    <Edit3 className="h-4 w-4" /> Düzenle
                  </button>
                  <button
                    onClick={() => onDelete?.(product)}
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
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {active ? "Aktif" : "Gizli"}
    </span>
  );
}

function SetBadge({ count }) {
  const numeric = Number(count) || 0;
  const tone =
    numeric > 0
      ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
      : "bg-[var(--color-surface-light)] text-[var(--color-text-admin-muted)] border border-[var(--color-border-admin)]/60";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${tone}`}
    >
      {numeric > 0 ? `${numeric} set` : "Bağlı set yok"}
    </span>
  );
}
