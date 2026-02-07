import { useMemo } from "react";
import { useStaticTranslation } from "../../i18n/staticContent.js";
import { getColorInfo } from "../../utils/colors.js";
import { useStorefrontLang } from "../../context/LangContext.jsx";

export default function CartItem({ item, onQty, onRemove }) {
  const t = useStaticTranslation();
  const { lang } = useStorefrontLang();
  const cartCopy = t("cart") || {};
  const optionCopy = cartCopy.options || {};
  const colorLabel = optionCopy.color || "Renk";
  const sizeLabel = optionCopy.size || "Model";
  const attributeLabel = optionCopy.option || "Seçenek";
  const selectionsLabel = cartCopy.selectionsLabel || "Seçimler";
  const removeLabel = cartCopy.remove || "Kaldır";
  const unitLabel = cartCopy.unitLabel || "Birim";
  const totalLabel = cartCopy.totalLabel || "Toplam";
  const itemFallback = cartCopy.itemFallback || "Ürün";
  const productColorInfo = useMemo(() => {
    if (!item.color) return null;
    return getColorInfo(item.color, lang);
  }, [item.color, lang]);

  const inc = () => onQty(item.lineId, item.qty + 1);
  const dec = () => onQty(item.lineId, item.qty - 1);

  const qty = Number(item.qty) || 0;
  const unitFinal = Number(item.price) || 0;
  const unitOriginal = Number(
    item.originalPrice != null ? item.originalPrice : item.price
  );
  const showStrike = unitFinal < unitOriginal;
  const lineTotal = unitFinal * qty;
  const originalTotal = unitOriginal * qty;

  const isSet = String(item.kind || "product") === "set";
  const selections = Array.isArray(item.items) ? item.items : [];

  return (
    <li className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-12">
      {/* Görsel */}
      <div className="sm:col-span-2">
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <img
            src={item.image}
            alt={item.title}
            className="aspect-square w-full object-cover"
            draggable="false"
          />
        </div>
      </div>

      {/* Bilgiler */}
      <div className="sm:col-span-7">
        <h4 className="text-base font-semibold text-primary">
          {item.title || itemFallback}
        </h4>

        {/* Ürün varyant alanları (tekil ürün için) */}
        {!isSet && (
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
            {item.colorHex && (
              <span className="inline-flex items-center gap-1 text-secondary">
                {colorLabel}:
                <span
                  className="ml-1 inline-block h-3 w-3 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: item.colorHex }}
                />
                <span className="text-secondary/80">
                  {productColorInfo?.label || item.color}
                </span>
              </span>
            )}
            {item.size && (
              <span className="text-secondary">
                {sizeLabel}: {item.size}
              </span>
            )}
            {item.attribute && (
              <span className="text-secondary">
                {attributeLabel}: {item.attribute}
              </span>
            )}
          </div>
        )}

        {/* SET seçim özetleri */}
        {isSet && selections.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-sm font-medium text-primary">
              {selectionsLabel}
            </p>
            <ul className="space-y-1">
              {selections.map((s, i) => {
                const selectionColorInfo = s.color
                  ? getColorInfo(s.color, lang)
                  : null;
                return (
                <li
                  key={`${s.productId || i}`}
                  className="text-sm text-secondary"
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-contact-bg px-2 py-0.5 text-xs">
                      ×{s.qtyInSet || 1}
                    </span>
                    {s.color && (
                      <span className="inline-flex items-center gap-1">
                        {colorLabel}:{" "}
                        <strong className="text-primary">
                          {selectionColorInfo?.label || s.color}
                        </strong>
                      </span>
                    )}
                    {s.size && (
                      <span className="inline-flex items-center gap-1">
                        {sizeLabel}:{" "}
                        <strong className="text-primary">{s.size}</strong>
                      </span>
                    )}
                    {s.attribute && (
                      <span className="inline-flex items-center gap-1">
                        {attributeLabel}:{" "}
                        <strong className="text-primary">{s.attribute}</strong>
                      </span>
                    )}
                  </span>
                </li>
              );
              })}
            </ul>
          </div>
        )}

        {/* Miktar + Kaldır */}
        <div className="mt-3 flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-contact-bg px-3 py-1.5">
            <button onClick={dec} className="px-1 text-primary">
              –
            </button>
            <span className="w-6 text-center text-primary">{item.qty}</span>
            <button onClick={inc} className="px-1 text-primary">
              +
            </button>
          </div>

          <button
            onClick={onRemove}
            className="text-sm text-secondary hover:text-accent"
          >
            {removeLabel}
          </button>
        </div>
      </div>

      {/* Fiyatlar */}
      <div className="sm:col-span-3 sm:text-right">
        <p className="text-sm text-secondary">{unitLabel}</p>
        <div className="flex items-baseline gap-2 sm:justify-end">
          <span className="font-semibold text-primary">
            ₺{unitFinal.toFixed(2)}
          </span>
          {showStrike && (
            <span className="text-xs text-secondary/60 line-through">
              ₺{unitOriginal.toFixed(2)}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-secondary">{totalLabel}</p>
        <div className="flex items-baseline gap-2 sm:justify-end">
          <span className="font-semibold text-primary">
            ₺{lineTotal.toFixed(2)}
          </span>
          {showStrike && (
            <span className="text-xs text-secondary/60 line-through">
              ₺{originalTotal.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
