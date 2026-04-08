// src/pages/CheckoutPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BreadCrumb from "../components/shop/BreadCrumb";
import AlertBanner from "../components/ui/AlertBanner.jsx";
import LoadingOverlay from "../components/ui/LoadingOverlay.jsx";
import { useCart } from "../hooks/useCart";
import { userDetailsApi } from "../api/userDetails";
import { getAccessToken, refreshAccessToken } from "../api/client";

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
        if (active) setAuthChecked(true);
        return;
      }

      const refreshed = await refreshAccessToken();
      if (!active) return;

      if (refreshed) {
        setAuthChecked(true);
        return;
      }

      navigate(`/account?view=login&redirect=/checkout`, { replace: true });
    })();

    return () => {
      active = false;
    };
  }, [navigate]);

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
            Number(it.qty ?? it.quantity ?? it.count ?? it.amount ?? it.q ?? 1) ||
              1
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
              it.attribute ?? it.variant?.attribute ?? it.attributeValue ?? null,
          };

          return { kind, id, qty, variant };
        })
        .filter(Boolean),
    [itemsRaw]
  );

  const lines = useMemo(
    () =>
      itemsRaw.map((it) => {
        const qty =
          Number(it.qty ?? it.quantity ?? it.count ?? it.amount ?? it.q ?? 1) || 1;

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
          it.name ?? it.title ?? it.product?.name ?? it.set?.name ?? "Ürün";

        return {
          name,
          qty,
          unitPrice,
          lineTotal:
            Number(it?.pricing?.lineTotalBeforeCoupon) || unitPrice * qty,
        };
      }),
    [itemsRaw]
  );

  const computedSubtotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.lineTotal || 0), 0),
    [lines]
  );
  const subtotal = Number(subTotal ?? computedSubtotal) || 0;
  const shippingFee = Number(shippingInfo?.fee ?? 0) || 0;
  const shippingName = shippingInfo?.name || "Kargo";
  const normalizedCouponDiscount = Number(couponDiscount) || 0;
  const standardDiscountAmount = Number(pricing?.standardDiscountAmount || 0) || 0;
  const stackedDiscountAmount = Number(pricing?.stackedDiscountAmount || 0) || 0;
  const couponApplicable = coupon
    ? couponApplicableRaw ?? subtotal >= Number(coupon.minSubtotal || 0)
    : false;
  const derivedTotal = Math.max(0, subtotal + shippingFee - normalizedCouponDiscount);
  const totalDue = Number.isFinite(Number(grandTotal))
    ? Number(grandTotal)
    : Number.isFinite(Number(total))
      ? Number(total)
      : derivedTotal;

  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState("");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  const hasItems = checkoutItems.length > 0;
  const hasAddress = Boolean(addressId);

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
  }, [authChecked, navigate]);

  useEffect(() => {
    if (!authChecked) return;
    if (!loading && lines.length === 0) {
      navigate("/cart", { replace: true });
    }
  }, [authChecked, lines.length, loading, navigate]);

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

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-32 md:pb-16 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-8">
          <div className="glass-surface rounded-2xl border border-border bg-white p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-primary">Teslimat adresi</h2>

            {addresses.length === 0 ? (
              <p className="mt-3 text-secondary">
                Kayıtlı adres yok. Lütfen{" "}
                <a className="text-accent underline" href="/account?tab=Addresses">
                  Hesabım &gt; Adresler
                </a>
                {" "}kısmından ekleyin.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {addresses.map((a) => (
                  <label
                    key={a.id}
                    className="glass-surface-soft flex items-start gap-3 rounded-xl border border-border bg-contact-bg p-3 sm:p-4"
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={addressId === a.id}
                      onChange={() => setAddressId(a.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 break-words">
                      <div className="font-medium text-primary">{a.fullName}</div>
                      <div className="text-sm text-secondary whitespace-pre-line">
                        {a.addressLine ||
                          `${a.addressLine1 || ""} ${a.addressLine2 || ""}`.trim()}
                      </div>
                      <div className="text-sm text-secondary">
                        {a.city}
                        {a.district ? `, ${a.district}` : ""} {a.postalCode} {a.country}
                      </div>
                      {a.phone && (
                        <div className="text-sm text-secondary">📞 {a.phone}</div>
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

        <div className="lg:col-span-5 xl:col-span-4">
          <div className="glass-surface rounded-2xl border border-border bg-white p-4 sm:p-6 lg:sticky lg:top-[calc(var(--header-height)+1rem)]">
            <h2 className="text-xl font-semibold text-primary">Sipariş özeti</h2>

            <ul className="mt-4 max-h-48 space-y-3 overflow-auto pr-1 sm:max-h-56">
              {lines.map((it, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 text-primary truncate">
                    {it.name} × {it.qty}
                  </span>
                  <span className="shrink-0 text-secondary">
                    ₺{Number(it.lineTotal || 0).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-border pt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">Ara toplam</span>
                <span className="text-primary">₺{Number(baseSubtotal || subtotal).toFixed(2)}</span>
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
              <div className="flex justify-between text-base font-semibold">
                <span className="text-primary">Toplam</span>
                <span className="text-primary">₺{totalDue.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-primary">Ödeme</h3>
              {!hasAddress && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Sipariş işlemi için önce adres ekleyin.
                </div>
              )}

              <div className="glass-surface-soft mt-4 rounded-xl border border-border bg-surface p-4 text-sm">
                <p className="font-semibold text-primary">
                  Ödeme entegrasyonu yenileniyor
                </p>
                <p className="mt-1 text-xs text-secondary">
                  Iyzico kurulumu öncesi eski ödeme akışı tamamen devre dışı
                  bırakıldı. Bu ekranda adres ve sepet kontrolü yapılabilir ama
                  sipariş oluşturulmaz.
                </p>
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                  Ödeme altyapısı hazır olduğunda checkout yeniden açılacak.
                </div>
              </div>

              <div className="relative">
                <LoadingOverlay show={false} />
                <button
                  disabled
                  className="mt-5 w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Ödeme entegrasyonu hazırlanıyor
                </button>
              </div>

              <p className="mt-3 text-xs text-secondary">
                Iyzico kurulumu tamamlanana kadar checkout kapalı kalacak.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-40 lg:hidden">
        <div className="glass-surface rounded-2xl border border-border bg-white/95 p-3 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-secondary/70">
                Toplam
              </p>
              <p className="truncate text-base font-semibold text-primary">
                ₺{totalDue.toFixed(2)}
              </p>
            </div>
            <button
              disabled
              className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Ödeme hazırlanıyor
            </button>
          </div>
          {!hasAddress && (
            <p className="mt-2 text-xs text-amber-700">
              Sipariş işlemi için önce adres ekleyin.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
