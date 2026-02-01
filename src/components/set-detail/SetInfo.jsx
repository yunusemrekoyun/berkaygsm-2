import DiscountBadge from "../ui/DiscountBadge.jsx";
import {
  useStaticTranslation,
  formatStaticText,
} from "../../i18n/staticContent.js";

export default function SetInfo({
  name,
  price,
  finalPrice,
  discount,
  stock,
  description,
}) {
  const t = useStaticTranslation();
  const copy = t("setDetail") || {};
  const stockCopy = copy.stock || {};
  const basePrice = Number(price ?? 0);
  const computedFinal = Number(finalPrice ?? basePrice);
  const showStrike = Number.isFinite(basePrice) && computedFinal < basePrice;
  const priceFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

  let stockState = "variant";
  let stockText = stockCopy.variantDependent || "Stock depends on selections.";

  if (stock !== null && stock !== undefined) {
    if (stock > 0) {
      stockState = "in";
      stockText =
        stock >= Number.MAX_SAFE_INTEGER / 2
          ? stockCopy.infinite || "In stock"
          : formatStaticText(stockCopy.inStockCount || "In stock: {count}", {
              count: stock,
            });
    } else {
      stockState = "out";
      stockText = stockCopy.outOfStock || "Out of stock";
    }
  }

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-primary">
        {name}
      </h1>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-accent">
            {priceFormatter.format(computedFinal)}
          </span>
          {showStrike && (
            <span className="text-base text-secondary/60 line-through">
              {priceFormatter.format(basePrice)}
            </span>
          )}
        </div>
        {showStrike && (
          <DiscountBadge percentage={discount} size="sm" />
        )}
        <div
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
            stockState === "in"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : stockState === "out"
              ? "bg-rose-50 text-rose-700 ring-rose-200"
              : "bg-sky-50 text-sky-700 ring-sky-200"
          }`}
        >
          {stockText}
        </div>
      </div>

      {description && (
        <p className="mt-3 text-[15px] leading-relaxed text-secondary">
          {description}
        </p>
      )}
    </div>
  );
}
