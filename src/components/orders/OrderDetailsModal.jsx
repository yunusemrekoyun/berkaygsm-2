// src/components/orders/OrderDetailsModal.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { orderApi } from "../../api/orders";
import AppImage from "../ui/AppImage.jsx";

/** Küçük yardımcılar */
function money(v) {
  const n = Number(v || 0);
  return `₺${n.toFixed(2)}`;
}
function cls(...a) {
  return a.filter(Boolean).join(" ");
}
function badgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (["paid", "completed", "delivered"].includes(s))
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["processing", "created", "pending"].includes(s))
    return "bg-amber-50 text-amber-700 ring-amber-200";
  if (["cancelled", "refunded", "failed"].includes(s))
    return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-surface text-secondary ring-border";
}

const STATUS_LABELS = {
  created: "Oluşturuldu",
  pending: "Beklemede",
  paid: "Ödendi",
  processing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim edildi",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
  refunded: "İade edildi",
  failed: "Başarısız",
};

const PAYMENT_STATUS_LABELS = {
  success: "Başarılı",
  pending: "Beklemede",
  failed: "Başarısız",
};

const PAYMENT_METHOD_LABELS = {
  gateway_simulation: "Ödeme Simülasyonu",
  simulation: "Ödeme Simülasyonu",
  paypal: "PayPal",
  cod: "Kapıda Ödeme",
  card: "Kredi Kartı",
};

function formatPaymentMethod(method) {
  const normalized = String(method || "").trim().toLowerCase();
  if (!normalized) return "";
  return PAYMENT_METHOD_LABELS[normalized] || normalized.toUpperCase();
}

function normalizeImage(img) {
  if (!img) return null;
  const u =
    (img.secure_url || img.url || img.path || img) + ""; /* string'e zorla */
  if (/^https?:\/\//i.test(u) || /^data:image\//i.test(u)) return u;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
  const origin = apiBase.replace(/\/api\/?$/i, "");
  const path = u.startsWith("/") ? u : `/${u}`;
  return `${origin}${path}`;
}

/** OrderDetailsModal */
export default function OrderDetailsModal({ orderId, onClose, admin = false }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sipariş çek
  useEffect(() => {
    if (!orderId) return;
    let mounted = true;
    (async () => {
      try {
        const data = admin
          ? await orderApi.adminGet(orderId)
          : await orderApi.get(orderId);
        if (mounted) setOrder(data);
      } catch (e) {
        console.error("Order get error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orderId, admin]);

  // Güvenli alan okuma & normalize
  const items = useMemo(() => {
    const src = order?.items || order?.lines || [];
    return src.map((it) => {
      // olası kaynaklar
      const product = it.product || it.item?.product || null;
      const set = it.set || it.item?.set || null;

      const name = it.name || product?.name || set?.name || it.title || "Ürün";

      const qty =
        Number(it.qty ?? it.quantity ?? it.count ?? it.amount ?? it.q ?? 1) ||
        1;

      const unitPrice =
        Number(
          it.unitPrice ??
            it.unit_price ??
            it.price ??
            product?.price ??
            set?.price ??
            0
        ) || 0;

      const image =
        normalizeImage(
          it.image ||
            product?.images?.[0]?.url ||
            product?.images?.[0] ||
            set?.images?.[0]?.url ||
            set?.images?.[0]
        ) || null;

      const slug = product?.slug || set?.slug || null;
      const href = slug
        ? product
          ? `/product/${slug}`
          : `/set/${slug}`
        : undefined;

      const variant = it.variant ||
        it.options || // Sık kullanılan alanlar:
        {
          color:
            it.color ||
            it.colour ||
            it.attributes?.color ||
            it.options?.color ||
            null,
          size: it.size || it.attributes?.size || it.options?.size || null,
        };

      return {
        id: it.id || it._id,
        name,
        qty,
        unitPrice,
        image,
        href,
        variant,
      };
    });
  }, [order]);

  const shippingAddress = useMemo(() => {
    // Farklı backend isimleri için normalize
    const a =
      order?.shippingAddress ||
      order?.address ||
      order?.deliveryAddress ||
      order?.shipping ||
      {};
    return {
      fullName: a.fullName || a.name || "-",
      addressLine:
        a.addressLine ||
        [a.addressLine1, a.addressLine2].filter(Boolean).join(" ") ||
        a.line1 ||
        a.street ||
        "-",
      city: a.city || "-",
      district: a.district || a.state || "",
      postalCode: a.postalCode || a.zip || "",
      country: a.country || "-",
      phone: a.phone || "",
    };
  }, [order]);

  const meta = useMemo(() => {
    const id = order?.id || order?._id || "";
    const number = order?.orderNumber || order?.number || String(id).slice(-6);
    const status = order?.status || "created";
    const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
    const payment = order?.payment || {}; // {method, status, txnId}
    const totals = {
      subtotal: Number(order?.totals?.subtotal ?? order?.subtotal ?? 0),
      shipping: Number(order?.totals?.shipping ?? order?.shipping ?? 0),
      grand: Number(
        order?.totals?.grand ??
          order?.total ??
          (order?.subtotal || 0) + (order?.shipping || 0)
      ),
    };
    return { number, status, createdAt, payment, totals };
  }, [order]);

  if (!orderId) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      {/* panel */}
      <div className="absolute inset-x-0 top-[6%] mx-auto w-[min(860px,94vw)] rounded-2xl border border-border bg-white shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-primary">
              Sipariş #{meta.number}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span
                className={cls(
                  "inline-flex items-center rounded-full px-2 py-0.5 ring-1 capitalize",
                  badgeClass(meta.status)
                )}
              >
                {STATUS_LABELS[String(meta.status).toLowerCase()] ||
                  String(meta.status).toLowerCase()}
              </span>
              {meta.createdAt && (
                <span className="text-secondary">
                  • {meta.createdAt.toLocaleString()}
                </span>
              )}
              {meta.payment?.method && (
                <span className="text-secondary">
                  • Ödeme: {formatPaymentMethod(meta.payment.method)}
                  {meta.payment.status
                    ? ` (${
                        PAYMENT_STATUS_LABELS[String(meta.payment.status).toLowerCase()] ||
                        meta.payment.status
                      })`
                    : ""}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-hover"
            aria-label="Kapat"
          >
            <X className="h-5 w-5 text-secondary" />
          </button>
        </div>

        {/* body */}
        <div className="max-h-[72vh] overflow-auto px-6 py-5">
          {/* loading / empty */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-36 rounded-xl border border-border bg-surface animate-pulse" />
              <div className="h-36 rounded-xl border border-border bg-surface animate-pulse" />
              <div className="h-28 rounded-xl border border-border bg-surface animate-pulse md:col-span-2" />
            </div>
          ) : !order ? (
            <div className="text-center text-secondary py-10">
              Sipariş bulunamadı.
            </div>
          ) : (
            <>
              {/* items */}
              <h3 className="text-sm font-semibold text-primary">Ürünler</h3>
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border overflow-hidden">
                {items.map((it) => (
                  <li
                    key={it.id}
                    className="grid grid-cols-[64px_1fr_auto] items-center gap-3 bg-white p-3"
                  >
                    <div className="h-16 w-16 overflow-hidden rounded-lg bg-surface">
                      {it.image ? (
                        <AppImage
                          src={it.image}
                          alt={it.name}
                          width={256}
                          height={256}
                          sizes="64px"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-[11px] text-secondary/70">
                          Görsel yok
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-primary">
                        {it.href ? (
                          <Link
                            to={it.href}
                            className="hover:underline hover:text-accent"
                          >
                            {it.name}
                          </Link>
                        ) : (
                          it.name
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-secondary">
                        Adet: <span className="text-primary">{it.qty}</span>
                        {" • "}
                        Birim:{" "}
                        <span className="text-primary">
                          {money(it.unitPrice)}
                        </span>
                        {renderVariant(it.variant)}
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-primary">
                      {money(it.unitPrice * it.qty)}
                    </div>
                  </li>
                ))}
              </ul>

              {/* grid: Address + Totals */}
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {/* Address */}
                <div className="rounded-xl border border-border bg-contact-bg p-4">
                  <div className="text-sm font-medium text-primary">
                    Teslimat adresi
                  </div>
                  <div className="mt-2 text-sm text-secondary whitespace-pre-line">
                    {shippingAddress.fullName}
                    {"\n"}
                    {shippingAddress.addressLine}
                    {"\n"}
                    {[
                      shippingAddress.city,
                      shippingAddress.district,
                      shippingAddress.postalCode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    {"\n"}
                    {shippingAddress.country}
                    {shippingAddress.phone
                      ? `\n📞 ${shippingAddress.phone}`
                      : ""}
                  </div>
                </div>

                {/* Totals */}
                <div className="rounded-xl border border-border bg-contact-bg p-4">
                  <div className="text-sm font-medium text-primary">Toplamlar</div>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-secondary">Ara toplam</span>
                      <span className="text-primary">
                        {money(meta.totals.subtotal)}
                      </span>
                    </div>
              <div className="flex justify-between">
                <span className="text-secondary">
                  {order?.shippingName
                    ? `Kargo (${order.shippingName})`
                    : "Kargo"}
                </span>
                <span className="text-primary">
                  {money(meta.totals.shipping)}
                </span>
              </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-primary">Toplam</span>
                      <span className="text-primary">
                        {money(meta.totals.grand)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment meta (varsa) */}
              {(order?.payment?.txnId || order?.payment?.provider) && (
                <div className="mt-5 rounded-xl border border-dashed border-border bg-white p-4 text-xs text-secondary">
                  <div className="font-medium text-primary text-sm">
                    Ödeme
                  </div>
                  <div className="mt-1">
                    {order.payment.provider && (
                      <div>Sağlayıcı: {String(order.payment.provider)}</div>
                    )}
                    {order.payment.txnId && (
                      <div>İşlem ID: {order.payment.txnId}</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Varyant bilgisi (color/size vb.) */
function renderVariant(variant) {
  if (!variant) return null;
  const color =
    (typeof variant === "object" && (variant.color || variant.colour)) || null;
  const size =
    (typeof variant === "object" && (variant.size || variant.dimension)) ||
    null;

  const parts = [];
  if (color) parts.push(`Color: ${color}`);
  if (size) parts.push(`Size: ${size}`);
  if (!parts.length) return null;

  return (
    <>
      {" "}
      • <span className="text-secondary">{parts.join(" / ")}</span>
    </>
  );
}
