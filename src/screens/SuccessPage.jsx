"use client";

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BreadCrumb from "../components/shop/BreadCrumb";
import { orderApi } from "../api/orders";
import { useCart } from "../hooks/useCart.jsx";
import {
  getAccessToken,
  getUser,
  refreshAccessToken,
  hasAuthSession,
} from "../api/client";

export default function SuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const orderId = searchParams.get("order");
  const statusParam = String(searchParams.get("status") || "")
    .trim()
    .toLowerCase();
  const messageParam = String(searchParams.get("message") || "").trim();
  // Başarılı ödeme callback'i bu email'i redirect URL'ye ekler; misafir trackOrder
  // doğrulaması için kullanılır. Kayıtlı kullanıcılar JWT ile eriştiğinden etkilenmez.
  const emailParam = String(searchParams.get("email") || "").trim();
  const [order, setOrder] = useState(null);
  const { clearCart, clearCoupon } = useCart() || {};
  const hasSession = hasAuthSession();

  useEffect(() => {
    if (!orderId && !hasSession) {
      navigate(
        `/account?view=login&redirect=${encodeURIComponent("/checkout/success")}`,
        { replace: true }
      );
    }
  }, [hasSession, navigate, orderId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!orderId) return;
      let hasToken = Boolean(getAccessToken());

      if (!hasToken && getUser()) {
        hasToken = await refreshAccessToken();
      }

      try {
        const o = hasToken
          ? await orderApi.get(orderId)
          : await orderApi.track(orderId, emailParam || null);
        if (mounted) setOrder(o);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  const derivedStatus = order
    ? String(order?.payment?.status || "").toLowerCase() === "failed"
      ? "failed"
      : "success"
    : statusParam || "success";

  const paymentFailed = derivedStatus === "failed";
  const paymentReview = derivedStatus === "review";
  const heading = paymentFailed
    ? "Ödeme tamamlanamadı"
    : paymentReview
      ? "Ödeme alındı, sipariş kontrol ediliyor"
      : "Teşekkürler!";
  const message = paymentFailed
    ? messageParam ||
      "Ödeme tamamlanamadı. Sipariş durumunu hesabınızdan kontrol edebilirsiniz."
    : paymentReview
      ? messageParam ||
        "Ödeme sonucu güvenlik kontrolüne alındı. Kısa süre içinde manuel olarak doğrulanacak."
      : "Siparişiniz başarıyla oluşturuldu.";

  useEffect(() => {
    if (!orderId || !order || derivedStatus !== "success") return;
    if (typeof window === "undefined") return;

    const handledKey = `checkout-success-cleared:${orderId}`;
    try {
      if (window.sessionStorage.getItem(handledKey)) return;
    } catch {
      // ignore storage errors
    }

    clearCart?.();
    clearCoupon?.();

    try {
      window.sessionStorage.setItem(handledKey, "1");
    } catch {
      // ignore storage errors
    }
  }, [clearCart, clearCoupon, derivedStatus, order, orderId]);

  return (
    <section className="store-page bg-surface-light/60">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6">
        <BreadCrumb
          items={[
            { label: "Ana Sayfa", to: "/" },
            { label: paymentFailed ? "Ödeme Sonucu" : "Başarılı" },
          ]}
        />
      </div>

      <div className="mx-auto max-w-xl px-4 sm:px-6 pb-16">
        <div className="glass-surface rounded-2xl border border-border bg-white p-6 text-center">
          <h1 className="text-2xl font-semibold text-primary">{heading}</h1>
          <p className="mt-2 text-secondary">{message}</p>

          {order && (
            <div className="mt-4 text-left text-sm">
              <div className="font-medium text-primary">
                Sipariş #{order.orderNumber || order.id}
              </div>
              <div className="text-xs text-secondary">
                Durum: <span className="capitalize">{order.status}</span>
                {order?.payment?.status && (
                  <>
                    {" "}
                    • Ödeme:{" "}
                    <span className="capitalize">{order.payment.status}</span>
                  </>
                )}{" "}
                • {order.shippingName || "Kargo"}: ₺
                {Number(order.shipping || 0).toFixed(2)}
              </div>
              <ul className="mt-2 space-y-1">
                {order.items.map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-primary truncate">
                      {it.name} × {it.qty}
                    </span>
                    <span className="text-secondary">
                      ₺{Number(it.unitPrice * it.qty).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-border pt-3 flex justify-between">
                <span className="text-primary font-semibold">Toplam</span>
                <span className="text-primary font-semibold">
                  ₺{Number(order.total).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center gap-3">
            <Link
              to={paymentFailed || paymentReview ? "/checkout" : "/"}
              className="glass-chip rounded-full border border-border px-4 py-2 text-sm text-primary hover:bg-surface-hover"
            >
              {paymentFailed || paymentReview
                ? "Checkout sayfasına dön"
                : "Alışverişe devam et"}
            </Link>
            <Link
              to={hasSession ? "/account?tab=Orders" : "/"}
              className="rounded-full bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover"
            >
              {hasSession ? "Siparişlerimi gör" : "Ana sayfaya dön"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
