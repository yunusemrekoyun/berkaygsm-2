// src/components/cart/Cart.jsx
import { useState } from "react";
import CartItem from "./CartItem";
import { useCart } from "../../hooks/useCart";
import { useNavigate } from "react-router-dom";
import {
  useStaticTranslation,
  formatStaticText,
} from "../../i18n/staticContent.js";

const CURRENCY = (n) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(
    n
  );

export default function Cart() {
  const navigate = useNavigate();
  const cart = useCart() || {};
  const {
    items = [],
    updateQty = () => {},
    removeFromCart = () => {},
    subTotal = 0,
    total = 0,
    grandTotal = 0,
    coupon = null,
    couponDiscount = 0,
    couponMessage = null,
    applyCoupon = async () => {},
    clearCoupon = () => {},
    shipping: shippingInfo = {},
  } = cart;
  const t = useStaticTranslation();
  const copy = t("cart") || {};
  const rowCopy = copy.rows || {};

  const [couponInput, setCouponInput] = useState("");

  const shippingFee = shippingInfo?.fee ?? 0;
  const baseShippingFee = shippingInfo?.baseFee ?? shippingFee;
  const freeThreshold = shippingInfo?.freeThreshold ?? 0;
  const shippingName = shippingInfo?.name || rowCopy.shipping || "Shipping";

  const totalWithDiscount = Math.max(0, grandTotal || total);

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

  // Boş sepet
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-contact-bg p-10 text-center">
        <h2 className="text-2xl font-serif font-extrabold text-primary">
          {copy.emptyTitle || "Your cart is empty"}
        </h2>
        <p className="mt-2 text-secondary">
          {copy.emptySubtitle ||
            "Discover new cases, chargers, and accessory bundles."}
        </p>
        <a
          href="/shop"
          className="mt-5 inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          {copy.continueShopping || "Continue Shopping"}
        </a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
      {/* Sol: Ürün listesi */}
      <div className="md:col-span-8">
        <div className="rounded-2xl border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-primary">
              {copy.heading || "Shopping Cart"}
            </h2>
            <span className="text-sm text-secondary/80">
              {items.length} item{items.length > 1 ? "s" : ""}
            </span>
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

          {/* Kupon alanı */}
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
            <div className="flex flex-1 items-center gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder={copy.couponPlaceholder || "Enter coupon code"}
                className="flex-1 rounded-lg border border-border bg-contact-bg px-3 py-2 text-sm text-primary outline-none placeholder:text-secondary/60"
              />
              <button
                onClick={handleApplyCoupon}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                {copy.apply || "Apply"}
              </button>
              {coupon && (
                <button
                  onClick={clearCoupon}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-primary hover:bg-surface-hover"
                >
                  {copy.clear || "Clear"}
                </button>
              )}
            </div>

            <div className="flex flex-col items-start gap-1 text-sm">
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
      </div>

      {/* Sağ: Sipariş Özeti */}
      <aside className="md:col-span-4">
        <div className="rounded-2xl border border-border bg-contact-bg p-5">
          <h3 className="mb-4 text-lg font-semibold text-primary">
            {copy.orderSummary || "Order Summary"}
          </h3>

          {/* Progress to free shipping */}
          {subTotal > 0 && freeThreshold > 0 && baseShippingFee > 0 && (
            <div className="mb-4 rounded-xl border border-border bg-white p-3">
              <p className="text-sm text-secondary">
                {subTotal >= freeThreshold
                  ? copy.freeShippingUnlocked ||
                    "You’ve unlocked Free Shipping 🎉"
                  : formatStaticText(copy.freeShippingHint, {
                      amount: CURRENCY(Math.max(0, freeThreshold - subTotal)),
                    }) ||
                    `Spend ${CURRENCY(
                      Math.max(0, freeThreshold - subTotal)
                    )} more to get Free Shipping`}
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
              label={rowCopy.subtotal || "Subtotal"}
              value={CURRENCY(subTotal)}
            />
            <Row
              label={rowCopy.discount || "Discount"}
              value={
                couponDiscount ? `– ${CURRENCY(couponDiscount)}` : CURRENCY(0)
              }
            />
            <Row
              label={`${rowCopy.shipping || "Shipping"}${
                shippingName ? ` (${shippingName})` : ""
              }`}
              value={
                shippingFee === 0
                  ? rowCopy.free || "Free"
                  : CURRENCY(shippingFee)
              }
            />
            <div className="my-2 border-t border-border" />
            <Row
              label={rowCopy.total || "Total"}
              value={CURRENCY(totalWithDiscount)}
              bold
            />
          </div>

          <button
            className="mt-4 w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            disabled={!items.length}
            onClick={() => navigate("/checkout")}
          >
            {copy.checkoutCta || "Proceed to Checkout"}
          </button>

          <a
            href="/shop"
            className="mt-3 block text-center text-sm text-secondary hover:text-accent"
          >
            {copy.continueShoppingLink || "Continue Shopping"}
          </a>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? "font-semibold text-primary" : "text-secondary"}>
        {label}
      </span>
      <span className={bold ? "font-semibold text-primary" : "text-primary"}>
        {value}
      </span>
    </div>
  );
}
