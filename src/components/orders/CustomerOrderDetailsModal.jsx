import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CreditCard,
  MapPin,
  Package2,
  ReceiptText,
  TicketPercent,
  X,
} from "lucide-react";
import { orderApi } from "../../api/orders";
import AppImage from "../ui/AppImage.jsx";
import {
  OFFICIAL_PHONE,
  OFFICIAL_SUPPORT_EMAIL,
} from "../../config/siteContact.js";
import { formatPaymentMethodLabel } from "../../utils/paymentLabels.js";

const ORDER_STATUS_META = {
  pending: {
    label: "Beklemede",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    panel: "from-amber-50 via-white to-white",
  },
  paid: {
    label: "Ödeme alındı",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    panel: "from-emerald-50 via-white to-white",
  },
  shipped: {
    label: "Kargoda",
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    panel: "from-sky-50 via-white to-white",
  },
  completed: {
    label: "Tamamlandı",
    badge: "bg-slate-900 text-white ring-slate-700",
    panel: "from-slate-100 via-white to-white",
  },
  cancelled: {
    label: "İptal edildi",
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    panel: "from-rose-50 via-white to-white",
  },
};

const PAYMENT_STATUS_LABELS = {
  success: "Başarılı",
  pending: "Beklemede",
  failed: "Başarısız",
  refunded: "İade edildi",
};

const PAYMENT_METHOD_LABELS = {
  online: "Online Ödeme",
  cod: "Kapıda Ödeme",
  card: "Kredi Kartı",
};

function money(value) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(Number(value || 0));
  } catch {
    return `₺${Number(value || 0).toFixed(2)}`;
  }
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function paymentLabel(order) {
  const methodKey = String(order?.payment?.method || "").trim().toLowerCase();
  const method =
    PAYMENT_METHOD_LABELS[methodKey] || formatPaymentMethodLabel(methodKey);
  const status =
    PAYMENT_STATUS_LABELS[String(order?.payment?.status || "").toLowerCase()] || "";
  return status ? `${method} • ${status}` : method;
}

function getDiscountRows(order) {
  const rows = [];
  const standardDiscountAmount = Number(order?.pricing?.standardDiscountAmount || 0);
  const stackedDiscountAmount = Number(order?.pricing?.stackedDiscountAmount || 0);
  const couponDiscountAmount = Number(order?.pricing?.couponDiscountAmount || 0);

  if (standardDiscountAmount > 0) {
    rows.push({
      label: "Kampanya indirimi",
      amount: standardDiscountAmount,
    });
  }
  if (stackedDiscountAmount > 0) {
    rows.push({
      label: "Ek kampanya indirimi",
      amount: stackedDiscountAmount,
    });
  }
  if (couponDiscountAmount > 0) {
    rows.push({
      label: order?.coupon?.code
        ? `Kupon indirimi (${order.coupon.code})`
        : "Kupon indirimi",
      amount: couponDiscountAmount,
    });
  }

  return rows;
}

function totalItemsCount(order) {
  return (order?.items || []).reduce(
    (sum, item) => sum + Math.max(1, Number(item?.qty || 0)),
    0
  );
}

function cls(...values) {
  return values.filter(Boolean).join(" ");
}

function SummaryItem({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cls("text-sm", strong ? "font-semibold text-primary" : "text-secondary")}>
        {label}
      </span>
      <span className={cls("text-sm text-right", strong ? "font-semibold text-primary" : "text-primary")}>
        {value}
      </span>
    </div>
  );
}

export default function CustomerOrderDetailsModal({
  orderId,
  onClose,
  loadOrder = orderApi.get,
}) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) return undefined;
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await loadOrder(orderId);
        if (!mounted) return;
        setOrder(data);
      } catch (err) {
        if (!mounted) return;
        console.error("customer order detail error:", err);
        setError(err?.message || "Sipariş detayları yüklenemedi.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadOrder, orderId]);

  const statusKey = String(order?.status || "pending").toLowerCase();
  const statusMeta = ORDER_STATUS_META[statusKey] || ORDER_STATUS_META.pending;
  const discountRows = useMemo(() => getDiscountRows(order), [order]);
  const address = useMemo(
    () =>
      [
        order?.address?.addressLine,
        order?.address?.district,
        order?.address?.city,
        order?.address?.postalCode,
      ]
        .filter(Boolean)
        .join(", "),
    [order]
  );

  if (!orderId) return null;

  return (
    <div className="fixed inset-0 z-[210]">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]" onClick={onClose} aria-hidden />

      <div className="absolute inset-2 overflow-hidden rounded-[28px] border border-border bg-white shadow-[0_30px_120px_rgba(15,23,42,0.24)] sm:inset-4 lg:inset-8 xl:left-1/2 xl:top-8 xl:bottom-8 xl:w-[min(1080px,calc(100vw-80px))] xl:-translate-x-1/2">
        <div className="flex h-full flex-col">
          <div
            className={cls(
              "shrink-0 border-b border-border bg-gradient-to-br px-5 py-5 sm:px-7 sm:py-6",
              statusMeta.panel
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
                  Sipariş Detayı
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-primary sm:text-[2rem]">
                  Sipariş #{order?.orderNumber || orderId}
                </h2>
                {!loading && !error ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-secondary">
                    <span
                      className={cls(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                        statusMeta.badge
                      )}
                    >
                      {statusMeta.label}
                    </span>
                    <span>•</span>
                    <span>{paymentLabel(order)}</span>
                    <span>•</span>
                    <span>{formatDate(order?.createdAt)}</span>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-white/70 text-secondary transition hover:border-accent/35 hover:text-accent"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-5 py-5 sm:px-7 sm:py-6">
            {loading ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_320px]">
                <div className="space-y-5">
                  <div className="h-44 animate-pulse rounded-[26px] bg-surface" />
                  <div className="h-[360px] animate-pulse rounded-[26px] bg-surface" />
                </div>
                <div className="space-y-5">
                  <div className="h-56 animate-pulse rounded-[26px] bg-surface" />
                  <div className="h-48 animate-pulse rounded-[26px] bg-surface" />
                </div>
              </div>
            ) : error ? (
              <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-8 text-center text-rose-700">
                {error}
              </div>
            ) : !order ? (
              <div className="rounded-[24px] border border-border bg-surface px-5 py-8 text-center text-secondary">
                Sipariş bulunamadı.
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_320px]">
                <div className="space-y-5">
                  <section className="glass-surface-soft rounded-[26px] border border-border bg-white p-5 sm:p-6">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-[22px] border border-border/80 bg-surface-light/80 p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-secondary/80">
                          <Package2 className="h-4 w-4 text-accent" />
                          Ürün Adedi
                        </div>
                        <div className="mt-3 text-2xl font-semibold text-primary">
                          {totalItemsCount(order)}
                        </div>
                      </div>
                      <div className="rounded-[22px] border border-border/80 bg-surface-light/80 p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-secondary/80">
                          <ReceiptText className="h-4 w-4 text-accent" />
                          Toplam
                        </div>
                        <div className="mt-3 text-2xl font-semibold text-primary">
                          {money(order?.total)}
                        </div>
                      </div>
                      <div className="rounded-[22px] border border-border/80 bg-surface-light/80 p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-secondary/80">
                          <CreditCard className="h-4 w-4 text-accent" />
                          Ödeme
                        </div>
                        <div className="mt-3 text-sm font-semibold leading-6 text-primary">
                          {paymentLabel(order)}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="glass-surface-soft rounded-[26px] border border-border bg-white p-5 sm:p-6">
                    <div className="flex items-center gap-2 text-base font-semibold text-primary">
                      <Package2 className="h-4 w-4 text-accent" />
                      Sipariş İçeriği
                    </div>

                    <div className="mt-4 space-y-3">
                      {(order.items || []).map((item, index) => {
                        const variantParts = [
                          item?.variant?.color,
                          item?.variant?.size,
                          item?.variant?.attribute,
                        ].filter(Boolean);
                        const itemTotal = Number(item?.unitPrice || 0) * Number(item?.qty || 1);

                        return (
                          <article
                            key={`${item.ref || item.name || "item"}-${index}`}
                            className="flex gap-4 rounded-[22px] border border-border/70 bg-white p-4"
                          >
                            <div className="h-18 w-18 shrink-0 overflow-hidden rounded-[18px] border border-border/70 bg-surface-light">
                              {item?.image ? (
                                <AppImage
                                  src={item.image}
                                  alt={item.name || "Ürün"}
                                  width={160}
                                  height={160}
                                  sizes="72px"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-secondary">
                                  <Package2 className="h-5 w-5" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-primary">
                                    {item?.name || "Ürün"}
                                  </div>
                                  {variantParts.length ? (
                                    <div className="mt-1 text-xs leading-5 text-secondary">
                                      {variantParts.join(" / ")}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="text-left sm:text-right">
                                  <div className="text-sm font-semibold text-primary">
                                    {money(itemTotal)}
                                  </div>
                                  <div className="mt-1 text-xs text-secondary">
                                    {money(item?.unitPrice)} × {item?.qty || 1}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>

                  {order?.note ? (
                    <section className="glass-surface-soft rounded-[26px] border border-border bg-white p-5 sm:p-6">
                      <div className="flex items-center gap-2 text-base font-semibold text-primary">
                        <TicketPercent className="h-4 w-4 text-accent" />
                        Sipariş Notunuz
                      </div>
                      <p className="mt-3 text-sm leading-7 text-secondary">
                        {order.note}
                      </p>
                    </section>
                  ) : null}
                </div>

                <aside className="space-y-5">
                  <section className="glass-surface-soft rounded-[26px] border border-border bg-white p-5 sm:p-6">
                    <div className="flex items-center gap-2 text-base font-semibold text-primary">
                      <ReceiptText className="h-4 w-4 text-accent" />
                      Tutar Özeti
                    </div>

                    <div className="mt-4 space-y-3">
                      <SummaryItem label="Ara toplam" value={money(order?.subtotal)} />
                      <SummaryItem
                        label={order?.shippingName || "Kargo"}
                        value={money(order?.shipping)}
                      />
                      {discountRows.length ? (
                        <div className="rounded-[20px] border border-border/70 bg-surface-light/70 p-4">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-secondary/80">
                            Kampanya ve İndirimler
                          </div>
                          <div className="space-y-2">
                            {discountRows.map((row) => (
                              <SummaryItem
                                key={row.label}
                                label={row.label}
                                value={`-${money(row.amount)}`}
                              />
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="border-t border-border/70 pt-3">
                        <SummaryItem label="Genel toplam" value={money(order?.total)} strong />
                      </div>
                    </div>
                  </section>

                  <section className="glass-surface-soft rounded-[26px] border border-border bg-white p-5 sm:p-6">
                    <div className="flex items-center gap-2 text-base font-semibold text-primary">
                      <MapPin className="h-4 w-4 text-accent" />
                      Teslimat Bilgisi
                    </div>

                    <div className="mt-4 space-y-3 text-sm text-secondary">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-secondary/75">
                          Alıcı
                        </div>
                        <div className="mt-1 font-medium text-primary">
                          {order?.address?.fullName || "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-secondary/75">
                          Telefon
                        </div>
                        <div className="mt-1 font-medium text-primary">
                          {order?.address?.phone || "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-secondary/75">
                          Adres
                        </div>
                        <div className="mt-1 font-medium leading-6 text-primary">
                          {address || "-"}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="glass-surface-soft rounded-[26px] border border-border bg-white p-5 sm:p-6">
                    <div className="flex items-center gap-2 text-base font-semibold text-primary">
                      <BadgeCheck className="h-4 w-4 text-accent" />
                      Destek
                    </div>
                    <div className="mt-4 space-y-2 text-sm leading-6 text-secondary">
                      <p>Siparişinizle ilgili bir sorunuz olursa bizimle doğrudan iletişime geçebilirsiniz.</p>
                      <p>
                        <strong className="text-primary">E-posta:</strong>{" "}
                        <a
                          href={`mailto:${OFFICIAL_SUPPORT_EMAIL}`}
                          className="text-accent underline"
                        >
                          {OFFICIAL_SUPPORT_EMAIL}
                        </a>
                      </p>
                      <p>
                        <strong className="text-primary">Telefon:</strong>{" "}
                        <a href={`tel:${OFFICIAL_PHONE}`} className="text-accent underline">
                          {OFFICIAL_PHONE}
                        </a>
                      </p>
                    </div>
                  </section>
                </aside>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
