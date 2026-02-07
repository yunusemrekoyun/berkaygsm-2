import SimilarProductItem from "./SimilarProductItem";
import { useStaticTranslation } from "../../i18n/staticContent.js";

export default function SimilarProducts({ items = [] }) {
  const t = useStaticTranslation();
  const copy = t("similarProducts") || {};
  return (
    <section className="rounded-2xl border border-border bg-surface-light p-6">
      <h2 className="mb-4 text-center font-serif text-2xl font-extrabold text-primary">
        {copy.heading || "Benzer Ürünler"}
      </h2>
      <div
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        data-animate="stagger"
        data-animate-children="> *"
      >
        {items.map((p) => (
          <SimilarProductItem key={p.id} {...p} />
        ))}
      </div>
    </section>
  );
}
