"use client";

// src/pages/CheckoutPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import BreadCrumb from "../components/shop/BreadCrumb";
import AlertBanner from "../components/ui/AlertBanner.jsx";
import LoadingOverlay from "../components/ui/LoadingOverlay.jsx";
import { useCart } from "../hooks/useCart";
import { userDetailsApi } from "../api/userDetails";
import { getAccessToken, refreshAccessToken } from "../api/client";
import { paymentApi } from "../api/payments";
import {
  formatTrPhoneForInput,
  formatTrPhoneForSubmit,
} from "../utils/phoneMask.js";

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

function emptyGuestCheckoutForm() {
  return {
    fullName: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Türkiye",
  };
}

function buildGuestAddressSnapshot(form) {
  return {
    fullName: String(form?.fullName || "").trim(),
    phone: formatTrPhoneForSubmit(form?.phone || ""),
    country: String(form?.country || "").trim(),
    city: String(form?.city || "").trim(),
    district: String(form?.state || "").trim(),
    postalCode: String(form?.postalCode || "").trim(),
    addressLine: String(
      [form?.addressLine1, form?.addressLine2]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .join(" ")
    ),
  };
}

function buildGuestCustomerSnapshot(form) {
  return {
    fullName: String(form?.fullName || "").trim(),
    email: String(form?.email || "").trim().toLowerCase(),
    phone: formatTrPhoneForSubmit(form?.phone || ""),
  };
}

function isGuestCheckoutReady(form) {
  const address = buildGuestAddressSnapshot(form);
  const customer = buildGuestCustomerSnapshot(form);
  return Boolean(
    customer.fullName &&
      customer.email &&
      customer.phone &&
      address.country &&
      address.city &&
      address.addressLine
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState("checking");

  const cart = useCart() || {};
  const {
    items: itemsRaw = [],
    baseSubtotal = 0,
    subTotal = 0,
    total = 0,
    grandTotal = 0,
    coupon = null,
    couponApplicable: couponApplicableRaw,
    couponDiscount = 0,
    pricing = {},
    shipping: shippingInfo = {},
  } = cart;

  useEffect(() => {
    let active = true;

    (async () => {
      const token = getAccessToken();
      if (token) {
        if (active) setAuthState("authenticated");
        return;
      }

      const refreshed = await refreshAccessToken();
      if (!active) return;

      if (refreshed) {
        setAuthState("authenticated");
        return;
      }

      setAuthState("guest-choice");
    })();

    return () => {
      active = false;
    };
  }, []);

  const checkoutItems = useMemo(
    () =>
      itemsRaw
        .map((it) => {
          const rawKind =
            it.kind ||
            (it.productId ? "product" : it.setId ? "set" : undefined);
          const kind = rawKind === "set" ? "set" : "product";

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

          const qty = Math.max(
            1,
            Number(
              it.qty ?? it.quantity ?? it.count ?? it.amount ?? it.q ?? 1,
            ) || 1,
          );

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
                    };
                  })
                  .filter(Boolean)
              : [];

            return { kind, id, qty, selections };
          }

          const variant = {
            color: it.color ?? it.variant?.color ?? it.selectedColor ?? null,
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
    [itemsRaw],
  );

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
              0,
          ) || 0;

        const name =
          it.name ?? it.title ?? it.product?.name ?? it.set?.name ?? "Ürün";

        return {
          name,
          qty,
          unitPrice,
          lineTotal:
            Number(it?.pricing?.lineTotalBeforeCoupon) || unitPrice * qty,
        };
      }),
    [itemsRaw],
  );

  const computedSubtotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.lineTotal || 0), 0),
    [lines],
  );
  const subtotal = Number(subTotal ?? computedSubtotal) || 0;
  const shippingFee = Number(shippingInfo?.fee ?? 0) || 0;
  const shippingName = shippingInfo?.name || "Kargo";
  const normalizedCouponDiscount = Number(couponDiscount) || 0;
  const standardDiscountAmount =
    Number(pricing?.standardDiscountAmount || 0) || 0;
  const stackedDiscountAmount =
    Number(pricing?.stackedDiscountAmount || 0) || 0;
  const couponApplicable = coupon
    ? (couponApplicableRaw ?? subtotal >= Number(coupon.minSubtotal || 0))
    : false;
  const derivedTotal = Math.max(
    0,
    subtotal + shippingFee - normalizedCouponDiscount,
  );
  const totalDue = Number.isFinite(Number(grandTotal))
    ? Number(grandTotal)
    : Number.isFinite(Number(total))
      ? Number(total)
      : derivedTotal;

  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState("");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);
  const [identityNumber, setIdentityNumber] = useState("");
  const [identityInfoOpen, setIdentityInfoOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const identityInfoRef = useRef(null);
  const [guestForm, setGuestForm] = useState(() => emptyGuestCheckoutForm());

  const hasItems = checkoutItems.length > 0;
  const isAuthenticated = authState === "authenticated";
  const isGuestCheckout = authState === "guest";
  const hasAddress = isAuthenticated
    ? Boolean(addressId)
    : isGuestCheckoutReady(guestForm);

  async function handleCheckout() {
    if (!hasItems || !hasAddress || submitting) return;
    try {
      setSubmitting(true);
      setBanner(null);
      const response = await paymentApi.initializeIyzicoCheckout({
        addressId: isAuthenticated ? addressId : null,
        addressSnapshot: isGuestCheckout
          ? buildGuestAddressSnapshot(guestForm)
          : null,
        guestCustomer: isGuestCheckout
          ? buildGuestCustomerSnapshot(guestForm)
          : null,
        items: checkoutItems,
        couponCode: isAuthenticated ? coupon?.code || null : null,
        identityNumber: identityNumber.trim() || null,
        auth: isAuthenticated,
      });

      const checkoutUrl = String(response?.payment?.checkoutUrl || "").trim();
      if (!checkoutUrl) {
        throw new Error("Iyzico ödeme sayfası alınamadı");
      }

      if (typeof window !== "undefined") {
        window.location.assign(checkoutUrl);
      }
    } catch (error) {
      const { message } = parseError(error);
      setBanner({
        variant: "danger",
        message: message || "Ödeme sayfası başlatılamadı.",
      });
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
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
                },
          );
        } else {
          setBanner((prev) => (prev?.variant === "warning" ? null : prev));
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
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (authState === "checking") return;
    if (!loading && lines.length === 0) {
      navigate("/cart", { replace: true });
    }
  }, [authState, lines.length, loading, navigate]);

  useEffect(() => {
    if (!identityInfoOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!identityInfoRef.current?.contains(event.target)) {
        setIdentityInfoOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIdentityInfoOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [identityInfoOpen]);

  if (authState === "checking") {
    return null;
  }

  if (isAuthenticated && loading) {
    return (
      <section className="store-page bg-surface-light/60">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-12">
          <div className="glass-surface h-40 rounded-2xl border border-border bg-white animate-pulse" />
        </div>
      </section>
    );
  }

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

      <div className="mx-auto grid max-w-[1400px] gap-5 px-4 pb-36 sm:px-6 md:gap-6 md:pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:items-start xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5 md:space-y-6">
          <div className="glass-surface rounded-[28px] border border-border bg-white p-5 sm:p-6">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-primary">
              {isAuthenticated
                ? "Teslimat adresi"
                : authState === "guest-choice"
                  ? "Devam et"
                  : "Teslimat ve iletişim bilgileri"}
            </h2>

            {!isAuthenticated ? (
              authState === "guest-choice" ? (
                <div className="mt-5 space-y-4">
                  <p className="text-sm leading-6 text-secondary">
                    Siparişe devam etmek için giriş yapabilir veya misafir
                    olarak ödeme adımına geçebilirsiniz.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/account?view=login&redirect=${encodeURIComponent(
                            "/checkout"
                          )}`
                        )
                      }
                      className="rounded-2xl border border-border bg-white px-4 py-4 text-sm font-semibold text-primary transition hover:border-accent/35 hover:bg-surface-hover"
                    >
                      Giriş yap
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthState("guest");
                        setBanner(null);
                      }}
                      className="rounded-2xl bg-accent px-4 py-4 text-sm font-semibold text-white transition hover:bg-accent-hover"
                    >
                      Misafir olarak devam et
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm leading-6 text-secondary">
                      Misafir ödeme için teslimat ve iletişim bilgilerinizi girin.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/account?view=login&redirect=${encodeURIComponent(
                            "/checkout"
                          )}`
                        )
                      }
                      className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-surface-hover"
                    >
                      Giriş yap
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-primary">
                        Ad Soyad
                      </span>
                      <input
                        value={guestForm.fullName}
                        onChange={(event) =>
                          setGuestForm((prev) => ({
                            ...prev,
                            fullName: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-sm text-primary outline-none"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-primary">
                        E-posta
                      </span>
                      <input
                        type="email"
                        value={guestForm.email}
                        onChange={(event) =>
                          setGuestForm((prev) => ({
                            ...prev,
                            email: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-sm text-primary outline-none"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-primary">
                        Telefon
                      </span>
                      <input
                        value={guestForm.phone}
                        onChange={(event) =>
                          setGuestForm((prev) => ({
                            ...prev,
                            phone: formatTrPhoneForInput(event.target.value),
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-sm text-primary outline-none"
                        inputMode="numeric"
                        autoComplete="tel"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-primary">
                        Ülke
                      </span>
                      <input
                        value={guestForm.country}
                        onChange={(event) =>
                          setGuestForm((prev) => ({
                            ...prev,
                            country: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-sm text-primary outline-none"
                        required
                      />
                    </label>

                    <label className="sm:col-span-2 block">
                      <span className="mb-1 block text-sm font-medium text-primary">
                        Adres Satırı 1
                      </span>
                      <input
                        value={guestForm.addressLine1}
                        onChange={(event) =>
                          setGuestForm((prev) => ({
                            ...prev,
                            addressLine1: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-sm text-primary outline-none"
                        required
                      />
                    </label>

                    <label className="sm:col-span-2 block">
                      <span className="mb-1 block text-sm font-medium text-primary">
                        Adres Satırı 2
                      </span>
                      <input
                        value={guestForm.addressLine2}
                        onChange={(event) =>
                          setGuestForm((prev) => ({
                            ...prev,
                            addressLine2: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-sm text-primary outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-primary">
                        Şehir
                      </span>
                      <input
                        value={guestForm.city}
                        onChange={(event) =>
                          setGuestForm((prev) => ({
                            ...prev,
                            city: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-sm text-primary outline-none"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-primary">
                        İl / İlçe
                      </span>
                      <input
                        value={guestForm.state}
                        onChange={(event) =>
                          setGuestForm((prev) => ({
                            ...prev,
                            state: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-sm text-primary outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-primary">
                        Posta Kodu
                      </span>
                      <input
                        value={guestForm.postalCode}
                        onChange={(event) =>
                          setGuestForm((prev) => ({
                            ...prev,
                            postalCode: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-sm text-primary outline-none"
                      />
                    </label>
                  </div>
                </div>
              )
            ) : addresses.length === 0 ? (
              <p className="mt-3 text-secondary">
                Kayıtlı adres yok. Lütfen{" "}
                <a
                  className="text-accent underline"
                  href="/account?tab=Addresses"
                >
                  Hesabım &gt; Adresler
                </a>{" "}
                kısmından ekleyin.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className="glass-surface-soft flex items-start gap-3 rounded-2xl border border-border bg-contact-bg px-4 py-4 transition hover:border-accent/25"
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={addressId === a.id}
                      onChange={() => setAddressId(a.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 break-words">
                      <div className="font-medium leading-6 text-primary">
                        {a.fullName}
                      </div>
                      <div className="mt-1 text-sm leading-6 text-secondary whitespace-pre-line">
                        {a.addressLine ||
                          `${a.addressLine1 || ""} ${a.addressLine2 || ""}`.trim()}
                      </div>
                      <div className="text-sm leading-6 text-secondary">
                        {a.city}
                        {a.district ? `, ${a.district}` : ""} {a.postalCode}{" "}
                        {a.country}
                      </div>
                      {a.phone && (
                        <div className="text-sm leading-6 text-secondary">
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

          <div className="glass-surface rounded-[28px] border border-border bg-white p-5 sm:p-6">
            <div className="relative" ref={identityInfoRef}>
              <input
                id="checkout-identity-number"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="T.C. Kimlik Numarası"
                value={identityNumber}
                onChange={(event) =>
                  setIdentityNumber(
                    String(event.target.value || "")
                      .replace(/\D+/g, "")
                      .slice(0, 11),
                  )
                }
                className="w-full rounded-2xl border border-border bg-white px-4 py-3.5 pr-14 text-sm text-primary outline-none transition placeholder:text-secondary/70 focus:border-accent/60 focus:ring-2 focus:ring-accent/15"
              />
              <button
                type="button"
                aria-label="TC kimlik numarası bilgilendirmesi"
                aria-expanded={identityInfoOpen}
                aria-controls="checkout-identity-tooltip"
                onClick={() => setIdentityInfoOpen((prev) => !prev)}
                className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-secondary transition hover:border-accent/40 hover:bg-white hover:text-primary"
              >
                <Info className="h-4 w-4" />
              </button>
              {identityInfoOpen && (
                <div
                  id="checkout-identity-tooltip"
                  role="dialog"
                  aria-modal="false"
                  className="absolute right-0 top-[calc(100%+12px)] z-20 w-[min(320px,calc(100vw-4rem))] rounded-2xl border border-border bg-white p-4 text-sm leading-6 text-secondary shadow-xl sm:w-80"
                >
                  <div className="absolute right-5 top-0 h-3 w-3 -translate-y-1/2 rotate-45 border-l border-t border-border bg-white" />
                  Kimlik numaranızı ödeme akışı için kullanacağız. Dilerseniz
                  boş bırakabilirsiniz, bu durumda <code>11111111111</code>{" "}
                  olarak gönderilecektir. Kimlik bilgilerinizi kaydetmiyoruz.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-surface rounded-[28px] border border-border bg-white p-5 sm:p-6 lg:self-start">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-primary">
              Sipariş özeti
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-600">
              Ödeme
            </span>
          </div>

          <ul className="mt-5 max-h-48 divide-y divide-border/70 overflow-auto pr-1 sm:max-h-56">
            {lines.map((it, idx) => (
              <li
                key={idx}
                className="flex items-start justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0"
              >
                <span className="min-w-0 flex-1 leading-6 text-primary truncate">
                  {it.name} × {it.qty}
                </span>
                <span className="shrink-0 pt-0.5 text-secondary">
                  ₺{Number(it.lineTotal || 0).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-2xl border border-border/80 bg-surface/60 p-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-secondary">Ara toplam</span>
                <span className="text-primary">
                  ₺{Number(baseSubtotal || subtotal).toFixed(2)}
                </span>
              </div>
              {standardDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span className="text-sm">Normal indirim</span>
                  <span>– ₺{standardDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              {stackedDiscountAmount > 0 && (
                <div className="flex justify-between text-sky-700">
                  <span className="text-sm">Katlanan indirim</span>
                  <span>– ₺{stackedDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-secondary">
                  {shippingName ? `Kargo (${shippingName})` : "Kargo"}
                </span>
                <span className="text-primary">₺{shippingFee.toFixed(2)}</span>
              </div>
              {coupon && couponApplicable && (
                <div className="flex justify-between text-rose-600">
                  <span className="text-sm">Kupon ({coupon.code})</span>
                  <span>– ₺{normalizedCouponDiscount.toFixed(2)}</span>
                </div>
              )}
              {coupon && !couponApplicable && (
                <div className="flex justify-between text-amber-700">
                  <span className="text-sm">Kupon ({coupon.code})</span>
                  <span>Koşul sağlanmadı</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border/80 pt-3 text-base font-semibold">
                <span className="text-primary">Toplam</span>
                <span className="text-primary">₺{totalDue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-primary">
              Ödeme
            </h3>
            {!hasAddress && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {isAuthenticated
                  ? "Sipariş işlemi için önce adres ekleyin."
                  : authState === "guest-choice"
                    ? "Siparişe devam etmek için giriş yapın veya misafir ödeme seçeneğini seçin."
                    : "Sipariş işlemi için teslimat ve iletişim bilgilerini eksiksiz doldurun."}
              </div>
            )}

            <div className="relative">
              <LoadingOverlay show={submitting} />
              <button
                type="button"
                onClick={handleCheckout}
                disabled={!hasItems || !hasAddress || submitting}
                className="mt-1 w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(14,165,233,0.22)] transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                {submitting
                  ? "Iyzico sayfasina yonlendiriliyor..."
                  : "Güvenli Ödeme"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-40 lg:hidden">
        <div className="glass-surface rounded-[26px] border border-border bg-white/95 p-3 shadow-[0_18px_45px_rgba(15,23,42,0.18)] backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-secondary/70">
                Toplam
              </p>
              <p className="truncate text-base font-semibold text-primary">
                ₺{totalDue.toFixed(2)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={!hasItems || !hasAddress || submitting}
              className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(14,165,233,0.22)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {submitting ? "Yonlendiriliyor..." : "Güvenli Ödeme"}
            </button>
          </div>
          {!hasAddress && (
            <p className="mt-2 text-xs text-amber-700">
              {isAuthenticated
                ? "Sipariş işlemi için önce adres ekleyin."
                : authState === "guest-choice"
                  ? "Devam etmek için giriş yapın veya misafir ödeme seçeneğini seçin."
                  : "Sipariş işlemi için teslimat ve iletişim bilgilerini tamamlayın."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
