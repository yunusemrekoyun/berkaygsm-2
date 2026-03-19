// src/components/set-detail/SetSummary.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import QtyStepper from "./QtyStepper";
import { useCart } from "../../hooks/useCart";
import SetVariantPickerModal from "./SetVariantPickerModal";
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
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [openPicker, setOpenPicker] = useState(false);
  const [showAddedFeedback, setShowAddedFeedback] = useState(false);
  const [showGoToCart, setShowGoToCart] = useState(false);
  const t = useStaticTranslation();
  const copy = t("setDetail") || {};
  const summaryCopy = copy.summary || {};
  const quantityLabel = summaryCopy.quantityLabel || "Adet";
  const totalLabelTemplate = summaryCopy.totalLabel || "Toplam {amount}";
  const addToCartLabel = summaryCopy.addToCart || "Sepete ekle";
  const addedFeedbackLabel = summaryCopy.addedToCart || "Set sepete eklendi";
  const viewCartLabel = summaryCopy.viewCart || "Sepete git";
  const addedFeedbackTimeoutRef = useRef(null);

  const hasStockInfo = stock !== null && stock !== undefined;
  const minQty = hasStockInfo && stock <= 0 ? 0 : 1;
  const requiredQty = Math.max(1, minQty);
  const canBuy = (hasStockInfo ? stock > 0 : true) && quantity >= requiredQty;
  const safeMax =
    Number.isFinite(maxStock) && maxStock >= 0 ? Math.floor(maxStock) : 99;

  useEffect(() => {
    return () => {
      if (addedFeedbackTimeoutRef.current) {
        clearTimeout(addedFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const { priceText, originalText, showStrike, totalText } = useMemo(() => {
    const basePrice = Number(price ?? 0);
    const computedFinal = Number(finalPrice ?? basePrice);
    const formatter = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
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
    setShowGoToCart(true);
    setShowAddedFeedback(true);
    if (addedFeedbackTimeoutRef.current) {
      clearTimeout(addedFeedbackTimeoutRef.current);
    }
    addedFeedbackTimeoutRef.current = setTimeout(() => {
      setShowAddedFeedback(false);
    }, 1800);
  };

  return (
    <>
      <div className="glass-surface-soft rounded-xl bg-surface/60 p-3 sm:p-4">
        <div className="space-y-3">
          {showAddedFeedback && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {addedFeedbackLabel}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-secondary">{quantityLabel}</span>
              <QtyStepper
                value={quantity}
                min={minQty}
                max={Math.min(Math.max(minQty, safeMax), 999)}
                onChange={onChangeQuantity}
              />
            </div>

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
                className={`rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${
                  showAddedFeedback ? "animate-pulse ring-4 ring-primary/15" : ""
                }`}
              >
                {addToCartLabel}
              </button>
            </div>
          </div>

          {showGoToCart && (
            <button
              type="button"
              onClick={() => navigate("/cart")}
              className="inline-flex w-full items-center justify-center rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-surface-hover sm:w-auto"
            >
              {viewCartLabel}
            </button>
          )}
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
