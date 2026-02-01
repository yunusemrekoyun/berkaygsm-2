// src/components/home-products/HomeProducts.jsx
import HomeProductItem from "./HomeProductItem";
import { useStaticTranslation } from "../../i18n/staticContent.js";

export default function HomeProducts({
  title = "New Arrivals",
  items = [],
  variant = "boxed", // "boxed" | "merge-top" | "merge-bottom"
  className = "",
  loading = false,
}) {
  const t = useStaticTranslation();
  const isBoxed = variant === "boxed";
  const innerPad = "px-4 py-12 sm:px-6 lg:px-8";
  const emptyLabel = t("homeProducts.empty") || "Products coming soon.";

  if (!isBoxed) {
    // Merge modunda: arka plan ve radius parent'ta; sadece içerik render'la
    return (
      <div className={`${innerPad} ${className}`}>
        <h2 className="mb-8 text-center font-serif text-3xl font-bold tracking-tight text-primary">
          {title}
        </h2>
        <ProductGrid items={items} loading={loading} emptyLabel={emptyLabel} />
      </div>
    );
  }

  // Varsayılan "boxed" görünüm (tek başına kullanılırken)
  return (
    <section
      className={["app-section", "app-section--tight", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={`rounded-xl bg-surface ${innerPad}`}>
        <h2 className="mb-8 text-center font-serif text-3xl font-bold tracking-tight text-primary">
          {title}
        </h2>

        <ProductGrid items={items} loading={loading} emptyLabel={emptyLabel} />
      </div>
    </section>
  );
}

function ProductGrid({ items, loading, emptyLabel }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-72 animate-pulse rounded-2xl bg-white/60"
          />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border p-10 text-secondary">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <HomeProductItem key={index} {...item} />
      ))}
    </div>
  );
}
