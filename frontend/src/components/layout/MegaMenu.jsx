// src/components/nav/MegaMenu.jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export default function MegaMenu({ label, data = [], onRootClick }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const closeTimer = useRef(null);

  useEffect(() => {
    if (!data.length) {
      setActive(0);
      return;
    }
    const firstWithChildren = data.findIndex((item) => item.children?.length);
    setActive(firstWithChildren >= 0 ? firstWithChildren : 0);
  }, [data]);

  const openMenu = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const delayedClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 130);
  };

  return (
    <div
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={delayedClose}
    >
      {/* Trigger */}
      <button
        className="text-sm font-medium hover:text-accent focus:outline-none py-3"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => {
          if (onRootClick) onRootClick();
          setOpen(false);
        }}
      >
        {label}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          // sabitle: parent overflow’tan bağımsız
          className="
            fixed left-1/2 z-[80] mt-2 -translate-x-1/2
            w-[min(1100px,92vw)]
          "
          role="menu"
        >
          <div className="flex overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
            {/* Sol kolon */}
            <ul className="w-64 max-h-[420px] overflow-auto border-r border-border/60 bg-surface-light/50 p-2">
              {data.map((item, i) => {
                const isActive = i === active;
                return (
                  <li key={item.key || item.title}>
                    <Link
                      to={item.to ?? "#"}
                      onMouseEnter={() => setActive(i)}
                      className={[
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm",
                        isActive
                          ? "bg-surface-hover text-primary"
                          : "hover:bg-surface-hover text-primary",
                      ].join(" ")}
                    >
                      {item.title}
                      <span className="text-secondary/60">›</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Sağ panel */}
            <div className="flex-1 p-4">
              <RightPanel items={data[active]?.children ?? []} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RightPanel({ items }) {
  if (!items?.length) {
    return (
      <div className="grid h-full place-items-center rounded-lg border border-dashed border-border/70 bg-surface-hover p-8 text-center text-secondary">
        No subcategories
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((c) => (
        <Link
          key={c.key || c.title}
          to={c.to ?? "#"}
          className="group flex gap-3 overflow-hidden rounded-lg border border-border/60 bg-white p-3 hover:shadow-sm"
        >
          {c.image && (
            <img
              src={c.image}
              alt={c.title}
              className="h-16 w-20 flex-none rounded-md object-cover"
              draggable="false"
            />
          )}
          <div>
            <div className="text-sm font-semibold text-primary group-hover:text-accent">
              {c.title}
            </div>
            {c.description && (
              <p className="mt-1 line-clamp-2 text-xs text-secondary">
                {c.description}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
