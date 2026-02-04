import { Link } from "react-router-dom";
import DiscountBadge from "../ui/DiscountBadge.jsx";

const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

export default function SimilarProductItem({
  image,
  title,
  price,
  finalPrice,
  discount,
  slug,
}) {
  const basePrice = Number(price ?? 0);
  const computedFinal = Number(finalPrice ?? basePrice);
  const showStrike = Number.isFinite(basePrice) && computedFinal < basePrice;

  return (
    <Link
      to={slug ? `/product/${slug}` : "#"}
      className="block overflow-hidden rounded-xl bg-white ring-1 ring-border transition hover:shadow-sm"
    >
      <div className="relative">
        <img
          src={image || "/shop-1.jpg"}
          alt={title}
          className="h-48 w-full object-cover"
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
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-primary">
          {title}
        </h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-accent">
            {currency.format(computedFinal)}
          </span>
          {showStrike && (
            <span className="text-xs text-secondary/60 line-through">
              {currency.format(basePrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
