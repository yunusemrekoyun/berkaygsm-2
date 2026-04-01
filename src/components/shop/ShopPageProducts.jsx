// src/components/shop/ShopPageProducts.jsx
import { useEffect, useRef } from "react";
import ShopPageProductItem from "./ShopPageProductItem";

export default function ShopPageProducts({
  products = [],
  totalCount = null,
  loading = false,
  loadingCount = 12,
  emptyLabel = "Seçili filtrelere uygun ürün bulunamadı.",
  loadMoreLabel = "Daha fazla ürün göster",
  onLoadMore = null,
}) {
  const sentinelRef = useRef(null);
  const gridClass =
    "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  const resolvedTotal =
    typeof totalCount === "number" ? totalCount : products.length;
  const hasMore =
    typeof onLoadMore === "function" && resolvedTotal > products.length;

  useEffect(() => {
    if (!hasMore) return undefined;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver !== "function") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        onLoadMore();
      },
      { rootMargin: "320px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, products.length]);

  return (
    <div>
      {loading ? (
        <div
          className={gridClass}
          data-animate="stagger"
          data-animate-children="> *"
        >
          {Array.from({ length: loadingCount }).map((_, index) => (
            <div
              key={index}
              className="glass-surface overflow-hidden rounded-2xl bg-white ring-1 ring-border shadow-sm"
            >
              <div className="aspect-[4/5] w-full animate-pulse bg-surface-light/80" />
              <div className="space-y-3 p-4">
                <div className="h-5 w-3/4 animate-pulse rounded bg-surface-light" />
                <div className="h-5 w-1/2 animate-pulse rounded bg-surface-light/80" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div
            className={gridClass}
            data-animate="stagger"
            data-animate-children="> *"
          >
            {products.map((product) => (
              <ShopPageProductItem key={product.id || product.slug} product={product} />
            ))}
          </div>
          {products.length === 0 && (
            <div className="mt-8 grid place-items-center rounded-xl border border-dashed border-border p-10 text-secondary">
              {emptyLabel}
            </div>
          )}
          {hasMore ? (
            <div className="mt-8 flex justify-center">
              <button
                ref={sentinelRef}
                type="button"
                onClick={() => onLoadMore?.()}
                className="inline-flex items-center rounded-full border border-border bg-white/90 px-5 py-2.5 text-sm font-medium text-primary shadow-sm transition hover:bg-surface-light"
              >
                {loadMoreLabel}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
