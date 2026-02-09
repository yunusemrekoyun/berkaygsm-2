import { Link } from "react-router-dom";
import DiscountBadge from "../ui/DiscountBadge.jsx";
import { useStaticTranslation } from "../../i18n/staticContent.js";
import AppImage from "../ui/AppImage.jsx";

const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

export default function SimilarSets({ items = [] }) {
  const t = useStaticTranslation();
  const copy = t("similarSets") || {};
  if (!items.length) return null;

  return (
    <div className="glass-surface rounded-xl bg-white ring-1 ring-black/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary">
          {copy.heading || "Bunları da sevebilirsiniz"}
        </h2>
      </div>

      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-animate="stagger"
        data-animate-children="> *"
      >
        {items.map((it) => (
          <article
            key={it.id || it.slug}
            className="glass-surface overflow-hidden rounded-xl ring-1 ring-black/5 bg-white hover:shadow-sm transition"
          >
            <Link to={`/set/${it.slug || it.id}`}>
              <div className="relative">
                <AppImage
                  src={it.image || "/set-placeholder.jpg"}
                  alt={it.title}
                  width={900}
                  height={600}
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="h-40 w-full object-cover"
                  draggable="false"
                />
                {shouldShowStrike(it.price, it.finalPrice) && (
                  <DiscountBadge
                    percentage={it.discount}
                    size="sm"
                    className="absolute left-3 top-3"
                  />
                )}
              </div>
              <div className="p-3">
                <h3 className="line-clamp-1 text-sm font-semibold text-primary">
                  {it.title}
                </h3>
                <div className="mt-1 flex items-baseline gap-2 text-xs text-secondary">
                  <span className="font-semibold text-accent">
                    {currency.format(it.finalPrice ?? it.price ?? 0)}
                  </span>
                  {shouldShowStrike(it.price, it.finalPrice) && (
                    <span className="text-secondary/60 line-through">
                      {currency.format(it.price)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}

function shouldShowStrike(original, final) {
  const base = Number(original ?? 0);
  const computedFinal = Number(final ?? base);
  return Number.isFinite(base) && computedFinal < base;
}
