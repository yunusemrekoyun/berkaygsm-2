// src/components/shop/ShopPageProducts.jsx
import { useEffect, useRef } from "react";
import ShopPageProductItem from "./ShopPageProductItem";

export default function ShopPageProducts({
  products = [],
  totalCount = null,
  loading = false,
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
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-80 animate-pulse rounded-2xl bg-surface-light"
            />
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
