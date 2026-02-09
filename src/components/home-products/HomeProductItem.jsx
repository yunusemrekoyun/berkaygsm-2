// src/components/home-products/HomeProductItem.jsx
import { Link } from "react-router-dom";
import DiscountBadge from "../ui/DiscountBadge.jsx";

export default function HomeProductItem({
  to = "#",
  image,
  title,
  subtitle,
  price,
  finalPrice,
  discount,
}) {
  const basePrice = Number(price ?? 0);
  const computedFinal = Number(finalPrice ?? basePrice);
  const showStrike = Number.isFinite(basePrice) && computedFinal < basePrice;

  return (
    <Link
      to={to}
      className="glass-surface group block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
    >
      {/* Görsel */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-light/60">
        <img
          src={image}
          alt={title}
          className="h-full w-full object-contain p-2 sm:p-3"
          draggable="false"
        />
        {showStrike && (
          <DiscountBadge
            percentage={discount}
            size="sm"
            className="absolute left-3 top-3"
          />
        )}
      </div>

      {/* Alt içerik paneli */}
      <div className="flex flex-col gap-1 p-4">
        <h3 className="text-[15px] font-semibold tracking-tight text-primary">
          {title}
        </h3>
        <p className="text-sm text-gray-500">{subtitle}</p>
        <div className="pt-2 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-accent">
            {formatCurrency(computedFinal)}
          </span>
          {showStrike && (
            <span className="text-xs text-secondary/60 line-through">
              {formatCurrency(basePrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}
