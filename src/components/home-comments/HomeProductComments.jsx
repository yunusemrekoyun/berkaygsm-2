// src/components/home-comments/HomeProductComments.jsx
import HomeProductCommentItem from "./HomeProductCommentItem";
import { useStaticTranslation } from "../../i18n/staticContent.js";

export default function HomeProductComments({ title, items = [] }) {
  const t = useStaticTranslation();
  const resolvedTitle = title ?? t("homeComments.title");

  return (
    <section className="app-section">
      <h2 className="mb-10 text-balance text-center font-serif text-3xl font-bold tracking-tight text-primary">
        {resolvedTitle}
      </h2>

      <div
        className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(240px,1fr))]"
        data-animate="stagger"
        data-animate-children="> *"
      >
        {items.map((c, i) => (
          <HomeProductCommentItem key={i} {...c} />
        ))}
      </div>
    </section>
  );
}
