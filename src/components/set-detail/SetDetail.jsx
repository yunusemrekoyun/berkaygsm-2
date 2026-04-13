import { useMemo, useState, useEffect } from "react";
import SetGallery from "./SetGallery";
import SetInfo from "./SetInfo";
import SetIncludes from "./SetIncludes";
import SetSummary from "./SetSummary";
import { Heart } from "lucide-react";
import { hasAuthSession } from "../../api/client";
import { userDetailsApi } from "../../api/userDetails";
import { useNavigate } from "react-router-dom";
import ReviewSectionCard from "../reviews/ReviewSectionCard.jsx";
import { useStaticTranslation } from "../../i18n/staticContent.js";
import { useCart } from "../../hooks/useCart";

export default function SetDetail({ setDoc }) {
  // Hook'lar her zaman çağrılıyor (ESLint hatası çözümü)
  const [qty, setQty] = useState(1);
  const [isFav, setIsFav] = useState(false);
  useCart();
  const navigate = useNavigate();
  const t = useStaticTranslation();
  const favoritesCopy = t("favorites") || {};
  const favoriteAddLabel = favoritesCopy.add || "Favorilere ekle";
  const favoriteRemoveLabel = favoritesCopy.remove || "Favorilerden çıkar";

  // maxStock: set içindeki ürünlerin en iyi varyant seçimiyle kaç set yapılabileceği.
  // Her ürün için "en yüksek stoklu varyant / set içi adeti" alınır, minimum olan setin üst sınırıdır.
  const maxStock = useMemo(() => {
    // Explicit override (ileride gerekirse kullanılır)
    if (setDoc?.stock !== null && setDoc?.stock !== undefined) {
      const s = Number(setDoc?.stock);
      if (Number.isFinite(s) && s >= 0) return s;
    }
    const products = Array.isArray(setDoc?.products) ? setDoc.products : [];
    if (!products.length) return Infinity;

    let minPossible = Infinity;
    for (const entry of products) {
      const p = entry?.product || entry || {};
      const qtyInSet = Math.max(1, Number(entry?.quantity) || 1);
      const inventory = Array.isArray(p.inventory) ? p.inventory : [];
      if (!inventory.length) continue;

      // Bu ürünün herhangi bir varyantından en fazla kaç set çıkar?
      const bestVariantQty = inventory.reduce((best, inv) => {
        const n = Number(inv?.stockSet);
        const qty = Number.isFinite(n) && n >= 0 ? n : Math.max(0, Number(inv?.stock) || 0);
        return Math.max(best, qty);
      }, 0);

      const setsFromProduct = Math.floor(bestVariantQty / qtyInSet);
      if (setsFromProduct < minPossible) minPossible = setsFromProduct;
    }

    return Number.isFinite(minPossible) ? minPossible : Infinity;
  }, [setDoc?.products, setDoc?.stock]);

  const availableStock = useMemo(() => {
    if (!Number.isFinite(maxStock)) return Infinity;
    return Math.max(0, maxStock);
  }, [maxStock]);

  useEffect(() => {
    if (!Number.isFinite(availableStock)) return;
    if (availableStock <= 0) {
      if (qty !== 0) setQty(0);
      return;
    }
    if (qty === 0) {
      setQty(1);
    } else if (qty > availableStock) {
      setQty(availableStock);
    }
  }, [availableStock, qty]);

  // Favori durumu yükle
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!setDoc?.id) return;
      if (!hasAuthSession()) {
        if (mounted) setIsFav(false);
        return;
      }
      try {
        const favs = await userDetailsApi.favorites();
        const ids = new Set((favs.sets || []).map((s) => s.id || s._id || s));
        if (mounted) setIsFav(ids.has(setDoc.id));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setDoc?.id]);

  const toggleFav = async () => {
    if (!setDoc?.id) return;
    if (!hasAuthSession()) {
      navigate("/account?view=login");
      return;
    }
    try {
      await userDetailsApi.toggleFavorite({ type: "set", id: setDoc.id });
      setIsFav((v) => !v);
    } catch (e) {
      console.error(e);
    }
  };

  // setDoc yoksa hiçbir şey çizme (hook'lardan SONRA koşullu return)
  if (!setDoc) {
    return null;
  }

  return (
    <div className="grid gap-6 md:grid-cols-12">
      {/* Left: Gallery */}
      <div className="md:col-span-5" data-animate="fade-right">
        <SetGallery images={setDoc.images || []} title={setDoc.name} />
      </div>

      {/* Right: Info */}
      <div className="md:col-span-7 space-y-5" data-animate="fade-left">
        <div className="glass-surface space-y-5 rounded-xl bg-white p-5 ring-1 ring-black/5 md:p-6">
          {/* Üst sağ: Favori kalbi */}
          <div className="flex items-start justify-between">
            <div />
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

          <SetInfo
            name={setDoc.name}
            price={setDoc.price}
            finalPrice={setDoc.finalPrice}
            discount={setDoc.discount?.percentage}
            stock={Number.isFinite(availableStock) ? availableStock : setDoc.stock}
            description={setDoc.description}
          />

          <SetIncludes products={setDoc.products || []} />

          <SetSummary
            setDoc={setDoc}
            price={setDoc.price}
            finalPrice={setDoc.finalPrice}
            stock={Number.isFinite(availableStock) ? availableStock : setDoc.stock}
            quantity={qty}
            maxStock={availableStock}
            onChangeQuantity={setQty}
          />
        </div>

        <ReviewSectionCard
          targetType="set"
          targetId={setDoc.id}
          targetSlug={setDoc.slug}
          targetName={setDoc.name}
        />
      </div>
    </div>
  );
}
