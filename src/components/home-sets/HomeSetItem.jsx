// src/components/home-sets/HomeSetItem.jsx
import { Link } from "react-router-dom";
import DiscountBadge from "../ui/DiscountBadge.jsx";
import AppImage from "../ui/AppImage.jsx";
export default function HomeSetItem({
  image,
  title,
  desc,
  includes,
  compact,
  to,
  price,
  finalPrice,
  discount,
}) {
  const basePrice = Number(price ?? 0);
  const computedFinal = Number(finalPrice ?? basePrice);
  const showStrike = Number.isFinite(basePrice) && computedFinal < basePrice;

  if (compact) {
    // Daha minimal kart
    return (
      <article className="glass-surface overflow-hidden rounded-xl bg-white ring-1 ring-border hover:shadow-sm transition">
        <Link to={to || "#"} className="block">
          <div className="relative">
            <AppImage
              src={image}
              alt={title}
              width={1200}
              height={800}
              sizes="(max-width: 768px) 50vw, 25vw"
              className="h-36 w-full object-cover md:h-40"
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
            <h3 className="line-clamp-1 text-[15px] font-semibold tracking-tight text-primary">
              {title}
            </h3>
            {desc && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-secondary">
                {desc}
              </p>
            )}
            {includes && (
              <p className="mt-2 line-clamp-1 text-[11px] text-secondary/90">
                <span className="font-medium text-primary">İçindekiler:</span>{" "}
                {includes}
              </p>
            )}
            <div className="mt-3 flex items-baseline gap-2 text-sm">
              <span className="font-semibold text-accent">
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
      </article>
    );
  }

  // Eski (standard) görünüm
  return (
    <article className="glass-surface overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <Link to={to || "#"} className="block">
        <div className="relative">
          <AppImage
            src={image}
            alt={title}
            width={1600}
            height={1000}
            sizes="(max-width: 768px) 100vw, 50vw"
            className="h-56 w-full object-cover md:h-64"
            draggable="false"
          />
          {showStrike && (
            <DiscountBadge
              percentage={discount}
              size="sm"
              className="absolute left-4 top-4"
            />
          )}
        </div>
        <div className="p-6">
          <h3 className="text-2xl font-semibold tracking-tight text-primary">
            {title}
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-secondary">
            {desc}
          </p>
          {includes && (
            <p className="mt-3 text-sm text-secondary">
              <span className="font-medium text-primary">İçindekiler:</span>{" "}
              {includes}
            </p>
          )}
          <div className="mt-4 flex items-baseline gap-2 text-lg">
            <span className="font-semibold text-accent">
              {formatCurrency(computedFinal)}
            </span>
            {showStrike && (
              <span className="text-sm text-secondary/60 line-through">
                {formatCurrency(basePrice)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}
