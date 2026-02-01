// src/components/set-detail/SetSummary.jsx
import React, { useMemo, useState } from "react";
import QtyStepper from "./QtyStepper";
import { useCart } from "../../hooks/useCart";
import SetVariantPickerModal from "./SetVariantPickerModal";
import toast from "react-hot-toast";
import {
  useStaticTranslation,
  formatStaticText,
} from "../../i18n/staticContent.js";

export default function SetSummary({
  setDoc,
  price = 0,
  finalPrice = undefined,
  stock = null,
  quantity = 1,
  maxStock = 99,
  onChangeQuantity,
}) {
  const { addToCart } = useCart();
  const [openPicker, setOpenPicker] = useState(false);
  const t = useStaticTranslation();
  const copy = t("setDetail") || {};
  const summaryCopy = copy.summary || {};
  const quantityLabel = summaryCopy.quantityLabel || "Quantity";
  const totalLabelTemplate = summaryCopy.totalLabel || "Total {amount}";
  const addToCartLabel = summaryCopy.addToCart || "Add to cart";
  const addedToast = summaryCopy.addedToCart || "Set added to cart";

  const hasStockInfo = stock !== null && stock !== undefined;
  const minQty = hasStockInfo && stock <= 0 ? 0 : 1;
  const requiredQty = Math.max(1, minQty);
  const canBuy = (hasStockInfo ? stock > 0 : true) && quantity >= requiredQty;
  const safeMax =
    Number.isFinite(maxStock) && maxStock >= 0 ? Math.floor(maxStock) : 99;

  const { priceText, originalText, showStrike, totalText } = useMemo(() => {
    const basePrice = Number(price ?? 0);
    const computedFinal = Number(finalPrice ?? basePrice);
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    });
    return {
      showStrike: computedFinal < basePrice,
      priceText: formatter.format(computedFinal),
      originalText: formatter.format(basePrice),
      totalText: formatter.format(computedFinal * quantity),
    };
  }, [price, finalPrice, quantity]);

  const handleOpen = () => {
    if (!setDoc) return;
    if (hasStockInfo && stock <= 0) return;
    if (quantity < requiredQty) return;
    setOpenPicker(true);
  };

  const handleConfirm = (selections) => {
    // selections: [{ productId, color, colorHex, size, attribute, qtyInSet }]
    if (!setDoc) return;
    if (hasStockInfo && stock <= 0) return;
    if (quantity <= 0) return;
    const setId = setDoc.id || setDoc._id || setDoc.slug;
    addToCart(setDoc, {
      kind: "set",
      setId,
      qty: quantity,
      items: selections, // sepete setin item seçimleri
    });
    setOpenPicker(false);
    toast.success(addedToast);
  };

  return (
    <>
      <div className="rounded-xl bg-surface/60 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Qty */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-secondary">{quantityLabel}</span>
            <QtyStepper
              value={quantity}
              min={minQty}
              max={Math.min(Math.max(minQty, safeMax), 999)}
              onChange={onChangeQuantity}
            />
          </div>

          {/* Price + CTA */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col text-right">
              <span className="text-lg font-semibold text-primary">
                {priceText}
              </span>
              {showStrike && (
                <span className="text-xs text-secondary/60 line-through">
                  {originalText}
                </span>
              )}
              <span className="text-xs text-secondary">
                {formatStaticText(totalLabelTemplate, { amount: totalText })}
              </span>
            </div>
            <button
              type="button"
              disabled={!canBuy}
              onClick={handleOpen}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white
                       hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addToCartLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Variant Picker Modal */}
      {openPicker && (
        <SetVariantPickerModal
          open={openPicker}
          onClose={() => setOpenPicker(false)}
          setDoc={setDoc}
          setQty={quantity}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
