import { useEffect, useMemo, useState } from "react";
import SetsSetItem from "./SetsSetItem";

const pillBase =
  "inline-flex items-center rounded-full border px-4 py-2 text-sm transition";
const pillActive = "bg-accent border-accent text-white shadow";
const pillIdle = "border-border text-primary hover:bg-surface-hover";

export default function SetsSets({
  title = "Trousseau Packages",
  subtitle,
  tabs = [],
  items = [],
  loading = false,
  emptyLabel = "No packages match this filter.",
  cardCopy = {},
  allLabel = "All",
}) {
  const initialTab = tabs?.[0] ?? allLabel ?? "All";
  const [active, setActive] = useState(initialTab);

  useEffect(() => {
    const first = tabs?.[0] ?? allLabel ?? "All";
    if (!tabs?.includes(active)) setActive(first);
  }, [tabs, allLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    if (!items?.length) return [];
    const normalizedAll = String(allLabel || "All").toLowerCase();
    const isAll = String(active || "").toLowerCase() === normalizedAll;
    const activeIsValid = tabs?.includes(active);
    if (isAll || !activeIsValid) return items;
    return items.filter((i) =>
      (i.tags || []).some(
        (t) => String(t).toLowerCase() === String(active).toLowerCase()
      )
    );
  }, [active, items, tabs, allLabel]);

  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-6 py-14">
      <div className="rounded-2xl bg-surface-light p-6 sm:p-10 ring-1 ring-black/5">
        <div className="text-center">
          <h2 className="text-4xl font-serif font-extrabold tracking-tight text-primary">
            {title}
          </h2>
          {subtitle && (
            <p className="mx-auto mt-3 max-w-2xl text-secondary">{subtitle}</p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={`${pillBase} ${active === t ? pillActive : pillIdle}`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div
            className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2"
            data-animate="stagger"
            data-animate-children="> *"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-64 rounded-xl bg-white/70 ring-1 ring-black/5 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div
            className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2"
            data-animate="stagger"
            data-animate-children="> *"
          >
            {shown.map((s, i) => (
              <SetsSetItem key={i} {...s} copy={cardCopy} />
            ))}
            {shown.length === 0 && (
              <div className="col-span-full grid place-items-center rounded-xl border border-dashed border-border p-10 text-secondary">
                {emptyLabel}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
