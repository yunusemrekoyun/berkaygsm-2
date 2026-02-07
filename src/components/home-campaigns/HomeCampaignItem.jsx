// src/components/home-campaigns/HomeCampaignItem.jsx
import { Link } from "react-router-dom";
import { useStaticTranslation } from "../../i18n/staticContent.js";

export default function HomeCampaignItem({
  to = "#",
  image,
  title,
  subtitle,
  badge,
  ctaText,
  variant = "small", // 'big' | 'wide' | 'small'
  className = "",
}) {
  const t = useStaticTranslation();
  const resolvedCta = ctaText || t("homeCampaigns.cta") || "Alışverişe Başla";
  const span =
    variant === "big"
      ? "md:col-span-2 md:row-span-2"
      : variant === "wide"
      ? "md:col-span-2 md:row-span-1"
      : "md:col-span-1 md:row-span-1";

  return (
    <Link
      to={to}
      className={`group relative min-h-[220px] overflow-hidden rounded-2xl ring-1 ring-black/5 shadow-sm ${span} ${className}`}
    >
      {/* BG image */}
      <img
        src={image}
        alt={title}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        draggable="false"
      />

      {/* Overlays */}
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

      {/* Badge */}
      {badge && (
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-primary shadow">
          {badge}
        </span>
      )}

      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <h3 className="text-xl font-semibold drop-shadow">{title}</h3>
        {subtitle && (
          <p className="mt-1 max-w-md text-sm text-white/90">{subtitle}</p>
        )}
        <span className="mt-4 inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-accent-hover">
          {resolvedCta}
        </span>
      </div>
    </Link>
  );
}
