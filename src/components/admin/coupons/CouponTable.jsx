import { Pencil, Trash2, Power } from "lucide-react";

const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 0,
});

export default function CouponTable({
  coupons = [],
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

  if (!coupons.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-12 text-center text-[var(--color-text-admin-muted)]">
        Henüz kupon yok. İlk kuponunuzu oluşturun.
      </div>
    );
  }

  return (
    <div className="admin-table-container overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]">
      <table className="admin-table min-w-full divide-y divide-[var(--color-border-admin)]/80">
        <thead className="bg-[var(--color-bg-hover)]/60">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Kod
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Yüzde
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Minimum Sepet Tutarı
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
          {coupons.map((coupon) => (
            <tr key={coupon.id}>
              <td className="px-4 py-4 align-top" data-label="Kod">
                <div className="space-y-1">
                  <p className="font-semibold tracking-wide text-[var(--color-text-admin)]">
                    {coupon.code}
                  </p>
                  {coupon.description && (
                    <p className="text-xs text-[var(--color-text-admin-muted)]">
                      {coupon.description}
                    </p>
                  )}
                </div>
              </td>
              <td className="px-4 py-4 align-top text-sm text-[var(--color-text-admin)]" data-label="Yüzde">
                {coupon.percentage}%
              </td>
              <td className="px-4 py-4 align-top text-sm text-[var(--color-text-admin)]" data-label="Minimum">
                {coupon.minSubtotal ? currency.format(coupon.minSubtotal) : "—"}
              </td>
              <td className="px-4 py-4 align-top" data-label="Durum">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    coupon.active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-[var(--color-border-admin)]/40 text-[var(--color-text-admin-muted)]"
                  }`}
                >
                  {coupon.active ? "Aktif" : "Pasif"}
                </span>
              </td>
              <td className="px-4 py-4 align-top text-sm text-[var(--color-text-admin-muted)]" data-label="Güncellenme">
                {formatTimestamp(coupon.updatedAt)}
              </td>
              <td className="px-4 py-4 align-top text-left md:text-right" data-label="İşlemler">
                <div className="mobile-full flex flex-col gap-2 md:flex-row md:justify-end">
                  <button
                    type="button"
                    onClick={() => onToggleActive?.(coupon)}
                    className="inline-flex h-9 w-full items-center justify-center rounded-full border border-[var(--color-border-admin)] text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] md:w-9"
                    title={coupon.active ? "Pasifleştir" : "Aktifleştir"}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit?.(coupon)}
                    className="inline-flex h-9 w-full items-center justify-center rounded-full border border-[var(--color-border-admin)] text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] md:w-9"
                    title="Kuponu düzenle"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(coupon)}
                    className="inline-flex h-9 w-full items-center justify-center rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 md:w-9"
                    title="Kuponu sil"
                  >
                    <Trash2 className="h-4 w-4" />
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

function formatTimestamp(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString("tr-TR");
  }
}
