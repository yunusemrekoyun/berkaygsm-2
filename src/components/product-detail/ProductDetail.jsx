import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "../../hooks/useCart";
import { Heart } from "lucide-react";
import { hasAuthSession } from "../../api/client";
import { userDetailsApi } from "../../api/userDetails";
import { useNavigate } from "react-router-dom";
import DiscountBadge from "../ui/DiscountBadge.jsx";
import { getColorInfo } from "../../utils/colors.js";
import ReviewSectionCard from "../reviews/ReviewSectionCard.jsx";
import {
  useStaticTranslation,
  formatStaticText,
} from "../../i18n/staticContent.js";
import { useStorefrontLang } from "../../context/LangContext.jsx";
import AppImage from "../ui/AppImage.jsx";

const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

const pillIdle = "border-border bg-white text-primary hover:bg-surface-hover";

export default function ProductDetail({ product = {} }) {
  const navigate = useNavigate();
  const [isFav, setIsFav] = useState(false);
  const productId = product?.id || product?._id || null;
  const t = useStaticTranslation();
  const { lang } = useStorefrontLang();
  const copy = t("productDetail") || {};
  const stockCopy = copy.stock || {};
  const favoritesCopy = t("favorites") || {};
  const colorLabel = copy.colorLabel || "Renk";
  const sizeLabel = copy.sizeLabel || "Model";
  const optionLabel = copy.optionLabel || "Seçenek";
  const careTitle = copy.careTitle || "Bakım";
  const detailsTitle = copy.detailsTitle || "Detaylar";
  const descriptionFallback =
    copy.descriptionFallback || "Ürün açıklaması bulunmuyor.";
  const addToCartLabel = copy.addToCart || "Sepete Ekle";
  const addedFeedbackLabel = copy.addedToCart || "Ürün sepete eklendi.";
  const viewCartLabel = copy.viewCart || "Sepete git";
  const fallbackName = copy.fallbackName || "Ürün";
  const favoriteAddLabel = favoritesCopy.add || "Favorilere ekle";
  const favoriteRemoveLabel = favoritesCopy.remove || "Favorilerden çıkar";

  const gallery = useMemo(() => {
    const imgs = (product.images || [])
      .map((img) => img?.url || img)
      .filter(Boolean);
    if (imgs.length === 0) return ["/pd-1.jpg"];
    return imgs;
  }, [product.images]);

  const inventory = useMemo(() => product.inventory || [], [product.inventory]);
  const { addToCart, items: cartItems = [] } = useCart();

  const colorOptions = useMemo(() => {
    if (product.showColors === false) return [];
    const map = new Map();

    const sanitizeOption = (value) => {
      if (value === undefined || value === null) return null;
      const trimmed = String(value).trim();
      return trimmed || null;
    };

    const register = (input) => {
      const raw = sanitizeOption(input);
      const info = getColorInfo(raw, lang);
      if (!raw && !info.value) return;
      const key = (info.value || raw || "").toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key: key || String(map.size),
          value: raw,
          label: info.label || raw || "Varsayılan",
          swatch: info.swatch,
          isHex: info.isHex,
        });
      }
    };

    (product.colors || []).forEach(register);
    inventory.forEach((item) => register(item.color));

    return Array.from(map.values());
  }, [inventory, lang, product.colors, product.showColors]);

  const sizeOptions = useMemo(() => {
    if (product.showSizes === false) return [];
    const set = new Set(product.sizes || []);
    inventory.forEach((item) => {
      if (item.size) set.add(item.size);
    });
    return Array.from(set).filter(Boolean);
  }, [inventory, product.sizes, product.showSizes]);

  const attribute = useMemo(() => {
    if (!product.customAttribute?.show) return null;
    const baseValues = product.customAttribute.values || [];
    const map = new Map();
    baseValues.forEach((value) => {
      const key = `${value || ""}`.toLowerCase();
      if (!key) return;
      map.set(key, value);
    });
    inventory.forEach((item) => {
      const key = `${item.attributeValue || ""}`.toLowerCase();
      if (!key) return;
      if (!map.has(key)) map.set(key, item.attributeValue);
    });
    const values = Array.from(map.values()).filter(Boolean);
    return {
      title: product.customAttribute.title || "",
      values,
    };
  }, [inventory, product.customAttribute]);

  const [activeImg, setActiveImg] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedAttribute, setSelectedAttribute] = useState(null);
  const [showAddedFeedback, setShowAddedFeedback] = useState(false);
  const [showGoToCart, setShowGoToCart] = useState(false);
  const addedFeedbackTimeoutRef = useRef(null);

  const activeColorOption = useMemo(() => {
    if (!selectedColor) return null;
    return (
      colorOptions.find(
        (option) => normalize(option.value) === normalize(selectedColor)
      ) || null
    );
  }, [colorOptions, selectedColor]);

  // Favori durumu yükle
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!productId) return;
      if (!hasAuthSession()) {
        if (mounted) setIsFav(false);
        return;
      }
      try {
        const favs = await userDetailsApi.favorites();
        const favIds = new Set(
          (favs.products || []).map((p) => p.id || p._id || p)
        );
        if (mounted) setIsFav(favIds.has(productId));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [productId]);

  // Favori toggle
  const toggleFav = async () => {
    if (!productId) return;
    if (!hasAuthSession()) {
      // login sayfasına yönlendir (istersen ?next= ekleyebilirsin)
      navigate("/account?view=login");
      return;
    }
    try {
      await userDetailsApi.toggleFavorite({ type: "product", id: productId });
      setIsFav((v) => !v);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setActiveImg(0);
    setQuantity(1);
    setSelectedColor(colorOptions[0]?.value ?? null);
    setSelectedSize(sizeOptions[0] ?? null);
    setSelectedAttribute(attribute?.values?.[0] ?? null);
    setShowAddedFeedback(false);
    setShowGoToCart(false);
  }, [productId, colorOptions, sizeOptions, attribute?.values]);

  useEffect(() => {
    return () => {
      if (addedFeedbackTimeoutRef.current) {
        clearTimeout(addedFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const currentStock = useMemo(() => {
    if (!inventory.length) {
      return product.inStock === false ? 0 : null;
    }

    const match = inventory.find((item) => {
      const matchColor = normalize(item.color) === normalize(selectedColor);
      const matchSize = normalize(item.size) === normalize(selectedSize);
      const matchAttr =
        normalize(item.attributeValue) === normalize(selectedAttribute);
      return matchColor && matchSize && matchAttr;
    });

    return match ? Number(match.stock) || 0 : 0;
  }, [
    inventory,
    product.inStock,
    selectedAttribute,
    selectedColor,
    selectedSize,
  ]);

  const cartQtyForVariant = useMemo(() => {
    if (!productId) return 0;
    return cartItems.reduce((sum, item) => {
      const sameProduct =
        item?.kind !== "set" &&
        String(item?.productId || item?.id || "") === String(productId);
      const sameColor = normalize(item?.color) === normalize(selectedColor);
      const sameSize = normalize(item?.size) === normalize(selectedSize);
      const sameAttribute =
        normalize(item?.attribute) === normalize(selectedAttribute);
      return sameProduct && sameColor && sameSize && sameAttribute
        ? sum + (Number(item?.qty) || 0)
        : sum;
    }, 0);
  }, [cartItems, productId, selectedAttribute, selectedColor, selectedSize]);

  const availableStock = useMemo(() => {
    if (currentStock === null) return null;
    return Math.max(0, currentStock - cartQtyForVariant);
  }, [cartQtyForVariant, currentStock]);

  useEffect(() => {
    if (
      availableStock !== null &&
      availableStock !== undefined &&
      availableStock >= 0
    ) {
      if (availableStock === 0) {
        setQuantity(0);
      } else if (quantity === 0) {
        setQuantity(1);
      } else if (quantity > availableStock) {
        setQuantity(availableStock);
      }
    }
  }, [availableStock, quantity]);

  const maxQty = availableStock === null ? 99 : Math.max(0, availableStock);
  const canPurchase = availableStock === null ? true : availableStock > 0;

  const inc = () => {
    if (!canPurchase) return;
    setQuantity((q) => Math.min(maxQty, q + 1));
  };
  const dec = () => {
    setQuantity((q) => Math.max(canPurchase ? 1 : 0, q - 1));
  };

  const handleAddToCart = () => {
    if (!canPurchase) return;
    addToCart(product, {
      kind: "product",
      productId: product.id,
      color: selectedColor,
      colorHex: activeColorOption?.isHex ? activeColorOption.swatch : null,
      size: selectedSize,
      attribute: selectedAttribute,
      qty: quantity,
      stockLimit: currentStock,
    });
    setShowGoToCart(true);
    setShowAddedFeedback(true);
    if (addedFeedbackTimeoutRef.current) {
      clearTimeout(addedFeedbackTimeoutRef.current);
    }
    addedFeedbackTimeoutRef.current = setTimeout(() => {
      setShowAddedFeedback(false);
    }, 1800);
  };

  const stockLabel =
    availableStock === null
      ? stockCopy.inStock || "Stokta"
      : availableStock > 0
      ? formatStaticText(stockCopy.inStockCount || "{count} adet stokta", {
          count: availableStock,
        })
      : stockCopy.outOfStock || "Stokta yok";

  const description = product.description || descriptionFallback;
  const care = product.careInstructions || "";
  const details = Array.isArray(product.details) ? product.details : [];
  const originalPrice = Number(product.price ?? 0);
  const finalPrice = Number(product.finalPrice ?? originalPrice);
  const showStrike = finalPrice < originalPrice;
  const discountPercentage = product.discount?.percentage;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      {/* Left: Gallery */}
      <div className="md:col-span-5" data-animate="fade-right">
        <div className="glass-surface relative overflow-hidden rounded-xl border border-border bg-white">
          <AppImage
            src={gallery[activeImg]}
            alt={product.name || product.title || fallbackName}
            width={1400}
            height={1750}
            sizes="(max-width: 768px) 100vw, 42vw"
            className="aspect-[4/5] w-full object-cover"
            draggable="false"
          />
          {showStrike && (
            <DiscountBadge
              percentage={discountPercentage}
              size="sm"
              className="absolute left-4 top-4"
            />
          )}
        </div>

        {gallery.length > 1 && (
          <div
            className="mt-4 grid grid-cols-3 gap-4"
            data-animate="stagger"
            data-animate-children="> *"
            data-stagger="0.08"
          >
            {gallery.map((img, index) => (
              <button
                key={img + index}
                onClick={() => setActiveImg(index)}
                className={`overflow-hidden rounded-lg border ${
                  activeImg === index ? "border-accent" : "border-border"
                } bg-white transition`}
              >
                <AppImage
                  src={img}
                  alt=""
                  width={400}
                  height={500}
                  sizes="(max-width: 768px) 33vw, 160px"
                  className="aspect-[4/5] w-full object-cover"
                  draggable="false"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Info */}
      <div className="md:col-span-7 space-y-6" data-animate="fade-left">
        <div className="glass-surface rounded-xl border border-border bg-contact-bg p-6">
          {/* Başlık + Kalp */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-serif text-3xl font-extrabold text-primary">
              {product.name || product.title || fallbackName}
            </h1>

            <button
              type="button"
              onClick={toggleFav}
              aria-pressed={isFav}
              aria-label={isFav ? favoriteRemoveLabel : favoriteAddLabel}
              className={[
                "inline-flex items-center justify-center rounded-full border px-3 py-2",
                isFav
                  ? "border-accent text-accent bg-white"
                  : "border-border text-secondary hover:bg-surface-hover",
              ].join(" ")}
              title={isFav ? favoriteRemoveLabel : favoriteAddLabel}
            >
              <Heart
                className="h-5 w-5"
                {...(isFav ? { fill: "currentColor" } : {})}
              />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-2xl font-semibold text-accent">
              {currency.format(finalPrice)}
            </span>
            {showStrike && (
              <span className="text-base text-secondary/60 line-through">
                {currency.format(originalPrice)}
              </span>
            )}
            {showStrike && (
              <DiscountBadge percentage={discountPercentage} size="sm" />
            )}
          </div>
          <p
            className={`mt-1 text-sm ${
              canPurchase ? "text-accent" : "text-secondary"
            }`}
          >
            <span className="mr-1">●</span>
            {stockLabel}
          </p>

          <p className="mt-4 max-w-prose leading-relaxed text-secondary">
            {description}
          </p>

          {colorOptions.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-primary">
                {colorLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((option) => {
                  const active =
                    normalize(option.value) === normalize(selectedColor);
                  return (
                    <button
                      key={option.key || option.value || "color"}
                      onClick={() => setSelectedColor(option.value)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                        active ? "border-accent bg-accent text-white" : pillIdle
                      }`}
                    >
                      <span
                        className="grid h-5 w-5 place-items-center rounded-full border border-white/70 shadow-inner"
                        style={{ background: option.swatch }}
                        aria-hidden="true"
                      >
                        <span className="sr-only">{option.label}</span>
                      </span>
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {sizeOptions.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-primary">
                {sizeLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {sizeOptions.map((size) => {
                  const active = size === selectedSize;
                  return (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        active
                          ? "border-accent bg-accent text-white"
                          : "border-border bg-white text-primary hover:bg-surface-hover"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {attribute && attribute.values.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-primary">
                {attribute.title || optionLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {attribute.values.map((value) => {
                  const active =
                    normalize(value) === normalize(selectedAttribute);
                  return (
                    <button
                      key={value}
                      onClick={() => setSelectedAttribute(value)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        active ? "border-accent bg-accent text-white" : pillIdle
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {showAddedFeedback && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                {addedFeedbackLabel}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <div className="glass-chip inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5">
                <button
                  onClick={dec}
                  className="px-1 text-primary disabled:opacity-50"
                  disabled={!canPurchase}
                >
                  –
                </button>
                <span className="w-6 text-center text-primary">{quantity}</span>
                <button
                  onClick={inc}
                  className="px-1 text-primary disabled:opacity-50"
                  disabled={!canPurchase}
                >
                  +
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                className={`inline-flex flex-1 items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60 md:flex-none md:px-8 ${
                  showAddedFeedback ? "animate-pulse ring-4 ring-accent/20" : ""
                }`}
                disabled={!canPurchase}
              >
                {addToCartLabel}
              </button>
            </div>

            {showGoToCart && (
              <button
                type="button"
                onClick={() => navigate("/cart")}
                className="inline-flex w-full items-center justify-center rounded-full border border-border bg-white px-5 py-3 text-sm font-semibold text-primary hover:bg-surface-hover md:w-auto"
              >
                {viewCartLabel}
              </button>
            )}
          </div>

          {care && (
            <div className="mt-6">
              <h3 className="mb-1 font-semibold text-primary">{careTitle}</h3>
              <p className="text-sm text-secondary whitespace-pre-line">
                {care}
              </p>
            </div>
          )}

          {details.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1 font-semibold text-primary">{detailsTitle}</h3>
              <ul className="list-disc pl-5 text-sm text-secondary">
                {details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <ReviewSectionCard
          targetType="product"
          targetId={product.id}
          targetSlug={product.slug}
          targetName={product.name || product.title}
        />
      </div>
    </div>
  );
}

function normalize(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.toLowerCase() : null;
}
