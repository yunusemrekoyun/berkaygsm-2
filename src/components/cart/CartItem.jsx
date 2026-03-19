import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useStaticTranslation } from "../../i18n/staticContent.js";
import { useStorefrontLang } from "../../context/LangContext.jsx";
import { getColorInfo } from "../../utils/colors.js";
import AppImage from "../ui/AppImage.jsx";

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
  const maxQty = Number.isFinite(Number(item.maxQty))
    ? Math.max(0, Number(item.maxQty))
    : null;
  const canIncrease = maxQty === null ? true : qty < maxQty;
  const unitFinal = Number(item.price) || 0;
  const unitOriginal = Number(
    item.originalPrice != null ? item.originalPrice : item.price
  );
  const showStrike = unitFinal < unitOriginal;
  const lineTotal =
    Number(item.pricing?.lineTotalBeforeCoupon) || unitFinal * qty;
  const originalTotal = unitOriginal * qty;
  const isSet = String(item.kind || "product") === "set";
  const selections = Array.isArray(item.items) ? item.items : [];
  const pricing = item.pricing || {};
  const detailPath =
    item.detailPath ||
    (isSet
      ? item.setId || item.slug || item.id
        ? `/set/${item.slug || item.setId || item.id}`
        : null
      : item.productId || item.slug || item.id
        ? `/product/${item.slug || item.productId || item.id}`
        : null);

  return (
    <li className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 p-4 sm:grid-cols-12 sm:p-5">
      <div className="sm:col-span-2">
        <div className="glass-surface-soft overflow-hidden rounded-xl border border-border bg-white">
          <AppImage
            src={item.image}
            alt={item.title}
            width={640}
            height={640}
            sizes="(max-width: 640px) 92px, 160px"
            className="aspect-square w-full object-cover"
            draggable="false"
          />
        </div>
      </div>

      <div className="min-w-0 sm:col-span-7">
        <h4 className="text-base font-semibold text-primary">
          {detailPath ? (
            <Link
              to={detailPath}
              target="_blank"
              rel="noreferrer noopener"
              className="transition hover:text-accent hover:underline"
            >
              {item.title || itemFallback}
            </Link>
          ) : (
            item.title || itemFallback
          )}
        </h4>

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
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="glass-chip rounded-full bg-contact-bg px-2 py-0.5 text-xs">
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

        {(pricing.standard?.amount > 0 ||
          pricing.standard?.removedBy ||
          pricing.stacked?.amount > 0) && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {pricing.standard?.amount > 0 && pricing.standard?.applied && (
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 ring-1 ring-emerald-200">
                Normal indirim: -₺{Number(pricing.standard.amount || 0).toFixed(2)}
              </span>
            )}
            {pricing.standard?.removedBy === "coupon" && (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700 ring-1 ring-amber-200">
                Kupon nedeniyle normal indirim iptal
              </span>
            )}
            {pricing.standard?.removedBy === "stacked" && (
              <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700 ring-1 ring-sky-200">
                Katlanan indirim nedeniyle normal indirim iptal
              </span>
            )}
            {pricing.stacked?.amount > 0 && pricing.stacked?.applied && (
              <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700 ring-1 ring-sky-200">
                Katlanan indirim: -₺{Number(pricing.stacked.amount || 0).toFixed(2)}
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="glass-chip inline-flex items-center gap-2 rounded-full border border-border bg-contact-bg px-3 py-1.5">
            <button onClick={dec} className="px-1 text-primary">
              –
            </button>
            <span className="w-6 text-center text-primary">{item.qty}</span>
            <button
              onClick={inc}
              className="px-1 text-primary disabled:opacity-40"
              disabled={!canIncrease}
            >
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

      <div className="col-span-2 flex items-start justify-between gap-4 border-t border-border/70 pt-3 sm:col-span-3 sm:block sm:border-t-0 sm:pt-0 sm:text-right">
        <div>
          <p className="text-sm text-secondary">{unitLabel}</p>
          <div className="mt-1 flex items-baseline gap-2 sm:justify-end">
            <span className="font-semibold text-primary">
              ₺{unitFinal.toFixed(2)}
            </span>
            {showStrike && (
              <span className="text-xs text-secondary/60 line-through">
                ₺{unitOriginal.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        <div className="text-right sm:mt-2">
          <p className="text-sm text-secondary">{totalLabel}</p>
          <div className="mt-1 flex items-baseline justify-end gap-2">
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
      </div>
    </li>
  );
}
