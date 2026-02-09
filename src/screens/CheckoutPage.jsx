// src/pages/CheckoutPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BreadCrumb from "../components/shop/BreadCrumb";
import AlertBanner from "../components/ui/AlertBanner.jsx";
import LoadingOverlay from "../components/ui/LoadingOverlay.jsx";
import { useCart } from "../hooks/useCart";
import { userDetailsApi } from "../api/userDetails";
import { orderApi } from "../api/orders";
import { loadPayPalSdk } from "../utils/paypal.js";
import { getAccessToken } from "../api/client";

function parseError(error) {
  if (!error) return { message: "", status: null };
  let message = "";
  let status = null;

  const unwrap = (raw) => {
    if (typeof raw !== "string") return { msg: raw, status: null };
    let msg = raw;
    let stat = null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        stat =
          parsed.status ??
          parsed.statusCode ??
          parsed.code ??
          parsed.errorCode ??
          null;
        msg = parsed.message || msg;
      }
    } catch {
      /* ignore */
    }
    return { msg, status: stat };
  };

  if (error instanceof Error) {
    const { msg, status: stat } = unwrap(error.message);
    message = typeof msg === "string" ? msg : String(msg);
    status = stat;
  } else if (typeof error === "string") {
    const { msg, status: stat } = unwrap(error);
    message = typeof msg === "string" ? msg : String(msg);
    status = stat;
  } else {
    message = String(error);
  }

  return { message, status };
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);

  // Cart verisini oku
  const cart = useCart() || {};
  const {
    items: itemsRaw = [],
    subTotal = 0,
    total = 0,
    grandTotal = 0,
    coupon = null,
    couponDiscount = 0,
    shipping: shippingInfo = {},
    clearCart = () => {},
    clearCoupon = () => {},
  } = cart;

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      navigate(`/account?view=login&redirect=/checkout`, { replace: true });
      return;
    }
    setAuthChecked(true);
  }, [navigate]);

  const checkoutItems = useMemo(
    () =>
      itemsRaw
        .map((it) => {
          // kind
          const rawKind =
            it.kind ||
            (it.productId ? "product" : it.setId ? "set" : undefined);
          const kind = rawKind === "set" ? "set" : "product";

          // id
          const rawId =
            it.ref ||
            it.id ||
            it.productId ||
            it.setId ||
            it._id ||
            it.product?._id ||
            it.set?._id;
          const id = rawId ? String(rawId).trim() : "";
          if (!id) return null;

          // qty
          const qty = Math.max(
            1,
            Number(
              it.qty ?? it.quantity ?? it.count ?? it.amount ?? it.q ?? 1
            ) || 1
          );

          // <<< ÖNEMLİ: set satırları için selections ekle
          if (kind === "set") {
            const selections = Array.isArray(it.items)
              ? it.items
                  .map((s) => {
                    const productId =
                      s.productId ||
                      s.id ||
                      s._id ||
                      s.ref ||
                      s.product?._id ||
                      s.productId?._id;
                    if (!productId) return null;

                    return {
                      productId: String(productId),
                      color: s.color ?? null,
                      size: s.size ?? null,
                      attribute: s.attribute ?? null,
                      qtyInSet: Math.max(1, Number(s.qtyInSet || 1)),
                      // colorHex backend için şart değilse göndermene gerek yok;
                      // istiyorsan ekleyebilirsin:
                      // colorHex: s.colorHex ?? null,
                    };
                  })
                  .filter(Boolean)
              : [];

            return { kind, id, qty, selections };
          }

          // ürün satırı
          const variant = {
            color:
              it.color ??
              it.variant?.color ??
              it.selectedColor ??
              null,
            size: it.size ?? it.variant?.size ?? null,
            attribute:
              it.attribute ??
              it.variant?.attribute ??
              it.attributeValue ??
              null,
          };

          return { kind, id, qty, variant };
        })
        .filter(Boolean),
    [itemsRaw]
  );

  // UI'de göstereceğimiz satırlar (isim/fiyat)
  const lines = useMemo(
    () =>
      itemsRaw.map((it) => {
        const qty =
          Number(it.qty ?? it.quantity ?? it.count ?? it.amount ?? it.q ?? 1) ||
          1;

        const unitPrice =
          Number(
            it.price ??
              it.unitPrice ??
              it.unit_price ??
              it.product?.price ??
              it.set?.price ??
              0
          ) || 0;

        const name =
          it.name ?? it.title ?? it.product?.name ?? it.set?.name ?? "Item";

        return { name, qty, unitPrice };
      }),
    [itemsRaw]
  );

  // Toplamlar: cart verisi varsa onu kullan, yoksa hesapla
  const computedSubtotal = useMemo(
    () => lines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
    [lines]
  );
  const subtotal = Number(subTotal ?? computedSubtotal) || 0;
  const shippingFee = Number(shippingInfo?.fee ?? 0) || 0;
  const shippingName = shippingInfo?.name || "Kargo";
  const normalizedCouponDiscount = Number(couponDiscount) || 0;
  const derivedTotal = Math.max(0, subtotal + shippingFee - normalizedCouponDiscount);
  const totalDue = Number.isFinite(Number(grandTotal))
    ? Number(grandTotal)
    : Number.isFinite(Number(total))
    ? Number(total)
    : derivedTotal;

  // Sipariş başarı takip
  const orderPlacedRef = useRef(false);
  const paypalButtonsRef = useRef(null);
  const paypalContainerRef = useRef(null);
  const paypalDraftRef = useRef(null);

  // Adresler
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState("");
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [banner, setBanner] = useState(null);
  const [simulationMode, setSimulationMode] = useState("success");
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
  const paypalCurrency = process.env.NEXT_PUBLIC_PAYPAL_CURRENCY || "TRY";
  const paypalEnabled = Boolean(paypalClientId);
  const [paymentMethod, setPaymentMethod] = useState(
    paypalEnabled ? "paypal" : "cod"
  );
  const [paypalError, setPayPalError] = useState(null);
  const [paypalLoading, setPayPalLoading] = useState(false);
  const [paypalSummary, setPayPalSummary] = useState(null);

  const hasItems = checkoutItems.length > 0;
  const hasAddress = Boolean(addressId);
  const canPlaceOrder =
    paymentMethod === "cod" && hasAddress && hasItems && !placing && authChecked;
  const canUsePayPal =
    paymentMethod === "paypal" &&
    paypalEnabled &&
    hasAddress &&
    hasItems &&
    authChecked;

  // Adresleri çek
  useEffect(() => {
    if (!authChecked) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const list = await userDetailsApi.listAddresses();
        if (!mounted) return;
        setAddresses(list);
        setAddressId(list.find((a) => a.isDefault)?.id || list[0]?.id || "");
        if (!list.length) {
          setBanner((prev) =>
                prev?.variant === "danger"
              ? prev
              : {
                  variant: "warning",
                  message: "Sipariş vermeden önce teslimat adresi ekleyin.",
                }
          );
        } else {
          setBanner((prev) =>
            prev?.variant === "warning" ? null : prev
          );
        }
      } catch (error) {
        if (!mounted) return;
        const { status, message } = parseError(error);
        if (status === 401) {
          navigate(`/account?view=login&redirect=/checkout`, { replace: true });
          return;
        }
        setAddresses([]);
        setAddressId("");
        setBanner({
          variant: "danger",
          message: message || "Kayıtlı adresler yüklenemedi.",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authChecked, navigate]);

  // Sepet boşsa karta geri dön
  useEffect(() => {
    if (!authChecked) return;
    if (orderPlacedRef.current) return;
    if (!loading && lines.length === 0) {
      navigate("/cart", { replace: true });
    }
  }, [authChecked, lines.length, loading, navigate]);

  useEffect(() => {
    if (!authChecked) return;

    if (paymentMethod !== "paypal") {
      setPayPalError(null);
      setPayPalSummary(null);
      paypalDraftRef.current = null;
      if (paypalButtonsRef.current) {
        paypalButtonsRef.current.close();
        paypalButtonsRef.current = null;
      }
      return;
    }

    if (!paypalEnabled) {
      setPayPalError("PayPal client ID is not configured on the frontend.");
      return;
    }

    if (!hasAddress || !hasItems) {
      setPayPalError(null);
      setPayPalSummary(null);
      paypalDraftRef.current = null;
      if (paypalButtonsRef.current) {
        paypalButtonsRef.current.close();
        paypalButtonsRef.current = null;
      }
      return;
    }

    let cancelled = false;
    setPayPalError(null);

    (async () => {
      try {
        const paypal = await loadPayPalSdk({
          clientId: paypalClientId,
          currency: paypalCurrency,
        });
        if (cancelled) return;

        if (paypalButtonsRef.current) {
          paypalButtonsRef.current.close();
          paypalButtonsRef.current = null;
        }

        const buttons = paypal.Buttons({
          style: {
            layout: "vertical",
            color: "gold",
            shape: "rect",
            label: "pay",
          },
          onInit: (_, actions) => {
            if (!canUsePayPal) {
              actions.disable();
            } else {
              actions.enable();
            }
          },
          createOrder: async () => {
            setPayPalLoading(true);
            setPayPalSummary(null);
            try {
              const response = await orderApi.createPayPal({
                addressId,
                items: checkoutItems,
                couponCode: coupon?.code || null,
              });
              if (!response?.paypalOrderId || !response?.draftId) {
                throw new Error("Invalid PayPal order response");
              }
              paypalDraftRef.current = { id: response.draftId };
              setPayPalSummary(response.summary || null);
              return response.paypalOrderId;
            } catch (error) {
              const message = getErrorMessage(
                error,
                "Unable to create PayPal order"
              );
              setPayPalError(message);
              throw new Error(message);
            } finally {
              setPayPalLoading(false);
            }
          },
          onApprove: async (data) => {
            try {
              setPlacing(true);
              const draftId = paypalDraftRef.current?.id;
              if (!draftId) {
                throw new Error("PayPal checkout session could not be found");
              }
              const result = await orderApi.capturePayPal({
                paypalOrderId: data.orderID,
                draftId,
              });
              const orderData = result?.order;
              if (!orderData?.id) {
                throw new Error("Order confirmation was not returned");
              }
              orderPlacedRef.current = true;
              setPayPalError(null);
              setPayPalSummary(null);
              paypalDraftRef.current = null;
              clearCart();
              clearCoupon();
              navigate(`/checkout/success?order=${orderData.id}`, {
                replace: true,
              });
            } catch (error) {
              const message = getErrorMessage(
                error,
                "PayPal payment could not be completed"
              );
              setBanner({
                variant: "danger",
                message: `PayPal payment failed: ${message}`,
              });
            } finally {
              setPlacing(false);
            }
          },
          onCancel: () => {
            setPayPalError("PayPal payment was cancelled.");
          },
          onError: (error) => {
            const message = getErrorMessage(
              error,
              "Beklenmeyen PayPal entegrasyon hatası"
            );
            setPayPalError(message);
          },
        });
        paypalButtonsRef.current = buttons;
        if (paypalContainerRef.current) {
          await buttons.render(paypalContainerRef.current);
        }
      } catch (error) {
        if (!cancelled) {
          setPayPalError(
            error?.message || "PayPal ödeme butonları yüklenemedi"
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (paypalButtonsRef.current) {
        paypalButtonsRef.current.close();
        paypalButtonsRef.current = null;
      }
    };
  }, [
    authChecked,
    paymentMethod,
    paypalEnabled,
    paypalClientId,
    paypalCurrency,
    hasAddress,
    hasItems,
    addressId,
    checkoutItems,
    coupon?.code,
    canUsePayPal,
    clearCart,
    clearCoupon,
    navigate,
  ]);

  if (!authChecked) {
    return null;
  }

  if (loading) {
    return (
      <section className="store-page bg-surface-light/60">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-12">
          <div className="glass-surface h-40 rounded-2xl border border-border bg-white animate-pulse" />
        </div>
      </section>
    );
  }

  const getErrorMessage = (error, fallback = "Beklenmeyen hata") => {
    const { message } = parseError(error);
    return message || fallback;
  };

  const placeOrder = async () => {
    if (!hasAddress) {
      setBanner({
        variant: "warning",
        message: "Sipariş vermeden önce teslimat adresi ekleyin.",
      });
      return;
    }
    if (!hasItems) {
      setBanner({
        variant: "warning",
        message: "Sepetiniz boş.",
      });
      return;
    }
    try {
      setPlacing(true);
      const order = await orderApi.create({
        addressId,
        items: checkoutItems,
        couponCode: coupon?.code || null,
        paymentSimulation:
          paymentMethod === "cod" ? simulationMode || null : null,
      });
      orderPlacedRef.current = true;
      clearCart();
      clearCoupon();
      navigate(`/checkout/success?order=${order.id}`, { replace: true });
    } catch (e) {
      const { status, message } = parseError(e);
      // 401 ise login’e gönder
      if (status === 401) {
        navigate(`/account?view=login&redirect=/checkout`, { replace: true });
        return;
      }
      setBanner({
        variant: "danger",
        message: `Sipariş başarısız: ${message || "Beklenmeyen hata"}`,
      });
    } finally {
      setPlacing(false);
    }
  };

  return (
    <section className="store-page bg-surface-light/60">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6">
        <BreadCrumb
          items={[{ label: "Ana Sayfa", to: "/" }, { label: "Ödeme" }]}
        />
      </div>

      {banner && (
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-2">
          <AlertBanner
            variant={banner.variant}
            message={banner.message}
            onClose={() => setBanner(null)}
          />
        </div>
      )}

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-16 grid gap-6 md:grid-cols-12">
        {/* Address / Details */}
        <div className="md:col-span-7 lg:col-span-8">
          <div className="glass-surface rounded-2xl border border-border bg-white p-6">
            <h2 className="text-xl font-semibold text-primary">
              Teslimat adresi
            </h2>

            {addresses.length === 0 ? (
              <p className="mt-3 text-secondary">
                Kayıtlı adres yok. Lütfen{" "}
                <a
                  className="text-accent underline"
                  href="/account?tab=Addresses"
                >
                  Hesabım &gt; Adresler
                </a>
                {" "}kısmından ekleyin.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className="glass-surface-soft flex gap-3 rounded-xl border border-border bg-contact-bg p-3"
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={addressId === a.id}
                      onChange={() => setAddressId(a.id)}
                    />
                    <div>
                      <div className="font-medium text-primary">
                        {a.fullName}
                      </div>
                      <div className="text-sm text-secondary whitespace-pre-line">
                        {a.addressLine ||
                          `${a.addressLine1 || ""} ${
                            a.addressLine2 || ""
                          }`.trim()}
                      </div>
                      <div className="text-sm text-secondary">
                        {a.city}
                        {a.district ? `, ${a.district}` : ""} {a.postalCode}{" "}
                        {a.country}
                      </div>
                      {a.phone && (
                        <div className="text-sm text-secondary">
                          📞 {a.phone}
                        </div>
                      )}
                      {a.isDefault && (
                        <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-200">
                          Varsayılan
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="md:col-span-5 lg:col-span-4">
          <div className="glass-surface rounded-2xl border border-border bg-white p-6">
            <h2 className="text-xl font-semibold text-primary">
              Sipariş özeti
            </h2>

            <ul className="mt-4 space-y-3 max-h-56 overflow-auto pr-1">
              {lines.map((it, idx) => (
                <li key={idx} className="flex justify-between text-sm">
                  <span className="text-primary truncate">
                    {it.name} × {it.qty}
                  </span>
                  <span className="text-secondary">
                    ₺{Number(it.unitPrice * it.qty).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-border pt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Ara toplam</span>
                <span className="text-primary">₺{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">
                  {shippingName ? `Kargo (${shippingName})` : "Kargo"}
                </span>
                <span className="text-primary">₺{shippingFee.toFixed(2)}</span>
              </div>
              {coupon && (
                <div className="flex justify-between text-rose-600">
                  <span className="text-sm">Kupon ({coupon.code})</span>
                  <span>– ₺{normalizedCouponDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold">
                <span className="text-primary">Toplam</span>
                <span className="text-primary">₺{totalDue.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-6">
            <h3 className="text-lg font-semibold text-primary">Ödeme yöntemi</h3>
            {!hasAddress && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Ödeme seçeneklerini görmek için adres ekleyin.
              </div>
            )}
            <div className="mt-3 space-y-2 text-sm text-secondary">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payment-method"
                    value="paypal"
                    checked={paymentMethod === "paypal"}
                    onChange={() => setPaymentMethod("paypal")}
                    disabled={!paypalEnabled || !hasAddress}
                  />
                  <span className="flex-1">
                    PayPal (Almanya)
                    {!paypalEnabled && (
                      <span className="ml-2 text-xs text-rose-600">
                        Etkinleştirmek için NEXT_PUBLIC_PAYPAL_CLIENT_ID değerini girin.
                      </span>
                    )}
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payment-method"
                    value="cod"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                  />
                  <span className="flex-1">Kapıda ödeme</span>
                </label>
              </div>

              {paymentMethod === "paypal" && (
                <div className="mt-4">
                  <div className="glass-surface-soft relative rounded-xl border border-border bg-surface p-4">
                    <LoadingOverlay show={paypalLoading || placing} />
                    {paypalError && (
                      <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                        {paypalError}
                      </div>
                    )}
                    {paypalSummary && (
                      <div className="mb-3 space-y-1 text-xs text-secondary">
                        <div className="flex justify-between">
                          <span>Ara toplam</span>
                          <span>
                            ₺
                            {Number(
                              paypalSummary.subtotal ?? subtotal
                            ).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Kargo</span>
                          <span>
                            ₺
                            {Number(
                              paypalSummary.shipping ?? shippingFee
                            ).toFixed(2)}
                          </span>
                        </div>
                        {paypalSummary.discountAmount > 0 && (
                          <div className="flex justify-between text-emerald-600">
                            <span>İndirim</span>
                            <span>
                              − ₺
                              {Number(
                                paypalSummary.discountAmount
                              ).toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="mt-2 flex justify-between font-semibold text-primary">
                          <span>PayPal Toplamı</span>
                          <span>
                            ₺
                            {Number(
                              paypalSummary.total ?? totalDue
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                    <div ref={paypalContainerRef} />
                    {!paypalError && (
                      <p className="mt-3 text-xs text-secondary">
                        Ödemenizi güvenli şekilde PayPal üzerinden tamamlayacaksınız.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {paymentMethod === "cod" && (
                <>
                  <div className="glass-surface-soft mt-6 rounded-xl border border-border bg-surface p-4 text-sm">
                    <p className="font-semibold text-primary">
                      Ödeme simülasyonu
                    </p>
                    <p className="mt-1 text-xs text-secondary">
                      Test amaçlı ödemelerde simülasyonun nasıl davranacağını seçin.
                    </p>
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2 text-secondary">
                        <input
                          type="radio"
                          name="simulation"
                          value="success"
                          checked={simulationMode === "success"}
                          onChange={() => setSimulationMode("success")}
                        />
                        <span>Başarılı ödeme simüle et</span>
                      </label>
                      <label className="flex items-center gap-2 text-secondary">
                        <input
                          type="radio"
                          name="simulation"
                          value="failure"
                          checked={simulationMode === "failure"}
                          onChange={() => setSimulationMode("failure")}
                        />
                        <span>Başarısız ödeme simüle et</span>
                      </label>
                    </div>
                  </div>

                  <div className="relative">
                    <LoadingOverlay show={placing} />
                    <button
                      disabled={!canPlaceOrder || placing}
                      className="mt-5 w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                      onClick={placeOrder}
                    >
                      {placing ? "Sipariş veriliyor..." : "Siparişi tamamla"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
