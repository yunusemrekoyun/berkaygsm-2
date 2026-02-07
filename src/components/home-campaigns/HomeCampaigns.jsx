// src/components/home-campaigns/HomeCampaigns.jsx
import HomeCampaignItem from "./HomeCampaignItem";

export default function HomeCampaigns({ items = [], loading = false }) {
  if (!items.length && !loading) return null;

  const fallbackVariant = (index) => {
    if (index === 0) return "big";
    if (index === 1) return "wide";
    return "small";
  };

  return (
    <section className="app-section">
      <div
        className="grid auto-rows-[260px] grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4 md:grid-rows-[260px_260px] md:auto-rows-[260px]"
        data-animate="fade-up"
        data-animate-distance="18"
        data-animate-duration="1.1"
        data-animate-ease="power3.out"
        data-animate-start="top 100%"
      >
        {loading && items.length === 0
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={`h-full rounded-2xl bg-[var(--color-bg-card)]/60 ${
                  fallbackVariant(index) === "big"
                    ? "md:col-span-2 md:row-span-2"
                    : fallbackVariant(index) === "wide"
                    ? "md:col-span-2 md:row-span-1"
                    : "md:col-span-1 md:row-span-1"
                } animate-pulse`}
              />
            ))
          : items.map((item, index) => (
              <HomeCampaignItem
                key={item.id || `${item.to}-${index}`}
                {...item}
                variant={item.variant || fallbackVariant(index)}
              />
            ))}
      </div>
    </section>
  );
}
