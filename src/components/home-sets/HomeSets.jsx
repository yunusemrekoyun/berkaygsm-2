// src/components/home-sets/HomeSets.jsx
import { useEffect, useMemo, useState } from "react";
import HomeSetItem from "./HomeSetItem";
import { useStaticTranslation } from "../../i18n/staticContent.js";

const pillBase =
  "inline-flex items-center rounded-full border px-4 py-2 text-sm transition";
const pillActive = "bg-accent border-accent text-white shadow";
const pillIdle = "glass-chip border-border text-primary hover:bg-surface-hover";

export default function HomeSets({
  title,
  subtitle,
  tabs = [],
  items = [],
  variant = "standard", // "standard" | "compact"
  viewAllHref = "/sets",
  loading = false, // <<< NEW
}) {
  const t = useStaticTranslation();
  const defaultAll = t("homeSets.tabsAll") || "Tümü";
  const displayTabs = useMemo(
    () => (tabs.length ? tabs : [defaultAll]),
    [tabs, defaultAll]
  );
  const [active, setActive] = useState(displayTabs[0]);

  useEffect(() => {
    setActive(displayTabs[0]);
  }, [displayTabs]);

  const shown = useMemo(() => {
    if (active === defaultAll || active === displayTabs[0]) return items;
    return items.filter((i) => i.tags?.includes(active));
  }, [active, items, defaultAll, displayTabs]);

  const isCompact = variant === "compact";

  return (
    <section
      className={[
        "app-section",
        isCompact ? "app-section--tight" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "glass-surface rounded-2xl ring-1 ring-black/5",
          isCompact ? "bg-white p-5" : "bg-surface-light p-6 sm:p-10",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className={isCompact ? "text-left" : "text-center w-full"}>
            <h2
              className={[
                "font-serif font-extrabold tracking-tight text-primary",
                isCompact ? "text-2xl" : "text-4xl",
              ].join(" ")}
            >
              {title || t("homePage.sections.setsTitle")}
            </h2>
            {(subtitle ?? t("homePage.sections.setsSubtitle")) && (
              <p
                className={[
                  "text-secondary",
                  isCompact
                    ? "mt-1 text-sm max-w-xl"
                    : "mx-auto mt-3 max-w-2xl",
                ].join(" ")}
              >
                {subtitle ?? t("homePage.sections.setsSubtitle")}
              </p>
            )}
          </div>

          {/* View all (compact’te üst sağda) */}
          {isCompact && !loading && (
            <a
              href={viewAllHref}
              className="glass-chip inline-flex items-center rounded-full border border-border px-3 py-1.5 text-sm text-primary hover:bg-surface-hover"
            >
              {t("homeSets.viewAll")}
            </a>
          )}
        </div>

        {/* Pills */}
        <div
          className={[
            "mt-4 flex flex-wrap justify-center gap-2",
            isCompact && "justify-start",
          ].join(" ")}
        >
          {loading
            ? // Skeleton pills
              Array.from({ length: 4 }).map((_, i) => (
                <span
                  key={i}
                  className="h-8 w-20 animate-pulse rounded-full bg-surface-hover/80"
                />
              ))
            : displayTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActive(tab)}
                  className={[
                    pillBase,
                    active === tab ? pillActive : pillIdle,
                    isCompact && "px-3 py-1 text-xs",
                  ].join(" ")}
                >
                  {tab}
                </button>
              ))}
        </div>

        {/* Grid */}
        <div
          className={[
            "mt-6 grid gap-4",
            isCompact
              ? "grid-cols-1 min-[440px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6",
          ].join(" ")}
          data-animate="stagger"
          data-animate-children="> *"
        >
          {loading
            ? // Skeleton cards (compact için ölçüler uyumlu)
              Array.from({ length: isCompact ? 8 : 4 }).map((_, i) => (
                <article
                  key={i}
                  className={
                    isCompact
                      ? "glass-surface overflow-hidden rounded-xl bg-white ring-1 ring-border"
                      : "glass-surface overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
                  }
                >
                  <div
                    className={
                      isCompact
                        ? "h-36 w-full animate-pulse bg-surface-hover md:h-40"
                        : "h-56 w-full animate-pulse bg-surface-hover md:h-64"
                    }
                  />
                  <div className={isCompact ? "p-3" : "p-6"}>
                    <div className="h-4 w-2/3 animate-pulse rounded bg-surface-hover" />
                    <div className="mt-2 h-3 w-full animate-pulse rounded bg-surface-hover" />
                    <div className="mt-1 h-3 w-4/5 animate-pulse rounded bg-surface-hover" />
                  </div>
                </article>
              ))
            : shown.map((s, i) => (
                <HomeSetItem key={i} {...s} compact={isCompact} />
              ))}

          {!loading && shown.length === 0 && (
            <div className="col-span-full grid place-items-center rounded-xl border border-dashed border-border p-10 text-secondary">
              {t("homeSets.noResults")}
            </div>
          )}
        </div>

        {/* View all (standard’ta altta) */}
        {!isCompact && !loading && (
          <div className="mt-8 text-center">
            <a
              href={viewAllHref}
              className="glass-chip inline-flex items-center rounded-full border border-border px-4 py-2 text-sm text-primary hover:bg-surface-hover"
            >
              {t("homeSets.viewAllPackages")}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
