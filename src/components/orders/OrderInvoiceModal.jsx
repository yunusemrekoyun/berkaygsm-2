import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  Hash,
  Mail,
  MapPin,
  Package,
  Phone,
  User2,
  X,
} from "lucide-react";
import { orderApi } from "../../api/orders";
import { formatOrderDateTime } from "./orderPrintTemplate.js";
import { formatPaymentMethodLabel } from "../../utils/paymentLabels.js";

const VAT_RATE = 0.2;

const ORDER_STATUS_LABELS = {
  pending: "Beklemede",
  paid: "Ödendi",
  shipped: "Kargoda",
  completed: "Tamamlandı",
  cancelled: "İptal Edildi",
  failed: "Başarısız",
};

const PAYMENT_STATUS_LABELS = {
  success: "Başarılı",
  pending: "Beklemede",
  failed: "Başarısız",
  refunded: "İade Edildi",
};

const PAYMENT_METHOD_LABELS = {
  online: "Online Ödeme",
  cod: "Kapıda Ödeme",
  card: "Kredi Kartı",
};

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function roundCurrency(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

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

function formatText(value, fallback = "—") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function firstFilled(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function formatPaymentMethod(method) {
  const normalized = String(method || "").trim().toLowerCase();
  if (!normalized) return "—";
  return PAYMENT_METHOD_LABELS[normalized] || formatPaymentMethodLabel(normalized);
}

function formatStatus(status, labels) {
  const normalized = String(status || "").trim().toLowerCase();
  return labels[normalized] || formatText(status);
}

function buildAddressLine(address) {
  if (!address) return "—";
  const parts = [
    address.addressLine,
    [address.district, address.city].filter(Boolean).join(" / "),
    address.postalCode,
    address.country,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.join(", ") || "—";
}

function deriveInvoiceIdentity(order) {
  return firstFilled(
    order?.invoice?.identityNumber,
    order?.invoice?.taxNumber,
    order?.invoice?.tckn,
    order?.invoice?.vkn,
    order?.address?.identityNumber,
    order?.address?.identityNo,
    order?.address?.tckn,
    order?.address?.vkn,
    order?.customer?.identityNumber,
    order?.customer?.taxNumber,
    order?.customer?.tckn,
    order?.customer?.vkn,
    order?.payment?.payer?.identityNumber,
    order?.payment?.payer?.taxNumber,
    order?.payment?.payer?.tckn,
    order?.payment?.payer?.vkn,
    order?.user?.identityNumber,
    order?.user?.taxNumber,
    order?.user?.tckn,
    order?.user?.vkn
  );
}

function deriveInvoiceType(order, identityNumber) {
  const explicit = firstFilled(
    order?.invoice?.type,
    order?.address?.invoiceType,
    order?.customer?.invoiceType
  );
  if (explicit) return explicit;
  if (identityNumber.length === 11) return "Bireysel";
  if (identityNumber.length === 10) return "Kurumsal";
  return "";
}

function getVatBreakdown(grossAmount) {
  const gross = roundCurrency(Math.max(0, Number(grossAmount || 0)));
  const net = roundCurrency(gross / (1 + VAT_RATE));
  return {
    gross,
    net,
    vat: roundCurrency(gross - net),
  };
}

function getVariantLabel(item) {
  const parts = [
    item?.variant?.color,
    item?.variant?.size,
    item?.variant?.attribute,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.join(" • ");
}

function getSelectionsLabel(item) {
  if (!Array.isArray(item?.selections) || item.selections.length === 0) return "";
  return item.selections
    .map((selection) =>
      [
        selection?.qtyInSet > 1 ? `${selection.qtyInSet}x` : null,
        selection?.color,
        selection?.size,
        selection?.attribute,
      ]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" • ")
    )
    .filter(Boolean)
    .join(" | ");
}

function buildCopySummary(summary) {
  const lines = [
    `Sipariş No: ${summary.orderNumber}`,
    `Sipariş Tarihi: ${summary.createdAt}`,
    `Sipariş Durumu: ${summary.orderStatus}`,
    `Ödeme: ${summary.paymentMethod} / ${summary.paymentStatus}`,
    `Ödeme Referansı: ${summary.paymentTxnId || "-"}`,
    `Müşteri: ${summary.customerName}`,
    `E-posta: ${summary.customerEmail || "-"}`,
    `Telefon: ${summary.customerPhone || "-"}`,
    `TCKN / VKN: ${summary.identityNumber || "-"}`,
    `Fatura Tipi: ${summary.invoiceType || "Henüz yok"}`,
    `Vergi Dairesi: ${summary.taxOffice || "-"}`,
    `Adres: ${summary.addressLine}`,
    `Kargo: ${summary.shippingName} (${money(summary.shippingGross)})`,
    `Ara Toplam (İndirim Öncesi): ${money(summary.baseSubtotal)}`,
    `Toplam İndirim: ${money(summary.totalDiscount)}`,
    `Ürün Toplamı: ${money(summary.productGross)}`,
    `KDV %20: ${money(summary.totalVat)}`,
    `Genel Toplam: ${money(summary.totalGross)}`,
    "",
    "Ürünler:",
    ...summary.items.map(
      (item, index) =>
        `${index + 1}. ${item.name} x${item.qty} - ${money(item.finalGross)}${
          item.variantLabel ? ` (${item.variantLabel})` : ""
        }`
    ),
  ];

  if (summary.note) {
    lines.push("", `Sipariş Notu: ${summary.note}`);
  }

  if (summary.missingFields.length) {
    lines.push(
      "",
      "Eksik / Sonradan Toplanacak Alanlar:",
      ...summary.missingFields.map((field) => `- ${field.label}`)
    );
  }

  return lines.join("\n");
}

function MetaRow({ label, value, mono = false, muted = false }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-admin)]/50 py-2 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-sm text-[var(--color-text-admin-muted)]">
        {label}
      </span>
      <span
        className={cls(
          "max-w-[62%] text-right text-sm font-medium",
          muted
            ? "text-[var(--color-text-admin-muted)]"
            : "text-[var(--color-text-admin)]",
          mono && "font-mono text-xs sm:text-sm"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function StatCard({ title, value, detail }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-admin-muted)]">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold text-[var(--color-text-admin)]">
        {value}
      </div>
      {detail ? (
        <div className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function SectionCard({ icon: Icon, title, subtitle, children, tone = "default" }) {
  const toneClass =
    tone === "warn"
      ? "border-amber-200 bg-amber-50/70"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50/70"
        : "border-[var(--color-border-admin)] bg-[var(--color-bg-card)]";

  return (
    <section className={cls("rounded-[26px] border p-5 shadow-sm", toneClass)}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-bg-admin)] text-[var(--color-text-admin)]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--color-text-admin)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function OrderInvoiceModal({ orderId, onClose, admin = false }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setFeedback(null);
        const data = admin
          ? await orderApi.adminGet(orderId)
          : await orderApi.get(orderId);
        if (!mounted) return;
        setOrder(data);
      } catch (error) {
        if (!mounted) return;
        console.error("Invoice summary get error:", error);
        setFeedback({
          variant: "danger",
          message: "Fatura özeti yüklenemedi.",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [admin, orderId]);

  useEffect(() => {
    if (!orderId) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, orderId]);

  const summary = useMemo(() => {
    if (!order) return null;

    const baseSubtotal = roundCurrency(Number(order.pricing?.baseSubtotal || 0));
    const standardDiscount = roundCurrency(
      Number(order.pricing?.standardDiscountAmount || 0)
    );
    const stackedDiscount = roundCurrency(
      Number(order.pricing?.stackedDiscountAmount || 0)
    );
    const couponDiscount = roundCurrency(
      Number(order.pricing?.couponDiscountAmount || order.coupon?.discountAmount || 0)
    );
    const shippingGross = roundCurrency(Number(order.shipping || 0));
    const totalGross = roundCurrency(Number(order.total || 0));
    const subtotalBeforeCoupon = roundCurrency(Number(order.subtotal || 0));

    const itemRows = Array.isArray(order.items)
      ? order.items.map((item, index) => {
          const qty = Math.max(1, Number(item?.qty || 1));
          const baseUnitGross = roundCurrency(
            Number(
              item?.pricing?.baseUnitPrice ??
                item?.originalUnitPrice ??
                item?.unitPrice ??
                0
            )
          );
          const baseGross = roundCurrency(baseUnitGross * qty);
          const beforeCouponGross = roundCurrency(
            Number(item?.unitPrice || 0) * qty
          );
          const couponLineDiscount = roundCurrency(
            Number(item?.pricing?.coupon?.amount || 0)
          );
          const finalGross = roundCurrency(
            Math.max(0, beforeCouponGross - couponLineDiscount)
          );
          const totalDiscount = roundCurrency(Math.max(0, baseGross - finalGross));
          const vat = getVatBreakdown(finalGross);

          return {
            id: `${item?.ref || item?.name || "item"}-${index}`,
            name: formatText(item?.name, "Ürün"),
            kind: String(item?.kind || "product").toLowerCase(),
            qty,
            variantLabel: getVariantLabel(item),
            selectionsLabel: getSelectionsLabel(item),
            originalUnitGross: baseUnitGross,
            effectiveUnitGross: roundCurrency(finalGross / qty),
            finalGross,
            totalDiscount,
            vatNet: vat.net,
            vatAmount: vat.vat,
            discountBits: [
              Number(item?.pricing?.standard?.amount || 0) > 0
                ? `Normal indirim ${money(item.pricing.standard.amount)}`
                : null,
              Number(item?.pricing?.stacked?.amount || 0) > 0
                ? `Katlanan indirim ${money(item.pricing.stacked.amount)}`
                : null,
              couponLineDiscount > 0 && item?.pricing?.coupon?.code
                ? `Kupon ${item.pricing.coupon.code} ${money(couponLineDiscount)}`
                : couponLineDiscount > 0
                  ? `Kupon indirimi ${money(couponLineDiscount)}`
                  : null,
            ].filter(Boolean),
          };
        })
      : [];

    const productGrossFromItems = roundCurrency(
      itemRows.reduce((sum, item) => sum + item.finalGross, 0)
    );
    const productGrossCandidate = roundCurrency(
      subtotalBeforeCoupon - couponDiscount
    );
    const productGross =
      subtotalBeforeCoupon > 0 || couponDiscount > 0
        ? Math.max(0, productGrossCandidate)
        : productGrossFromItems;
    const totalDiscount = roundCurrency(
      Math.max(0, baseSubtotal - productGross)
    );
    const productVat = getVatBreakdown(productGross);
    const shippingVat = getVatBreakdown(shippingGross);
    const grandVat = getVatBreakdown(totalGross);

    const customerName = formatText(
      firstFilled(
        order.address?.fullName,
        [order.user?.firstName, order.user?.lastName].filter(Boolean).join(" "),
        order.payment?.payer?.name
      )
    );
    const customerEmail = formatText(
      firstFilled(order.user?.email, order.payment?.payer?.email)
    );
    const customerPhone = formatText(
      firstFilled(order.address?.phone, order.user?.phone)
    );
    const identityNumber = deriveInvoiceIdentity(order);
    const invoiceType = deriveInvoiceType(order, identityNumber);
    const taxOffice = firstFilled(
      order?.invoice?.taxOffice,
      order?.address?.taxOffice,
      order?.customer?.taxOffice
    );

    const missingFields = [
      !identityNumber && {
        label: "TCKN / VKN henüz toplanmıyor",
        detail: "Ödeme altyapısı geldiğinde doğrudan bu alana düşecek.",
      },
      !invoiceType && {
        label: "Fatura tipi belirsiz",
        detail: "Bireysel / kurumsal ayrımı için ek alan gerekiyor.",
      },
      !taxOffice && {
        label: "Vergi dairesi bilgisi yok",
        detail: "Kurumsal faturalarda manuel tamamlama gerekir.",
      },
      !firstFilled(order.user?.email, order.payment?.payer?.email) && {
        label: "Fatura e-postası eksik",
        detail: "Belge gönderimi için müşteri e-postası gerekli olabilir.",
      },
      !firstFilled(order.payment?.txnId, order.payment?.processorOrderId) && {
        label: "Ödeme referans numarası yok",
        detail: "Mutabakat sırasında manuel kontrol gerekir.",
      },
    ].filter(Boolean);

    return {
      orderNumber: order.orderNumber || order.id || "—",
      orderStatus: formatStatus(order.status, ORDER_STATUS_LABELS),
      paymentStatus: formatStatus(order.payment?.status, PAYMENT_STATUS_LABELS),
      paymentMethod: formatPaymentMethod(order.payment?.method),
      paymentProvider: formatText(order.payment?.provider),
      paymentTxnId: firstFilled(
        order.payment?.txnId,
        order.payment?.processorOrderId
      ),
      createdAt: formatOrderDateTime(order.createdAt),
      paidAt: formatOrderDateTime(order.payment?.paidAt),
      shippingName: formatText(order.shippingName, "Standart Kargo"),
      customerName,
      customerEmail,
      customerPhone,
      identityNumber,
      invoiceType,
      taxOffice,
      addressLine: buildAddressLine(order.address),
      note: formatText(order.note, ""),
      items: itemRows,
      totalUnits: itemRows.reduce((sum, item) => sum + item.qty, 0),
      baseSubtotal,
      standardDiscount,
      stackedDiscount,
      couponDiscount,
      totalDiscount,
      productGross,
      productNet: productVat.net,
      productVat: productVat.vat,
      shippingGross,
      shippingNet: shippingVat.net,
      shippingVat: shippingVat.vat,
      totalGross,
      totalNet: grandVat.net,
      totalVat: grandVat.vat,
      missingFields,
    };
  }, [order]);

  const handleCopy = async () => {
    if (!summary || typeof navigator === "undefined" || !navigator.clipboard) {
      setFeedback({
        variant: "danger",
        message: "Kopyalama bu tarayıcıda kullanılamıyor.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(buildCopySummary(summary));
      setFeedback({
        variant: "success",
        message: "Fatura özeti panoya kopyalandı.",
      });
    } catch (error) {
      console.error("Invoice summary copy error:", error);
      setFeedback({
        variant: "danger",
        message: "Özet kopyalanamadı.",
      });
    }
  };

  if (!orderId) return null;

  return (
    <div className="fixed inset-0 z-[210]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />

      <div className="absolute inset-2 flex flex-col overflow-hidden rounded-[28px] border border-[var(--color-border-admin)] bg-white shadow-[0_30px_120px_rgba(15,23,42,0.25)] sm:inset-4 lg:inset-5 xl:left-1/2 xl:top-6 xl:bottom-6 xl:w-[min(1240px,calc(100vw-56px))] xl:-translate-x-1/2">
        <div className="flex shrink-0 flex-col gap-4 border-b border-[var(--color-border-admin)] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-bg-admin)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-admin)]">
                <FileText className="h-3.5 w-3.5" />
                Fatura Hazırlık Özeti
              </div>
              <div className="mt-3 text-2xl font-semibold text-[var(--color-text-admin)]">
                Sipariş #{summary?.orderNumber || orderId}
              </div>
              {!loading && summary ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-admin-muted)]">
                  <span>{summary.orderStatus}</span>
                  <span>•</span>
                  <span>{summary.paymentMethod}</span>
                  <span>•</span>
                  <span>{summary.createdAt}</span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2 self-start">
              <button
                onClick={handleCopy}
                disabled={!summary}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
              >
                <Copy className="h-4 w-4" />
                Özeti Kopyala
              </button>
              <button
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--color-bg-hover)]"
                aria-label="Kapat"
              >
                <X className="h-5 w-5 text-[var(--color-text-admin-muted)]" />
              </button>
            </div>
          </div>

          {feedback ? (
            <div
              className={cls(
                "rounded-2xl border px-4 py-3 text-sm",
                feedback.variant === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              )}
            >
              {feedback.message}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 overflow-auto px-4 py-4 sm:px-6 sm:py-5">
          {loading ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-5">
                <div className="h-28 animate-pulse rounded-[26px] bg-stone-100" />
                <div className="h-80 animate-pulse rounded-[26px] bg-stone-100" />
                <div className="h-72 animate-pulse rounded-[26px] bg-stone-100" />
              </div>
              <div className="space-y-5">
                <div className="h-64 animate-pulse rounded-[26px] bg-stone-100" />
                <div className="h-56 animate-pulse rounded-[26px] bg-stone-100" />
              </div>
            </div>
          ) : !order || !summary ? (
            <div className="py-16 text-center text-[var(--color-text-admin-muted)]">
              Fatura özeti oluşturulamadı.
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  <StatCard
                    title="Genel Toplam"
                    value={money(summary.totalGross)}
                    detail={`KDV dahil • ${money(summary.totalVat)} KDV`}
                  />
                  <StatCard
                    title="Ürün Toplamı"
                    value={money(summary.productGross)}
                    detail={`${summary.totalUnits} adet satılan ürün`}
                  />
                  <StatCard
                    title="Toplam İndirim"
                    value={money(summary.totalDiscount)}
                    detail={
                      summary.couponDiscount > 0
                        ? `Kupon dahil ${money(summary.couponDiscount)}`
                        : "Normal + kampanya indirimleri dahil"
                    }
                  />
                  <StatCard
                    title="Kargo"
                    value={money(summary.shippingGross)}
                    detail={summary.shippingName}
                  />
                </div>

                <SectionCard
                  icon={FileText}
                  title="Fatura Tutar Dökümü"
                  subtitle="Mevcut sipariş toplamından %20 KDV dahil varsayımıyla otomatik hesaplanır."
                >
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
                    <div className="rounded-2xl border border-[var(--color-border-admin)] bg-white p-4">
                      <MetaRow
                        label="İndirim öncesi ürün toplamı"
                        value={money(summary.baseSubtotal)}
                      />
                      <MetaRow
                        label="Normal indirim"
                        value={`-${money(summary.standardDiscount)}`}
                        muted={summary.standardDiscount <= 0}
                      />
                      <MetaRow
                        label="Katlanan indirim"
                        value={`-${money(summary.stackedDiscount)}`}
                        muted={summary.stackedDiscount <= 0}
                      />
                      <MetaRow
                        label="Kupon indirimi"
                        value={`-${money(summary.couponDiscount)}`}
                        muted={summary.couponDiscount <= 0}
                      />
                      <MetaRow
                        label="İndirim sonrası ürün toplamı"
                        value={money(summary.productGross)}
                      />
                      <MetaRow
                        label={`${summary.shippingName} bedeli`}
                        value={money(summary.shippingGross)}
                      />
                      <MetaRow
                        label="KDV matrahı"
                        value={money(summary.totalNet)}
                      />
                      <MetaRow label="KDV (%20)" value={money(summary.totalVat)} />
                      <MetaRow label="Tahsil edilen toplam" value={money(summary.totalGross)} />
                    </div>

                    <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/55 p-4">
                      <div className="text-sm font-semibold text-[var(--color-text-admin)]">
                        KDV kırılımı
                      </div>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-2xl border border-[var(--color-border-admin)] bg-white px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-admin-muted)]">
                            Ürünler
                          </div>
                          <div className="mt-2 text-lg font-semibold text-[var(--color-text-admin)]">
                            {money(summary.productVat)}
                          </div>
                          <div className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
                            Matrah {money(summary.productNet)}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-[var(--color-border-admin)] bg-white px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-admin-muted)]">
                            Kargo
                          </div>
                          <div className="mt-2 text-lg font-semibold text-[var(--color-text-admin)]">
                            {money(summary.shippingVat)}
                          </div>
                          <div className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
                            Matrah {money(summary.shippingNet)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl border border-dashed border-[var(--color-border-admin)] bg-white px-4 py-3 text-sm text-[var(--color-text-admin-muted)]">
                        Bu alan gösterim amaçlıdır; vergi kuralları değişirse oran ve matrah hesabı
                        backend tarafında ayrıca modellenmelidir.
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={Package}
                  title="Ürün ve Satır Bilgileri"
                  subtitle="Manuel fatura girişinde ürün adı, adet, indirim ve KDV dahil tutarları tek ekranda gör."
                >
                  <div className="space-y-4">
                    {summary.items.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-[24px] border border-[var(--color-border-admin)] bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-[220px] flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-[var(--color-text-admin)]">
                                {item.name}
                              </h3>
                              <span className="rounded-full bg-[var(--color-bg-admin)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-admin)]">
                                {item.qty} adet
                              </span>
                              <span className="rounded-full border border-[var(--color-border-admin)] px-2.5 py-1 text-xs text-[var(--color-text-admin-muted)]">
                                {item.kind === "set" ? "Set" : "Ürün"}
                              </span>
                            </div>
                            {item.variantLabel ? (
                              <div className="mt-2 text-sm text-[var(--color-text-admin-muted)]">
                                Varyant: {item.variantLabel}
                              </div>
                            ) : null}
                            {item.selectionsLabel ? (
                              <div className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
                                Set içeriği: {item.selectionsLabel}
                              </div>
                            ) : null}
                          </div>

                          <div className="grid min-w-[250px] gap-2 text-sm sm:grid-cols-2 xl:min-w-[360px]">
                            <div className="rounded-2xl bg-[var(--color-bg-admin)]/60 px-3 py-2">
                              <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-admin-muted)]">
                                Birim satış
                              </div>
                              <div className="mt-1 font-semibold text-[var(--color-text-admin)]">
                                {money(item.effectiveUnitGross)}
                              </div>
                            </div>
                            <div className="rounded-2xl bg-[var(--color-bg-admin)]/60 px-3 py-2">
                              <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-admin-muted)]">
                                Satır toplamı
                              </div>
                              <div className="mt-1 font-semibold text-[var(--color-text-admin)]">
                                {money(item.finalGross)}
                              </div>
                            </div>
                            <div className="rounded-2xl bg-[var(--color-bg-admin)]/60 px-3 py-2">
                              <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-admin-muted)]">
                                Satır KDV
                              </div>
                              <div className="mt-1 font-semibold text-[var(--color-text-admin)]">
                                {money(item.vatAmount)}
                              </div>
                            </div>
                            <div className="rounded-2xl bg-[var(--color-bg-admin)]/60 px-3 py-2">
                              <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-admin-muted)]">
                                Uygulanan indirim
                              </div>
                              <div className="mt-1 font-semibold text-[var(--color-text-admin)]">
                                {money(item.totalDiscount)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {item.discountBits.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.discountBits.map((bit) => (
                              <span
                                key={bit}
                                className="rounded-full border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-1 text-xs font-medium text-[var(--color-text-admin)]"
                              >
                                {bit}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-2xl border border-[var(--color-border-admin)]/70 px-3 py-2">
                            <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-admin-muted)]">
                              Liste birim fiyatı
                            </div>
                            <div className="mt-1 text-sm font-medium text-[var(--color-text-admin)]">
                              {money(item.originalUnitGross)}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-[var(--color-border-admin)]/70 px-3 py-2">
                            <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-admin-muted)]">
                              KDV matrahı
                            </div>
                            <div className="mt-1 text-sm font-medium text-[var(--color-text-admin)]">
                              {money(item.vatNet)}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-[var(--color-border-admin)]/70 px-3 py-2">
                            <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-admin-muted)]">
                              Faturaya yazılacak adet
                            </div>
                            <div className="mt-1 text-sm font-medium text-[var(--color-text-admin)]">
                              {item.qty}
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </SectionCard>
              </div>

              <aside className="space-y-6">
                <SectionCard
                  icon={User2}
                  title="Müşteri ve Fatura Bilgileri"
                  subtitle="Fatura portalına girerken ihtiyaç duyulan alıcı verileri."
                >
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-[var(--color-border-admin)] bg-white p-4">
                      <MetaRow label="Ad Soyad" value={summary.customerName} />
                      <MetaRow
                        label="TCKN / VKN"
                        value={summary.identityNumber || "Henüz yok"}
                        mono
                        muted={!summary.identityNumber}
                      />
                      <MetaRow
                        label="Fatura tipi"
                        value={summary.invoiceType || "Henüz yok"}
                        muted={!summary.invoiceType}
                      />
                      <MetaRow
                        label="Vergi dairesi"
                        value={summary.taxOffice || "Henüz yok"}
                        muted={!summary.taxOffice}
                      />
                    </div>

                    <div className="rounded-2xl border border-[var(--color-border-admin)] bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-admin)]">
                        <Mail className="h-4 w-4" />
                        İletişim
                      </div>
                      <div className="mt-3 space-y-3 text-sm text-[var(--color-text-admin)]">
                        <div className="flex items-start gap-2">
                          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-admin-muted)]" />
                          <span className="break-all">{summary.customerEmail}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-admin-muted)]" />
                          <span>{summary.customerPhone}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-admin-muted)]" />
                          <span>{summary.addressLine}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={CreditCard}
                  title="Ödeme ve Operasyon"
                  subtitle="Siparişin muhasebe ve gönderim tarafında referans alınacak alanlar."
                >
                  <div className="rounded-2xl border border-[var(--color-border-admin)] bg-white p-4">
                    <MetaRow label="Sipariş no" value={summary.orderNumber} mono />
                    <MetaRow label="Sipariş tarihi" value={summary.createdAt} />
                    <MetaRow label="Sipariş durumu" value={summary.orderStatus} />
                    <MetaRow label="Ödeme yöntemi" value={summary.paymentMethod} />
                    <MetaRow label="Ödeme durumu" value={summary.paymentStatus} />
                    <MetaRow label="Sağlayıcı" value={summary.paymentProvider} />
                    <MetaRow
                      label="Ödeme referansı"
                      value={summary.paymentTxnId || "Henüz yok"}
                      mono
                      muted={!summary.paymentTxnId}
                    />
                    <MetaRow label="Ödeme tarihi" value={summary.paidAt} />
                    <MetaRow label="Kargo yöntemi" value={summary.shippingName} />
                  </div>

                  {summary.note ? (
                    <div className="mt-4 rounded-2xl border border-[var(--color-border-admin)] bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-admin)]">
                        <Hash className="h-4 w-4" />
                        Sipariş notu
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[var(--color-text-admin-muted)]">
                        {summary.note}
                      </p>
                    </div>
                  ) : null}
                </SectionCard>

                <SectionCard
                  icon={summary.missingFields.length ? AlertTriangle : CheckCircle2}
                  title={
                    summary.missingFields.length
                      ? "Eksik Fatura Alanları"
                      : "Fatura İçin Hazır"
                  }
                  subtitle={
                    summary.missingFields.length
                      ? "Manuel fatura keserken ayrıca tamamlanması gerekebilecek alanlar."
                      : "Mevcut siparişte gösterilebilir kritik alanlar hazır görünüyor."
                  }
                  tone={summary.missingFields.length ? "warn" : "success"}
                >
                  {summary.missingFields.length ? (
                    <div className="space-y-3">
                      {summary.missingFields.map((field) => (
                        <div
                          key={field.label}
                          className="rounded-2xl border border-amber-200 bg-white px-4 py-3"
                        >
                          <div className="text-sm font-semibold text-[var(--color-text-admin)]">
                            {field.label}
                          </div>
                          <div className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
                            {field.detail}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-[var(--color-text-admin)]">
                      Bu görünümde manuel fatura kesimi için ihtiyaç duyulan ana sipariş,
                      müşteri ve tutar alanları tek ekranda hazır.
                    </div>
                  )}
                </SectionCard>

                <div className="rounded-[26px] border border-[var(--color-border-admin)] bg-[linear-gradient(135deg,rgba(15,23,42,0.06),rgba(15,23,42,0.015))] p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-admin)]">
                    <CalendarDays className="h-4 w-4" />
                    Kullanım Notu
                  </div>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-text-admin-muted)]">
                    <p>
                      Bu modal siparişi fatura portalına aktarmayı hızlandırmak için
                      tasarlandı; herhangi bir muhasebe kaydı oluşturmaz.
                    </p>
                    <p>
                      “Özeti Kopyala” butonu müşteri, ürün, indirim, kargo ve KDV
                      kırılımını tek metin olarak panoya alır.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
