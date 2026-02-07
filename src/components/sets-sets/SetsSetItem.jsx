import { Link } from "react-router-dom";
import DiscountBadge from "../ui/DiscountBadge.jsx";
import { formatStaticText } from "../../i18n/staticContent.js";

export default function SetsSetItem({
  image,
  title,
  desc,
  includes,
  to,
  price,
  finalPrice,
  discount,
  copy = {},
}) {
  const isDisabled = !to;
  const basePrice = Number(price ?? 0);
  const computedFinal = Number(finalPrice ?? basePrice);
  const showStrike = Number.isFinite(basePrice) && computedFinal < basePrice;
  const includesLabel = copy.includes || "İçindekiler:";
  const viewDetailsLabel = copy.viewDetails || "Detayları gör →";
  const untitledLabel = copy.untitled || "Set";
  const ariaLabelTemplate = copy.ariaLabel || "{title} sayfasını aç";

  const Wrapper = ({ children }) =>
    isDisabled ? (
      <div className="block cursor-not-allowed opacity-70">{children}</div>
    ) : (
      <Link
        to={to}
        aria-label={formatStaticText(ariaLabelTemplate, {
          title: title || untitledLabel,
        })}
        className="group block"
      >
        {children}
      </Link>
    );

  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 shadow-sm transition">
      <Wrapper>
        <div className="relative overflow-hidden">
          <img
            src={image}
            alt={title || untitledLabel}
            className="h-56 w-full object-cover md:h-64 transition-transform duration-300 group-hover:scale-[1.02]"
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
          <h3 className="text-2xl font-semibold tracking-tight text-primary line-clamp-1">
            {title}
          </h3>

          {desc && (
            <p className="mt-2 text-[15px] leading-relaxed text-secondary line-clamp-2">
              {desc}
            </p>
          )}

          {includes && (
            <p className="mt-3 text-sm text-secondary line-clamp-1">
              <span className="font-medium text-primary">{includesLabel}</span>{" "}
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

          {!isDisabled && (
            <div className="mt-4 inline-flex items-center text-sm font-medium text-accent group-hover:underline">
              {viewDetailsLabel}
            </div>
          )}
        </div>
      </Wrapper>
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
