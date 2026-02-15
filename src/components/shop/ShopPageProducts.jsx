// src/components/shop/ShopPageProducts.jsx
import ShopPageProductItem from "./ShopPageProductItem";

export default function ShopPageProducts({
  products = [],
  loading = false,
  emptyLabel = "Seçili filtrelere uygun ürün bulunamadı.",
}) {
  const gridClass =
    "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

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
        </>
      )}
    </div>
  );
}
