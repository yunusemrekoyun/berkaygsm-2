import { ArrowUpDown, ChevronDown, SlidersHorizontal } from "lucide-react";

export default function ShopPageSortBar({
  sortValue = "newest",
  onSortChange,
  sortOptions = [],
  labels = {},
  onOpenFilters = null,
}) {
  return (
    <div className="flex justify-end">
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
        {typeof onOpenFilters === "function" && (
          <button
            type="button"
            onClick={onOpenFilters}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-3 text-sm font-semibold text-primary shadow-sm transition hover:border-accent/50 hover:text-accent lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {labels.title || "Filtreler"}
          </button>
        )}

        <label className="group relative flex min-w-0 items-center gap-3 rounded-[24px] border border-border/70 bg-white/95 px-4 py-3 shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition hover:border-accent/40 focus-within:border-accent focus-within:bg-white sm:min-w-[280px]">
          <ArrowUpDown className="h-4 w-4 flex-shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary/70">
              {labels.sort || "Sıralama"}
            </span>
            <select
              value={sortValue}
              onChange={(event) => onSortChange?.(event.target.value)}
              className="mt-1 w-full appearance-none bg-transparent pr-8 text-base font-semibold text-primary outline-none sm:text-sm"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/70" />
        </label>
      </div>
    </div>
  );
}
