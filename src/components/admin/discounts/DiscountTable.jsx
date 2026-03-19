import { Pencil, Trash2, Power } from "lucide-react";

export default function DiscountTable({
  discounts = [],
  loading = false,
  onEdit,
  onDelete,
  onToggleActive,
}) {
  if (loading) {
    return (
      <div className="space-y-3 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-5">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="h-14 animate-pulse rounded-xl bg-[var(--color-bg-hover)]/70"
          />
        ))}
      </div>
    );
  }

  if (!discounts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-12 text-center text-[var(--color-text-admin-muted)]">
        Henüz tanımlı indirim yok.
      </div>
    );
  }

  return (
    <div className="admin-table-container overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]">
      <table className="admin-table min-w-full divide-y divide-[var(--color-border-admin)]/80">
        <thead className="bg-[var(--color-bg-hover)]/60">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              İndirim
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Yüzde
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Kapsam
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Durum
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Güncellenme
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              İşlemler
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-admin)]/60">
          {discounts.map((discount) => {
            const summaryParts = [];
            const productCount = discount.appliesTo?.products?.length || 0;
            const setCount = discount.appliesTo?.sets?.length || 0;
            const categoryCount = discount.appliesTo?.categories?.length || 0;
            if (productCount) summaryParts.push(`${productCount} ürün`);
            if (setCount) summaryParts.push(`${setCount} set`);
            if (categoryCount) summaryParts.push(`${categoryCount} kategori`);

            const namePreview = buildNamePreview(discount.appliesTo);

            return (
              <tr key={discount.id}>
                <td className="max-w-[280px] px-4 py-4 align-top" data-label="İndirim">
                  <div className="space-y-1">
                    <p className="font-medium text-[var(--color-text-admin)]">
                      {discount.name}
                    </p>
                    {discount.description && (
                      <p className="text-xs text-[var(--color-text-admin-muted)]">
                        {discount.description}
                      </p>
                    )}
                    <p className="text-xs text-[var(--color-text-admin-muted)]">
                      {discount.allowCouponStacking === false
                        ? "Kuponla birikmez"
                        : "Kuponla birlikte uygulanır"}
                    </p>
                    <p className="text-xs text-[var(--color-text-admin-muted)]">
                      {discount.allowStackedDiscountStacking === false
                        ? "Katlananla birikmez"
                        : "Katlananla birlikte uygulanır"}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-4 align-top text-sm text-[var(--color-text-admin)]" data-label="Yüzde">
                  {discount.percentage}%
                </td>
                <td className="px-4 py-4 align-top text-sm text-[var(--color-text-admin)]" data-label="Kapsam">
                  {summaryParts.length ? summaryParts.join(" • ") : "—"}
                  {namePreview && (
                    <p className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
                      {namePreview}
                    </p>
                  )}
                </td>
                <td className="px-4 py-4 align-top" data-label="Durum">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                      discount.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-[var(--color-border-admin)]/40 text-[var(--color-text-admin-muted)]"
                    }`}
                  >
                    {discount.active ? "Aktif" : "Pasif"}
                  </span>
                </td>
                <td className="px-4 py-4 align-top text-sm text-[var(--color-text-admin-muted)]" data-label="Güncellenme">
                  {formatTimestamp(discount.updatedAt)}
                </td>
                <td className="px-4 py-4 align-top text-left md:text-right" data-label="İşlemler">
                  <div className="mobile-full flex flex-col gap-2 md:flex-row md:justify-end">
                    <button
                      type="button"
                      onClick={() => onToggleActive?.(discount)}
                      className="inline-flex h-9 w-full items-center justify-center rounded-full border border-[var(--color-border-admin)] text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] md:w-9"
                      title={discount.active ? "Pasifleştir" : "Aktifleştir"}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit?.(discount)}
                      className="inline-flex h-9 w-full items-center justify-center rounded-full border border-[var(--color-border-admin)] text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] md:w-9"
                      title="İndirimi düzenle"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete?.(discount)}
                      className="inline-flex h-9 w-full items-center justify-center rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 md:w-9"
                      title="İndirimi sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function buildNamePreview(appliesTo = {}) {
  const names = [];
  (appliesTo.products || []).slice(0, 2).forEach((item) => {
    if (!item) return;
    names.push(item.label || item.name || item.slug || item.id);
  });
  (appliesTo.sets || []).slice(0, 2).forEach((item) => {
    if (!item) return;
    names.push(item.label || item.name || item.slug || item.id);
  });
  (appliesTo.categories || []).slice(0, 2).forEach((item) => {
    if (!item) return;
    names.push(item.label || item.name || item.slug || item.id);
  });
  if (!names.length) return "";
  const preview = names.join(", ");
  const totalCount =
    (appliesTo.products?.length || 0) +
    (appliesTo.sets?.length || 0) +
    (appliesTo.categories?.length || 0);
  if (totalCount > names.length) {
    return `${preview}, … ${totalCount - names.length} daha`;
  }
  return preview;
}

function formatTimestamp(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}
