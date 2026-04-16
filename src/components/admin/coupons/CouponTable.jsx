import { Pencil, Power, Trash2 } from "lucide-react";

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
            className="h-16 animate-pulse rounded-xl bg-[var(--color-bg-hover)]/70"
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
    <div className="admin-table-container overflow-x-auto rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]">
      <table className="admin-table min-w-full divide-y divide-[var(--color-border-admin)]/80">
        <thead className="bg-[var(--color-bg-hover)]/60">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Kupon
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Kural
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Hedef
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Kullanım
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Durum
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              İşlemler
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-admin)]/60">
          {coupons.map((coupon) => (
            <tr key={coupon.id}>
              <td className="max-w-[300px] px-4 py-4 align-top" data-label="Kupon">
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--color-text-admin)]">
                    {coupon.code || "Kişiye özel kod"}
                  </p>
                  <p className="text-xs text-[var(--color-text-admin-muted)]">
                    {templateLabel(coupon.template)} •{" "}
                    {coupon.audience === "personal" ? "Kişiye özel" : "Herkese açık"}
                  </p>
                  {coupon.description && (
                    <p className="text-xs text-[var(--color-text-admin-muted)]">
                      {coupon.description}
                    </p>
                  )}
                </div>
              </td>

              <td className="px-4 py-4 align-top text-sm text-[var(--color-text-admin)]" data-label="Kural">
                <div className="space-y-1">
                  <p>%{Number(coupon.percentage || 0)} indirim</p>
                  <p className="text-xs text-[var(--color-text-admin-muted)]">
                    Min:{" "}
                    {Number(coupon.minSubtotal || 0) > 0
                      ? currency.format(Number(coupon.minSubtotal || 0))
                      : "Yok"}
                  </p>
                  {coupon.winbackDays ? (
                    <p className="text-xs text-[var(--color-text-admin-muted)]">
                      {coupon.winbackDays} gün sipariş vermeyen
                    </p>
                  ) : null}
                  {coupon.firstPurchaseOnly ? (
                    <p className="text-xs text-[var(--color-text-admin-muted)]">
                      Sadece ilk sipariş
                    </p>
                  ) : null}
                </div>
              </td>

              <td className="px-4 py-4 align-top text-sm text-[var(--color-text-admin)]" data-label="Hedef">
                <div className="space-y-1">
                  <p>
                    {(coupon.targets?.products?.length || 0) +
                      (coupon.targets?.sets?.length || 0) +
                      (coupon.targets?.categories?.length || 0) >
                    0
                      ? buildTargetSummary(coupon.targets)
                      : "Tüm sepet"}
                  </p>
                  {coupon.audience === "personal" && (
                    <p className="text-xs text-[var(--color-text-admin-muted)]">
                      Atama:{" "}
                      {coupon.assignmentMode === "manual"
                        ? "Manuel kullanıcılar"
                        : "Herkese"}
                    </p>
                  )}
                </div>
              </td>

              <td className="px-4 py-4 align-top text-sm text-[var(--color-text-admin)]" data-label="Kullanım">
                <div className="space-y-1">
                  <p>
                    Toplam: {Number(coupon.totalUses || 0)}
                    {coupon.maxTotalUses
                      ? ` / ${Number(coupon.maxTotalUses)}`
                      : " / limitsiz"}
                  </p>
                  <p className="text-xs text-[var(--color-text-admin-muted)]">
                    Kullanıcı başı: {Number(coupon.maxUsesPerUser || 1)}
                  </p>
                  {coupon.audience === "personal" && (
                    <p className="text-xs text-[var(--color-text-admin-muted)]">
                      Atanan: {Number(coupon.assignmentStats?.total || 0)} •
                      Kullanan: {Number(coupon.redemptionStats?.users || 0)}
                    </p>
                  )}
                </div>
              </td>

              <td className="px-4 py-4 align-top" data-label="Durum">
                <div className="space-y-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                      coupon.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-[var(--color-border-admin)]/40 text-[var(--color-text-admin-muted)]"
                    }`}
                  >
                    {coupon.active ? "Aktif" : "Pasif"}
                  </span>
                  <p className="text-xs text-[var(--color-text-admin-muted)]">
                    {formatDateRange(coupon.startsAt, coupon.endsAt)}
                  </p>
                </div>
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

function templateLabel(template) {
  switch (template) {
    case "first_purchase":
      return "İlk alışveriş";
    case "cart_threshold":
      return "Sepet eşiği";
    case "category_specific":
      return "Kategori özel";
    case "winback":
      return "Geri kazanım";
    case "manual":
      return "Manuel";
    default:
      return "Tanımsız";
  }
}

function buildTargetSummary(targets = {}) {
  const productCount = targets?.products?.length || 0;
  const setCount = targets?.sets?.length || 0;
  const categoryCount = targets?.categories?.length || 0;
  const parts = [];
  if (productCount) parts.push(`${productCount} ürün`);
  if (setCount) parts.push(`${setCount} set`);
  if (categoryCount) parts.push(`${categoryCount} kategori`);
  return parts.join(" • ");
}

function formatDateRange(startsAt, endsAt) {
  if (!startsAt && !endsAt) return "Süresiz";
  const startText = startsAt ? formatDate(startsAt) : "Hemen";
  const endText = endsAt ? formatDate(endsAt) : "Süresiz";
  return `${startText} - ${endText}`;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}
