import { useEffect, useState } from "react";

const pillBase =
  "inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition";
const pillActive = "bg-accent border-accent text-white shadow";
const pillIdle = "glass-chip border-border text-primary hover:bg-surface-hover";

const isHexColor = (value) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || "");

export default function ShopPageFilter({
  categoryTree = [],
  loading = false,
  selectedCategory = "all",
  onCategoryChange,
  colors = [],
  selectedColor = "",
  onColorChange,
  sizes = [],
  selectedSize = "",
  onSizeChange,
  priceRange = { min: 0, max: 0 },
  selectedPrice,
  onPriceChange,
  onReset,
  labels = {},
}) {
  const maxPrice = priceRange.max ?? 0;
  const minPrice = priceRange.min ?? 0;
  const sliderValue = selectedPrice ?? maxPrice;

  const [openNodes, setOpenNodes] = useState(new Set());

  useEffect(() => {
    setOpenNodes(new Set());
  }, [categoryTree]);

  useEffect(() => {
    if (!selectedCategory || selectedCategory === "all") return;
    const pathIds = findCategoryPath(categoryTree, selectedCategory);
    if (!pathIds.length) return;
    setOpenNodes((prev) => {
      const next = new Set(prev);
      pathIds.forEach((id) => next.add(id));
      return next;
    });
  }, [categoryTree, selectedCategory]);

  const toggleNode = (id) => {
    setOpenNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const text = {
    title: labels.title || "Filtreler",
    reset: labels.reset || "Sıfırla",
    categories: labels.categories || "Kategoriler",
    allProducts: labels.allProducts || "Tüm ürünler",
    size: labels.size || "Model",
    color: labels.color || "Renk",
    price: labels.price || "Fiyat Aralığı",
    expand: labels.expand || "Aç",
    collapse: labels.collapse || "Kapat",
  };

  return (
    <aside
      className="glass-surface min-h-[560px] rounded-xl bg-contact-bg p-5 ring-1 ring-border"
      data-animate="fade-right"
    >
      {loading ? (
        <FilterSkeleton title={text.title} />
      ) : (
        <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-primary">{text.title}</h3>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-secondary hover:text-accent"
        >
          {text.reset}
        </button>
      </div>

      {/* Categories */}
      <section className="mt-5">
        <header className="mb-2 text-sm font-medium text-primary">
          {text.categories}
        </header>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onCategoryChange?.({ id: "all" })}
            className={`rounded-lg px-3 py-1.5 text-left text-sm transition ${
              selectedCategory === "all"
                ? "bg-accent/10 text-accent"
                : "text-primary hover:bg-surface-hover"
            }`}
          >
            {text.allProducts}
          </button>

          <CategoryTreeList
            tree={categoryTree}
            selectedId={selectedCategory}
            onSelect={(id) => onCategoryChange?.({ id })}
            openNodes={openNodes}
            onToggle={toggleNode}
            labels={text}
          />
        </div>
      </section>

      {/* Sizes */}
      {sizes.length > 0 && (
        <section className="mt-6">
          <header className="mb-2 text-sm font-medium text-primary">{text.size}</header>
          <div className="flex flex-wrap gap-2">
            {sizes.map((option) => (
              <button
                key={option}
                onClick={() =>
                  onSizeChange?.(selectedSize === option ? "" : option)
                }
                className={`${pillBase} ${
                  selectedSize === option ? pillActive : pillIdle
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Colors */}
      {colors.length > 0 && (
        <section className="mt-6">
          <header className="mb-2 text-sm font-medium text-primary">{text.color}</header>
          <div className="flex flex-wrap items-center gap-3">
            {colors.map((option) => {
              const isActive = selectedColor === option.value;
              const swatch = option.swatch || option.value;
              const isHex = isHexColor(swatch);
              return (
                <button
                  key={option.value}
                  onClick={() =>
                    onColorChange?.(isActive ? "" : option.value)
                  }
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${
                    isActive ? "border-accent bg-accent text-white" : pillIdle
                  }`}
                  >
                    {isHex && (
                      <span
                        className="inline-block h-4 w-4 rounded-full border border-border"
                        style={{ backgroundColor: swatch }}
                      />
                    )}
                    <span>{option.label}</span>
                  </button>
                );
            })}
          </div>
        </section>
      )}

      {/* Price */}
      {maxPrice > 0 && (
        <section className="mt-6">
          <header className="mb-2 text-sm font-medium text-primary">
            {text.price}
          </header>
          <input
            type="range"
            min={minPrice}
            max={maxPrice}
            step={Math.max(1, Math.round((maxPrice - minPrice) / 20))}
            value={sliderValue}
            onChange={(event) => onPriceChange?.(Number(event.target.value))}
            className="w-full accent-accent"
          />
          <div className="mt-2 flex justify-between text-sm text-secondary/80">
            <span>{formatCurrency(minPrice)}</span>
            <span>{formatCurrency(sliderValue)}</span>
            <span>{formatCurrency(maxPrice)}</span>
          </div>
        </section>
      )}
        </>
      )}
    </aside>
  );
}

function FilterSkeleton({ title = "Filtreler" }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-primary">{title}</h3>
        <div className="h-4 w-14 animate-pulse rounded bg-surface-light/80" />
      </div>

      <section className="mt-5">
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-surface-light/80" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-9 animate-pulse rounded-lg bg-surface-light"
            />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 h-4 w-20 animate-pulse rounded bg-surface-light/80" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-9 w-20 animate-pulse rounded-full bg-surface-light"
            />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-surface-light/80" />
        <div className="h-10 animate-pulse rounded-xl bg-surface-light" />
        <div className="mt-3 flex justify-between">
          <div className="h-4 w-12 animate-pulse rounded bg-surface-light/80" />
          <div className="h-4 w-12 animate-pulse rounded bg-surface-light/80" />
          <div className="h-4 w-12 animate-pulse rounded bg-surface-light/80" />
        </div>
      </section>
    </>
  );
}

function CategoryTreeList({
  tree = [],
  selectedId,
  onSelect,
  openNodes,
  onToggle,
  depth = 0,
  labels = {},
}) {
  if (!tree?.length) return null;
  return (
    <ul className="space-y-1">
      {tree.map((node) => (
        <CategoryTreeItem
          key={node.id}
          node={node}
          depth={depth}
          selectedId={selectedId}
          onSelect={onSelect}
          openNodes={openNodes}
          onToggle={onToggle}
          labels={labels}
        />
      ))}
    </ul>
  );
}

function CategoryTreeItem({
  node,
  depth,
  selectedId,
  onSelect,
  openNodes,
  onToggle,
  labels = {},
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isOpen = openNodes.has(node.id);
  const isActive = String(selectedId) === String(node.id);
  const expandLabel = labels?.expand || "Aç";
  const collapseLabel = labels?.collapse || "Kapat";

  return (
    <li>
      <div
        className={`flex items-center rounded-lg px-2 py-1 transition ${
          isActive ? "bg-accent/10 text-accent" : "hover:bg-surface-hover"
        }`}
        style={{ paddingLeft: depth * 14 + 8 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="mr-2 text-xs text-secondary"
            aria-label={isOpen ? collapseLabel : expandLabel}
          >
            {isOpen ? "–" : "+"}
          </button>
        ) : (
          <span className="mr-2 text-xs text-secondary">•</span>
        )}
        <button
          type="button"
          onClick={() => onSelect?.(node.id)}
          className={`flex-1 text-left text-sm ${
            isActive ? "font-semibold text-accent" : "text-primary"
          }`}
        >
          {node.name}
        </button>
      </div>
      {hasChildren && isOpen && (
        <CategoryTreeList
          tree={node.children}
          selectedId={selectedId}
          onSelect={onSelect}
          openNodes={openNodes}
          onToggle={onToggle}
          labels={labels}
          depth={depth + 1}
        />
      )}
    </li>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function findCategoryPath(tree = [], targetId) {
  const stack = tree.map((node) => ({ node, path: [node.id] }));
  while (stack.length) {
    const { node, path } = stack.pop();
    if (String(node.id) === String(targetId)) return path;
    if (node.children?.length) {
      node.children.forEach((child) => {
        stack.push({ node: child, path: [...path, child.id] });
      });
    }
  }
  return [];
}
