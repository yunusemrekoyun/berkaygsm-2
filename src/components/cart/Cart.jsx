// src/components/cart/Cart.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CartItem from "./CartItem";
import { useCart } from "../../hooks/useCart";
import {
  useStaticTranslation,
  formatStaticText,
} from "../../i18n/staticContent.js";

const CURRENCY = (n) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
    n
  );

export default function Cart() {
  const navigate = useNavigate();
  const cart = useCart() || {};
  const {
    items = [],
    updateQty = () => {},
    removeFromCart = () => {},
    baseSubtotal = 0,
    subTotal = 0,
    total = 0,
    grandTotal = 0,
    coupon = null,
    couponInputVisible = true,
    couponDiscount = 0,
    couponMessage = null,
    pricing = {},
    applyCoupon = async () => {},
    clearCoupon = () => {},
    shipping: shippingInfo = {},
    hydrated = true,
  } = cart;
  const t = useStaticTranslation();
  const copy = t("cart") || {};
  const rowCopy = copy.rows || {};

  const [couponInput, setCouponInput] = useState("");

  const shippingFee = shippingInfo?.fee ?? 0;
  const baseShippingFee = shippingInfo?.baseFee ?? shippingFee;
  const freeThreshold = shippingInfo?.freeThreshold ?? 0;
  const shippingName = shippingInfo?.name || rowCopy.shipping || "Kargo";
  const totalWithDiscount = Math.max(0, grandTotal || total);
  const standardDiscountAmount = Number(pricing?.standardDiscountAmount || 0);
  const stackedDiscountAmount = Number(pricing?.stackedDiscountAmount || 0);
  const stackedSummary = pricing?.stacked || null;
  const nextStackedTierMessage = pricing?.nextStackedTierMessage || "";
  const stackedDiscountShopHref = pricing?.stackedDiscountShopHref || null;

  const onQty = (lineId, next) => updateQty(lineId, next);
  const onRemove = (lineId) => removeFromCart(lineId);

  const handleApplyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    try {
      await applyCoupon(code);
      setCouponInput("");
    } catch {
      // error message handled via couponMessage
    }
  };

  if (!hydrated) {
    return (
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12 lg:gap-8">
        <div className="md:col-span-7 lg:col-span-8">
          <div className="glass-surface rounded-2xl border border-border bg-white p-5">
            <div className="h-6 w-32 animate-pulse rounded bg-surface-light" />
            <div className="mt-6 space-y-4">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-2xl bg-surface-light"
                />
              ))}
            </div>
          </div>
        </div>
        <aside className="md:col-span-5 lg:col-span-4">
          <div className="glass-surface rounded-2xl border border-border bg-contact-bg p-4 sm:p-5">
            <div className="h-6 w-36 animate-pulse rounded bg-surface-light" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-4 animate-pulse rounded bg-surface-light"
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass-surface rounded-2xl border border-border bg-contact-bg p-10 text-center">
        <h2 className="text-2xl font-serif font-extrabold text-primary">
          {copy.emptyTitle || "Sepetiniz boş"}
        </h2>
        <p className="mt-2 text-secondary">
          {copy.emptySubtitle ||
            "Yeni kılıf, şarj cihazı ve aksesuar paketlerini keşfedin."}
        </p>
        <a
          href="/shop"
          className="mt-5 inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          {copy.continueShopping || "Alışverişe devam et"}
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12 lg:gap-8">
        <div className="md:col-span-7 lg:col-span-8">
          <div className="glass-surface rounded-2xl border border-border bg-white">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <h2 className="text-lg font-semibold text-primary">
                {copy.heading || "Sepetim"}
              </h2>
              <span className="text-sm text-secondary/80">{items.length} ürün</span>
            </div>

            <ul className="divide-y divide-border/70">
              {items.map((it) => (
                <CartItem
                  key={it.lineId}
                  item={it}
                  onQty={onQty}
                  onRemove={() => onRemove(it.lineId)}
                />
              ))}
            </ul>

            {(couponInputVisible || coupon || couponMessage) && (
              <div className="border-t border-border px-4 py-4 sm:px-5">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    {couponInputVisible && (
                      <>
                        <input
                          value={couponInput}
                          onChange={(e) =>
                            setCouponInput(e.target.value.toUpperCase())
                          }
                          placeholder={
                            copy.couponPlaceholder || "Kupon kodu girin"
                          }
                          className="glass-input min-w-0 rounded-lg border border-border bg-contact-bg px-3 py-2 text-sm text-primary outline-none placeholder:text-secondary/60"
                        />
                        <button
                          onClick={handleApplyCoupon}
                          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover sm:min-w-[104px]"
                        >
                          {copy.apply || "Uygula"}
                        </button>
                      </>
                    )}
                    {coupon && (
                      <button
                        onClick={clearCoupon}
                        className="rounded-lg border border-border px-3 py-2 text-sm text-primary hover:bg-surface-hover sm:min-w-[104px]"
                      >
                        {copy.clear || "Temizle"}
                      </button>
                    )}
                  </div>

                  <div className="flex min-h-[2.5rem] flex-col items-start justify-center gap-1 text-sm">
                    {coupon && (
                      <span className="font-medium text-accent">
                        {formatStaticText(copy.appliedLabel, {
                          code: coupon.code,
                          percentage: coupon.percentage,
                        })}
                      </span>
                    )}
                    {couponMessage && (
                      <span className="text-rose-500">{couponMessage}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(stackedSummary?.active || nextStackedTierMessage) && (
              <div className="border-t border-border px-4 py-4 sm:px-5">
                <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                  {stackedSummary?.active && (
                    <p className="text-sm font-semibold text-sky-800">
                      %{stackedSummary.percentage} katlanan indirim aktif.
                    </p>
                  )}
                  {nextStackedTierMessage && (
                    <p className="mt-1 text-sm text-sky-800">
                      {nextStackedTierMessage}
                    </p>
                  )}
                  {stackedDiscountShopHref && (
                    <a
                      href={stackedDiscountShopHref}
                      className="mt-3 inline-flex items-center rounded-full border border-sky-300 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-white"
                    >
                      Ürünleri göster
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="md:col-span-5 lg:col-span-4">
          <div className="glass-surface rounded-2xl border border-border bg-contact-bg p-4 sm:p-5 md:sticky md:top-[calc(var(--header-height)+1rem)]">
            <h3 className="mb-4 text-lg font-semibold text-primary">
              {copy.orderSummary || "Sipariş özeti"}
            </h3>

            {subTotal > 0 && freeThreshold > 0 && baseShippingFee > 0 && (
              <div className="glass-surface-soft mb-4 rounded-xl border border-border bg-white p-3">
                <p className="text-sm text-secondary">
                  {subTotal >= freeThreshold
                    ? copy.freeShippingUnlocked ||
                      "Ücretsiz kargo kazandınız 🎉"
                    : formatStaticText(copy.freeShippingHint, {
                        amount: CURRENCY(Math.max(0, freeThreshold - subTotal)),
                      }) ||
                      `Ücretsiz kargo için ${CURRENCY(
                        Math.max(0, freeThreshold - subTotal)
                      )} daha ekleyin`}
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full bg-accent"
                    style={{
                      width: `${Math.min(
                        100,
                        (subTotal / freeThreshold) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 text-sm">
              <Row
                label={rowCopy.subtotal || "Ara toplam"}
                value={CURRENCY(baseSubtotal || subTotal)}
              />
              {standardDiscountAmount > 0 && (
                <Row
                  label="Normal indirim"
                  value={`– ${CURRENCY(standardDiscountAmount)}`}
                />
              )}
              {stackedDiscountAmount > 0 && (
                <Row
                  label="Katlanan indirim"
                  value={`– ${CURRENCY(stackedDiscountAmount)}`}
                />
              )}
              <Row
                label={rowCopy.discount || "Kupon"}
                value={
                  couponDiscount ? `– ${CURRENCY(couponDiscount)}` : CURRENCY(0)
                }
              />
              <Row
                label={`${rowCopy.shipping || "Kargo"}${
                  shippingName ? ` (${shippingName})` : ""
                }`}
                value={
                  shippingFee === 0
                    ? rowCopy.free || "Ücretsiz"
                    : CURRENCY(shippingFee)
                }
              />
              <div className="my-2 border-t border-border" />
              <Row
                label={rowCopy.total || "Toplam"}
                value={CURRENCY(totalWithDiscount)}
                bold
              />
            </div>

            <button
              className="mt-4 w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              disabled={!items.length}
              onClick={() => navigate("/checkout")}
            >
              {copy.checkoutCta || "Ödemeye geç"}
            </button>

            <a
              href="/shop"
              className="mt-3 block text-center text-sm text-secondary hover:text-accent"
            >
              {copy.continueShoppingLink || "Alışverişe devam et"}
            </a>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-40 md:hidden">
        <div className="glass-surface rounded-2xl border border-border bg-white/95 p-3 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-secondary/70">
                Toplam
              </p>
              <p className="truncate text-base font-semibold text-primary">
                {CURRENCY(totalWithDiscount)}
              </p>
            </div>
            <button
              className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              disabled={!items.length}
              onClick={() => navigate("/checkout")}
            >
              {copy.checkoutCta || "Ödemeye geç"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={bold ? "font-semibold text-primary" : "text-secondary"}>
        {label}
      </span>
      <span
        className={`shrink-0 ${bold ? "font-semibold text-primary" : "text-primary"}`}
      >
        {value}
      </span>
    </div>
  );
}
