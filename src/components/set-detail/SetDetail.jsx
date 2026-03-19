import { useMemo, useState, useEffect } from "react";
import SetGallery from "./SetGallery";
import SetInfo from "./SetInfo";
import SetIncludes from "./SetIncludes";
import SetSummary from "./SetSummary";
import { Heart } from "lucide-react";
import { getAccessToken } from "../../api/client";
import { userDetailsApi } from "../../api/userDetails";
import { useNavigate } from "react-router-dom";
import ReviewSectionCard from "../reviews/ReviewSectionCard.jsx";
import { useStaticTranslation } from "../../i18n/staticContent.js";
import { useCart } from "../../hooks/useCart";

export default function SetDetail({ setDoc }) {
  // Hook'lar her zaman çağrılıyor (ESLint hatası çözümü)
  const [qty, setQty] = useState(1);
  const [isFav, setIsFav] = useState(false);
  const { items: cartItems = [] } = useCart() || {};
  const navigate = useNavigate();
  const t = useStaticTranslation();
  const favoritesCopy = t("favorites") || {};
  const favoriteAddLabel = favoritesCopy.add || "Favorilere ekle";
  const favoriteRemoveLabel = favoritesCopy.remove || "Favorilerden çıkar";

  // setDoc olmasa da güvenli hesaplama
  const maxStock = useMemo(() => {
    if (setDoc?.stock === null || setDoc?.stock === undefined) return Infinity;
    const s = Number(setDoc?.stock);
    if (!Number.isFinite(s)) return Infinity;
    return Math.max(0, s);
  }, [setDoc?.stock]);

  const cartQtyForSet = useMemo(() => {
    if (!setDoc?.id) return 0;
    return cartItems.reduce((sum, item) => {
      const sameSet =
        item?.kind === "set" &&
        String(item?.setId || item?.id || "") === String(setDoc.id);
      return sameSet ? sum + (Number(item?.qty) || 0) : sum;
    }, 0);
  }, [cartItems, setDoc?.id]);

  const availableStock = useMemo(() => {
    if (!Number.isFinite(maxStock)) return Infinity;
    return Math.max(0, maxStock - cartQtyForSet);
  }, [cartQtyForSet, maxStock]);

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
      if (!getAccessToken()) {
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
    if (!getAccessToken()) {
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
