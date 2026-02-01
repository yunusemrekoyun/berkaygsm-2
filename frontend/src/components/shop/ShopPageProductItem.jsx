// src/components/shop/ShopPageProductItem.jsx
import { Link } from "react-router-dom";
import DiscountBadge from "../ui/DiscountBadge.jsx";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export default function ShopPageProductItem({ product }) {
  const imageSrc = product?.images?.[0]?.url || "/shop-1.jpg";
  const title = product?.name || "Unnamed product";
  const slug = product?.slug || product?.id;
  const originalPrice = Number(product?.price ?? 0);
  const finalPrice = Number(product?.finalPrice ?? originalPrice);
  const discountPercentage = product?.discount?.percentage;
  const showStrike = Number.isFinite(originalPrice) && finalPrice < originalPrice;

  return (
    <Link
      to={slug ? `/product/${slug}` : "#"}
      className="block overflow-hidden rounded-2xl bg-white ring-1 ring-border shadow-sm transition hover:shadow-md"
    >
      <div className="relative">
        <img
          src={imageSrc}
          alt={title}
          className="h-72 w-full object-cover sm:h-80"
          draggable="false"
        />
        {showStrike && (
          <DiscountBadge
            percentage={discountPercentage}
            size="sm"
            className="absolute left-3 top-3"
          />
        )}
      </div>
      <div className="p-4">
        <h4 className="line-clamp-2 text-lg font-semibold tracking-tight text-primary">
          {title}
        </h4>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-semibold text-accent">
            {currency.format(finalPrice)}
          </span>
          {showStrike && (
            <span className="text-sm text-secondary/60 line-through">
              {currency.format(originalPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
