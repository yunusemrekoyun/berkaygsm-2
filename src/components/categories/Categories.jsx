// src/components/categories/Categories.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import CategoryItem from "./CategoryItem";
import { categoryApi } from "../../api/categories";
import { mapCategoryTree } from "../../utils/catalog";
import { useStorefrontLang } from "../../context/LangContext.jsx";
import { useStaticTranslation } from "../../i18n/staticContent.js";

const DESKTOP_VISIBLE = 4;

export default function Categories({ title, items }) {
  const [categories, setCategories] = useState(items || []);
  const [loading, setLoading] = useState(!items);
  const scrollRef = useRef(null);
  const { lang } = useStorefrontLang();
  const t = useStaticTranslation();
  const copy = t("categoriesComponent") || {};
  const resolvedTitle = title || copy.title || "Öne Çıkan Kategoriler";
  const prevAria = copy.prev || "Önceki kategoriler";
  const nextAria = copy.next || "Sonraki kategoriler";

  useEffect(() => {
    if (items) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const tree = await categoryApi.tree(lang);
        if (!mounted) return;
        const mapped = mapCategoryTree(tree).map((node) => ({
          id: node.id,
          title: node.name,
          image: node.image,
          to: `/shop?category=${node.id}`,
        }));
        setCategories(mapped);
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [items, lang]);

  const showCarousel = useMemo(() => {
    return (categories?.length || 0) > DESKTOP_VISIBLE;
  }, [categories]);

  const scrollByCard = (direction) => {
    const container = scrollRef.current;
    if (!container) return;
    const card = container.querySelector("[data-category-card]");
    const shift = card ? card.clientWidth + 32 : 300;
    container.scrollBy({
      left: direction * shift,
      behavior: "smooth",
    });
  };

  const gridClass =
    "grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4";

  return (
    <section className="app-section app-section--tight">
      <h2 className="mb-10 text-balance text-center text-3xl font-serif font-bold tracking-tight text-primary">
        {resolvedTitle}
      </h2>

      {loading ? (
        <div
          className={gridClass}
          data-animate="stagger"
          data-animate-children="> *"
        >
          {Array.from({ length: DESKTOP_VISIBLE }).map((_, index) => (
            <div
              key={index}
              className="h-80 animate-pulse rounded-2xl bg-surface-light"
            />
          ))}
        </div>
      ) : showCarousel ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-secondary shadow md:inline-flex hover:text-primary"
            aria-label={prevAria}
          >
            ‹
          </button>
          <div
            ref={scrollRef}
            className="flex snap-x snap-mandatory gap-8 overflow-x-auto pb-4 md:pb-6 no-scrollbar"
            data-animate="stagger"
            data-animate-children="[data-category-card]"
            data-stagger="0.08"
          >
            {categories.map((category) => (
              <div
                key={category.id || category.title}
                data-category-card
                className="w-[260px] shrink-0 snap-start"
              >
                <CategoryItem {...category} />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-secondary shadow md:inline-flex hover:text-primary"
            aria-label={nextAria}
          >
            ›
          </button>
        </div>
      ) : (
        <div
          className={gridClass}
          data-animate="stagger"
          data-animate-children="> *"
        >
          {categories.map((category) => (
            <CategoryItem key={category.id || category.title} {...category} />
          ))}
        </div>
      )}
    </section>
  );
}
