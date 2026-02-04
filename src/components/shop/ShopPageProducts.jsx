// src/components/shop/ShopPageProducts.jsx
import ShopPageProductItem from "./ShopPageProductItem";

export default function ShopPageProducts({
  products = [],
  loading = false,
  emptyLabel = "No products found for selected filters.",
}) {
  return (
    <div>
      {loading ? (
        <div
          className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6"
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
            className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6"
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
