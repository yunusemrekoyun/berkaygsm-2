import { useEffect, useMemo, useState } from "react";
import { CartContext } from "./CartContext";
import { shippingApi } from "../api/shipping";
import { couponApi } from "../api/coupons";
import {
  stackedDiscountApi,
  STACKED_DISCOUNT_UPDATED_EVENT,
} from "../api/stackedDiscount";
import {
  buildNextStackedTierMessage,
  calculateCartPricing,
} from "../utils/pricingEngine.js";

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

function normalizeValue(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function normalizeQty(value, fallback = 1) {
  const qty = Number(value);
  if (!Number.isFinite(qty)) return fallback;
  return Math.max(1, Math.floor(qty));
}

function normalizeStockLimit(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.max(0, Math.floor(amount));
}

function resolveProductStockLimit(product, options = {}) {
  const inventory = Array.isArray(product?.inventory) ? product.inventory : [];
  if (inventory.length > 0) {
    const match = inventory.find((item) => {
      return (
        normalizeValue(item?.color) === normalizeValue(options.color) &&
        normalizeValue(item?.size) === normalizeValue(options.size) &&
        normalizeValue(item?.attributeValue) === normalizeValue(options.attribute)
      );
    });

    if (!match) return 0;
    return normalizeStockLimit(match.stock);
  }

  const directStock = normalizeStockLimit(
    options.stockLimit ?? product?.stock ?? product?.qtyOnHand
  );
  if (directStock !== null) return directStock;
  if (product?.inStock === false) return 0;
  return null;
}

function resolveSetStockLimit(setDoc, options = {}) {
  return normalizeStockLimit(options.stockLimit ?? setDoc?.stock);
}

function normalizeIdList(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => {
          if (!value) return "";
          if (typeof value === "string") return value.trim();
          if (typeof value === "number") return String(value);
          if (typeof value === "object") {
            if (typeof value.id === "string") return value.id.trim();
            if (typeof value._id === "string") return value._id.trim();
          }
          return "";
        })
        .filter(Boolean)
    )
  );
}

function normalizeStoredDiscount(discount) {
  if (!discount || typeof discount !== "object") return null;
  const percentage = Number(discount.percentage || 0);
  if (!Number.isFinite(percentage) || percentage <= 0) return null;
  return {
    id: discount.id || discount._id || null,
    name: discount.name || "",
    percentage,
    allowCouponStacking: discount.allowCouponStacking !== false,
    allowStackedDiscountStacking:
      discount.allowStackedDiscountStacking !== false,
  };
}

function collectProductCategoryIds(product) {
  if (!product) return [];
  const category = product.category;
  const values = [];
  const mainId =
    category?.id ||
    category?._id ||
    (typeof category === "string" ? category : null);
  if (mainId) values.push(mainId);
  if (Array.isArray(category?.ancestors)) {
    category.ancestors.forEach((ancestor) => {
      const ancestorId =
        ancestor?.id ||
        ancestor?._id ||
        (typeof ancestor === "string" ? ancestor : null);
      if (ancestorId) values.push(ancestorId);
    });
  }
  return normalizeIdList(values);
}

function sumScopedQty(items, candidate) {
  if (candidate.kind === "set") {
    const setId = String(candidate.setId || candidate.id || "");
    return items.reduce((sum, item) => {
      const sameSet =
        item?.kind === "set" && String(item?.setId || item?.id || "") === setId;
      return sameSet ? sum + (Number(item?.qty) || 0) : sum;
    }, 0);
  }

  return items.reduce((sum, item) => {
    return item?.lineId === candidate.lineId ? sum + (Number(item?.qty) || 0) : sum;
  }, 0);
}

function readStoredCart() {
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
          normalized.basePrice ??
            normalized.originalPrice ??
            normalized.price ??
            0
        );
        normalized.basePrice = original;
        normalized.originalPrice = original;
        normalized.price = Number(normalized.price || original);
        normalized.discountMeta = normalizeStoredDiscount(
          normalized.discountMeta || normalized.standardDiscount || null
        );
        normalized.categoryIds = normalizeIdList(
          normalized.categoryIds?.length
            ? normalized.categoryIds
            : [
                normalized.categoryId,
                ...(normalized.categoryAncestorIds || []),
                normalized.category,
                ...(Array.isArray(normalized.category?.ancestors)
                  ? normalized.category.ancestors
                  : []),
              ]
        );
        normalized.maxQty = normalizeStockLimit(normalized.maxQty);
        if (normalized.maxQty !== null) {
          normalized.qty = Math.min(
            normalizeQty(normalized.qty),
            Math.max(1, normalized.maxQty)
          );
        } else {
          normalized.qty = normalizeQty(normalized.qty);
        }
        return normalized;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export default function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [shippingConfig, setShippingConfig] = useState({
    name: "Standart Kargo",
    fee: 0,
    freeThreshold: 0,
  });
  const [shippingLoading, setShippingLoading] = useState(true);
  const [coupon, setCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState(null);
  const [couponInputVisible, setCouponInputVisible] = useState(true);
  const [stackedDiscountConfig, setStackedDiscountConfig] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    setItems(readStoredCart());
    setCartHydrated(true);
    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !cartHydrated) return;
    window.localStorage.setItem("cart", JSON.stringify(items));
  }, [cartHydrated, items]);

  useEffect(() => {
    if (!items.length) {
      setStackedDiscountConfig(null);
      return undefined;
    }

    let mounted = true;

    const syncStackedDiscount = async () => {
      try {
        const config = await stackedDiscountApi.getPublic();
        if (mounted) setStackedDiscountConfig(config);
      } catch {
        if (mounted) setStackedDiscountConfig(null);
      }
    };

    const handleFocus = () => {
      void syncStackedDiscount();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncStackedDiscount();
      }
    };
    const handleStackedDiscountUpdated = () => {
      void syncStackedDiscount();
    };

    void syncStackedDiscount();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(
      STACKED_DISCOUNT_UPDATED_EVENT,
      handleStackedDiscountUpdated
    );

    return () => {
      mounted = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(
        STACKED_DISCOUNT_UPDATED_EVENT,
        handleStackedDiscountUpdated
      );
    };
  }, [items.length]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const config = await shippingApi.getConfig();
        if (mounted && config) setShippingConfig(config);
      } catch {
        if (mounted) {
          setShippingConfig({
            name: "Standart Kargo",
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const config = await couponApi.getConfig();
        if (mounted && config) {
          setCouponInputVisible(config.cartInputVisible !== false);
        }
      } catch {
        if (mounted) setCouponInputVisible(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Ekle
  const addToCart = (product, options = {}) => {
    setItems((prev) => {
      const kind = (options.kind || product.kind || "product").toLowerCase();
      const rawId =
        product.id ||
        product._id ||
        product.slug ||
        options.productId ||
        options.setId ||
        null;
      const baseId = rawId ? String(rawId) : null;
      if (!baseId) return prev;

      const lineId = makeLineId(baseId, options);
      const existing = prev.find((it) => it.lineId === lineId);
      const stockLimit =
        kind === "set"
          ? resolveSetStockLimit(product, options)
          : resolveProductStockLimit(product, options);
      const requestedQty = normalizeQty(options.qty || 1);
      const scopedQty = sumScopedQty(prev, {
        kind,
        id: baseId,
        setId: options.setId || baseId,
        lineId,
      });
      const allowedAdditional =
        stockLimit === null ? requestedQty : Math.max(0, stockLimit - scopedQty);

      if (allowedAdditional <= 0) return prev;

      const qtyToAdd = Math.min(requestedQty, allowedAdditional);

      if (existing) {
        return prev.map((it) =>
          it.lineId === lineId
            ? {
                ...it,
                qty: Math.min(999, (it.qty || 0) + qtyToAdd),
                maxQty: stockLimit ?? it.maxQty ?? null,
              }
            : it
        );
      }

      const newItem = {
        lineId,
        id: baseId,
        title: product.name || product.title,
        image: product.images?.[0]?.url || "/pd-1.jpg",
        slug: product.slug || null,
        basePrice: Number(product.price ?? product.finalPrice) || 0,
        price: Number(product.finalPrice ?? product.price) || 0,
        originalPrice: Number(product.price ?? product.finalPrice ?? 0) || 0,
        discountMeta: normalizeStoredDiscount(product.discount),
        categoryIds: kind === "set" ? [] : collectProductCategoryIds(product),
        qty: qtyToAdd,
        color: options.color || null,
        colorHex: options.colorHex || null,
        size: options.size || null,
        attribute: options.attribute || null,
        maxQty: stockLimit,
        kind,
        productId: null,
        setId: null,
        detailPath: null,
      };

      if (kind === "set") {
        newItem.kind = "set";
        newItem.setId = String(options.setId || baseId);
        newItem.productId = null;
        newItem.detailPath = `/set/${product.slug || options.setId || baseId}`;
        // set seçimleri
        newItem.items = Array.isArray(options.items) ? options.items : [];
      } else {
        newItem.kind = "product";
        newItem.productId = String(options.productId || baseId);
        newItem.setId = null;
        newItem.detailPath = `/product/${
          product.slug || options.productId || baseId
        }`;
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
          ? {
              ...it,
              qty: (() => {
                const requestedQty = normalizeQty(qty);
                const stockLimit = normalizeStockLimit(it.maxQty);
                if (stockLimit === null) return requestedQty;
                if (it.kind === "set") {
                  const siblingQty = prev.reduce((sum, sibling) => {
                    const sameSet =
                      sibling.lineId !== lineId &&
                      sibling.kind === "set" &&
                      String(sibling.setId || sibling.id || "") ===
                        String(it.setId || it.id || "");
                    return sameSet ? sum + (Number(sibling.qty) || 0) : sum;
                  }, 0);
                  return Math.min(
                    requestedQty,
                    Math.max(1, stockLimit - siblingQty)
                  );
                }
                return Math.min(requestedQty, Math.max(1, stockLimit));
              })(),
            }
          : it
      )
    );

  const clearCart = () => setItems([]);

  const totalItems = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0),
    [items]
  );
  const pricingInputLines = useMemo(
    () =>
      items.map((item) => ({
        lineId: item.lineId,
        kind: item.kind === "set" ? "set" : "product",
        ref:
          item.id ||
          item.ref ||
          (item.kind === "set" ? item.setId : item.productId),
        qty: Number(item.qty || 1) || 1,
        baseUnitPrice:
          Number(item.basePrice ?? item.originalPrice ?? item.price ?? 0) || 0,
        standardDiscount: item.discountMeta || null,
        categoryIds: item.categoryIds || [],
      })),
    [items]
  );

  const pricing = useMemo(
    () =>
      calculateCartPricing({
        lines: pricingInputLines,
        stackedDiscount: stackedDiscountConfig,
        coupon,
      }),
    [coupon, pricingInputLines, stackedDiscountConfig]
  );

  const pricedItems = useMemo(() => {
    const lineMap = new Map(
      (pricing.lines || []).map((line) => [String(line.lineId), line])
    );

    return items.map((item) => {
      const pricedLine = lineMap.get(String(item.lineId || ""));
      if (!pricedLine) return item;
      return {
        ...item,
        price: pricedLine.unitPriceBeforeCoupon,
        originalPrice: pricedLine.baseUnitPrice,
        pricing: {
          standard: pricedLine.standardDiscount
            ? {
                ...pricedLine.standardDiscount,
                applied: pricedLine.standardDiscountApplied,
                removedBy: pricedLine.standardDiscountRemovedBy || null,
                amount: pricedLine.standardDiscountAmount || 0,
              }
            : null,
          stacked: pricing.stacked
            ? {
                quantity: pricedLine.stackedDiscountTier?.quantity || 0,
                percentage: pricedLine.stackedDiscountTier?.percentage || 0,
                amount: pricedLine.stackedDiscountAmount || 0,
                applied: pricedLine.stackedDiscountApplied,
                disabledByCoupon: pricing.stacked.disabledByCoupon === true,
              }
            : null,
          coupon: pricing.coupon?.applicable
            ? {
                code: pricing.coupon.code || null,
                percentage: pricing.coupon.percentage || 0,
                amount: pricedLine.couponDiscountAmount || 0,
              }
            : null,
          lineTotalBeforeCoupon: pricedLine.lineTotalBeforeCoupon,
          finalLineTotal: pricedLine.finalLineTotal,
        },
        categoryIds: pricedLine.categoryIds || item.categoryIds || [],
      };
    });
  }, [items, pricing]);

  const baseSubtotal = useMemo(
    () => Number(pricing.baseSubtotal || 0) || 0,
    [pricing.baseSubtotal]
  );
  const standardDiscountAmount = useMemo(
    () => Number(pricing.standardDiscountAmount || 0) || 0,
    [pricing.standardDiscountAmount]
  );
  const stackedDiscountAmount = useMemo(
    () => Number(pricing.stackedDiscountAmount || 0) || 0,
    [pricing.stackedDiscountAmount]
  );
  const subTotal = useMemo(
    () => Number(pricing.subtotalBeforeCoupon || 0) || 0,
    [pricing.subtotalBeforeCoupon]
  );

  const freeThreshold = Number(shippingConfig?.freeThreshold || 0);
  const baseShippingFee = Math.max(0, Number(shippingConfig?.fee || 0));

  const shippingFee = useMemo(() => {
    if (subTotal <= 0) return 0;
    if (freeThreshold > 0 && subTotal >= freeThreshold) return 0;
    return baseShippingFee;
  }, [subTotal, freeThreshold, baseShippingFee]);

  const total = useMemo(() => subTotal + shippingFee, [subTotal, shippingFee]);

  const couponApplicable = useMemo(() => {
    return Boolean(pricing.coupon?.applicable);
  }, [pricing.coupon]);

  const couponDiscount = useMemo(() => {
    return Number(pricing.coupon?.applicable ? pricing.coupon.discountAmount : 0) || 0;
  }, [pricing.coupon]);

  const grandTotal = useMemo(
    () => Math.max(0, total - couponDiscount),
    [total, couponDiscount]
  );

  useEffect(() => {
    if (coupon) {
      const minRequired = Number(pricing.coupon?.minSubtotal || coupon.minSubtotal || 0);
      const eligibleSubtotal = Number(
        pricing.coupon?.eligibleSubtotal || 0
      );
      if (!couponApplicable) {
        setCouponMessage(
          eligibleSubtotal < minRequired
            ? `${coupon.code} kuponu için minimum ara toplam ₺${minRequired.toFixed(2)} olmalı`
            : "Kupon bu sepet için uygulanamıyor"
        );
      } else {
        setCouponMessage(null);
      }
    }
  }, [coupon, couponApplicable, pricing.coupon]);

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

  const couponPreviewItems = useMemo(
    () =>
      items
        .map((item) => {
          const kind = item?.kind === "set" ? "set" : "product";
          const ref =
            item?.id ||
            item?.ref ||
            (kind === "set" ? item?.setId : item?.productId);
          if (!ref) return null;

          const qty = Math.max(
            1,
            Number(
              item?.qty ??
                item?.quantity ??
                item?.count ??
                item?.amount ??
                item?.q ??
                1
            ) || 1
          );
          return { kind, ref: String(ref), qty };
        })
        .filter(Boolean),
    [items]
  );

  const applyCoupon = async (code) => {
    const normalized = String(code || "").trim();
    if (!normalized) {
      setCoupon(null);
      setCouponMessage("Kupon kodu gerekli");
      throw new Error("Kupon kodu gerekli");
    }
    setCouponMessage(null);
    try {
      const applied = await couponApi.apply({
        code: normalized,
        subtotal: subTotal,
        items: couponPreviewItems,
      });
      setCoupon(applied);
      return applied;
    } catch (error) {
      let message = error?.message || "Kupon uygulanamadı";
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
        items: pricedItems,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        totalItems,
        baseSubtotal,
        subTotal,
        total,
        coupon,
        couponInputVisible,
        couponApplicable,
        couponMessage,
        couponDiscount,
        grandTotal,
        hydrated: cartHydrated,
        pricing: {
          baseSubtotal,
          standardDiscountAmount,
          stackedDiscountAmount,
          couponDiscountAmount: couponDiscount,
          stacked: pricing.stacked || null,
          coupon: pricing.coupon || null,
          nextStackedTierMessage: buildNextStackedTierMessage(pricing.stacked),
          stackedDiscountShopHref:
            pricing.stacked?.nextTier?.missingQuantity > 0
              ? "/shop?stackedDiscount=1"
              : null,
        },
        applyCoupon,
        clearCoupon,
        shipping: {
          name: shippingConfig?.name || "Standart Kargo",
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
