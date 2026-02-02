import { useEffect, useMemo, useState } from "react";
import { CartContext } from "./CartContext";
import { shippingApi } from "../api/shipping";
import { couponApi } from "../api/coupons";

// Varyantları ayırt eden benzersiz satır anahtarı
function makeLineId(
  id,
  { color = null, size = null, attribute = null, items = null } = {}
) {
  // ürün hattı (eski davranış)
  if (!items || !Array.isArray(items) || items.length === 0) {
    const c = color ?? "";
    const s = size ?? "";
    const a = attribute ?? "";
    return `${id}|${c}|${s}|${a}`;
  }
  // set hattı — deterministik sıralama ile anahtar
  const sorted = [...items].sort((a, b) => {
    const key = (x) =>
      [
        String(x.productId || ""),
        String(x.color || ""),
        String(x.size || ""),
        String(x.attribute || ""),
        String(x.qtyInSet || 1),
      ].join("\u0001");
    return key(a).localeCompare(key(b));
  });

  const key = sorted
    .map((it) =>
      [
        it.productId || "",
        it.color || "",
        it.size || "",
        it.attribute || "",
        it.qtyInSet || 1,
      ].join("~")
    )
    .join("|");
  return `${id}||SET||${key}`;
}

function normalizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const base = { ...raw };
  const kind = (raw.kind || raw.type || "product").toLowerCase();
  const idCandidate =
    raw.id || raw.productId || raw.setId || raw._id || raw.ref || null;
  const id = idCandidate ? String(idCandidate) : null;
  if (!id) return null;

  base.id = id;
  base.kind = kind === "set" ? "set" : "product";
  base.productId = base.kind === "product" ? id : null;
  base.setId = base.kind === "set" ? id : null;

  return base;
}

export default function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      if (typeof window === "undefined") return [];
      const stored = window.localStorage.getItem("cart");
      const parsed = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => {
          const normalized = normalizeItem(item);
          if (!normalized) return null;
          const original = Number(
            normalized.originalPrice || normalized.price || 0
          );
          normalized.originalPrice = original;
          normalized.price = Number(normalized.price || original);
          return normalized;
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  });
  const [shippingConfig, setShippingConfig] = useState({
    name: "Standard Shipping",
    fee: 0,
    freeThreshold: 0,
  });
  const [shippingLoading, setShippingLoading] = useState(true);
  const [coupon, setCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const config = await shippingApi.getConfig();
        if (mounted && config) setShippingConfig(config);
      } catch {
        if (mounted) {
          setShippingConfig({
            name: "Standard Shipping",
            fee: 0,
            freeThreshold: 0,
          });
        }
      } finally {
        if (mounted) setShippingLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Ekle
  const addToCart = (product, options = {}) => {
    setItems((prev) => {
      const lineId = makeLineId(product.id, options);
      const existing = prev.find((it) => it.lineId === lineId);

      if (existing) {
        return prev.map((it) =>
          it.lineId === lineId
            ? {
                ...it,
                qty: Math.min(999, (it.qty || 0) + (options.qty || 1)),
              }
            : it
        );
      }

      const kind = (options.kind || product.kind || "product").toLowerCase();
      const rawId =
        product.id || product._id || product.slug || options.productId;
      const baseId = rawId ? String(rawId) : null;
      if (!baseId) return prev;

      const newItem = {
        lineId,
        id: baseId,
        title: product.name || product.title,
        image: product.images?.[0]?.url || "/pd-1.jpg",
        price: Number(product.finalPrice ?? product.price) || 0,
        originalPrice: Number(product.price ?? product.finalPrice ?? 0) || 0,
        qty: options.qty || 1,
        color: options.color || null,
        colorHex: options.colorHex || null,
        size: options.size || null,
        attribute: options.attribute || null,
        kind,
        productId: null,
        setId: null,
      };

      if (kind === "set") {
        newItem.kind = "set";
        newItem.setId = String(options.setId || baseId);
        newItem.productId = null;
        // set seçimleri
        newItem.items = Array.isArray(options.items) ? options.items : [];
      } else {
        newItem.kind = "product";
        newItem.productId = String(options.productId || baseId);
        newItem.setId = null;
      }

      return [...prev, newItem];
    });
  };

  // Sil
  const removeFromCart = (lineId) =>
    setItems((prev) => prev.filter((it) => it.lineId !== lineId));

  // Miktar değiştir
  const updateQty = (lineId, qty) =>
    setItems((prev) =>
      prev.map((it) =>
        it.lineId === lineId
          ? { ...it, qty: Math.max(1, Number(qty) || 1) }
          : it
      )
    );

  const clearCart = () => setItems([]);

  const totalItems = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0),
    [items]
  );
  const subTotal = useMemo(
    () =>
      items.reduce(
        (sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0),
        0
      ),
    [items]
  );

  const freeThreshold = Number(shippingConfig?.freeThreshold || 0);
  const baseShippingFee = Math.max(0, Number(shippingConfig?.fee || 0));

  const shippingFee = useMemo(() => {
    if (subTotal <= 0) return 0;
    if (freeThreshold > 0 && subTotal >= freeThreshold) return 0;
    return baseShippingFee;
  }, [subTotal, freeThreshold, baseShippingFee]);

  const total = useMemo(() => subTotal + shippingFee, [subTotal, shippingFee]);

  const couponDiscount = useMemo(() => {
    if (!coupon) return 0;
    if (subTotal < (coupon.minSubtotal || 0)) return 0;
    return Math.round(((subTotal * coupon.percentage) / 100) * 100) / 100;
  }, [coupon, subTotal]);

  const grandTotal = useMemo(
    () => Math.max(0, total - couponDiscount),
    [total, couponDiscount]
  );

  useEffect(() => {
    if (coupon) {
      const minRequired = Number(coupon.minSubtotal || 0);
      if (subTotal < minRequired) {
        setCouponMessage(
          `Minimum subtotal for ${coupon.code} is €${minRequired.toFixed(2)}`
        );
      } else {
        setCouponMessage(null);
      }
    }
  }, [coupon, subTotal]);

  const refreshShipping = async () => {
    try {
      const config = await shippingApi.getConfig();
      setShippingConfig(config);
      return config;
    } catch (error) {
      setShippingConfig((prev) => prev);
      throw error;
    }
  };

  const applyCoupon = async (code) => {
    const normalized = String(code || "").trim();
    if (!normalized) {
      setCoupon(null);
      setCouponMessage("Coupon code is required");
      throw new Error("Coupon code is required");
    }
    setCouponMessage(null);
    try {
      const applied = await couponApi.apply({
        code: normalized,
        subtotal: subTotal,
      });
      setCoupon(applied);
      return applied;
    } catch (error) {
      let message = error?.message || "Unable to apply coupon";
      try {
        const parsed = JSON.parse(error.message);
        message = parsed?.message || message;
      } catch {
        // ignore parse error
      }
      setCoupon(null);
      setCouponMessage(message);
      throw new Error(message);
    }
  };

  const clearCoupon = () => {
    setCoupon(null);
    setCouponMessage(null);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        totalItems,
        subTotal,
        total,
        coupon,
        couponMessage,
        couponDiscount,
        grandTotal,
        applyCoupon,
        clearCoupon,
        shipping: {
          name: shippingConfig?.name || "Standard Shipping",
          fee: shippingFee,
          baseFee: baseShippingFee,
          freeThreshold,
          loading: shippingLoading,
          isFree: shippingFee === 0 && subTotal > 0,
        },
        refreshShipping,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
