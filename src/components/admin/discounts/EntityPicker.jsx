import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";

export default function EntityPicker({
  label,
  options = [],
  value = [],
  onChange,
  placeholder = "Ara…",
  emptyText = "Öğe bulunamadı",
  helper,
  disabled = false,
}) {
  const [query, setQuery] = useState("");

  const inputId = useMemo(
    () => `entitypicker-${Math.random().toString(36).slice(2)}`,
    []
  );

  const selectedIds = useMemo(
    () => new Set(value.map((item) => item.id)),
    [value]
  );

  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return options
      .filter((option) => !selectedIds.has(option.id))
      .filter((option) =>
        !lower ? true : option.label.toLowerCase().includes(lower)
      )
      .slice(0, 25);
  }, [options, query, selectedIds]);

  const addOption = (option) => {
    if (!option || selectedIds.has(option.id) || disabled) return;
    onChange?.([...value, option]);
    setQuery("");
  };

  const removeOption = (id) => {
    if (disabled) return;
    onChange?.(value.filter((item) => item.id !== id));
  };

  return (
    <div className="block">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]"
        >
          {label}
        </label>
      )}
      <div
        className={`rounded-xl border px-3 py-2 transition ${
          disabled
            ? "border-[var(--color-border-admin)]/70 bg-[var(--color-bg-card)]/70"
            : "border-[var(--color-border-admin)] bg-[var(--color-bg-card)] focus-within:border-[var(--color-text-admin)]"
        }`}
      >
        <div className="flex flex-wrap gap-2">
          {value.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-bg-hover)] px-3 py-1 text-sm text-[var(--color-text-admin)]"
            >
              <span className="truncate max-w-[160px]" title={item.label}>
                {item.label}
                {item.hint && (
                  <span className="ml-1 text-xs text-[var(--color-text-admin-muted)]">
                    {item.hint}
                  </span>
                )}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeOption(item.id)}
                  className="text-[var(--color-text-admin-muted)] hover:text-[var(--color-text-admin)]"
                  aria-label={`${item.label} kaldır`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2">
          <Search className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
          <input
            id={inputId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            className="flex-1 border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none placeholder:text-[var(--color-text-admin-muted)]"
          />
        </div>

        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-dashed border-[var(--color-border-admin)]/70 bg-[var(--color-bg-hover)]/40">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-[var(--color-text-admin-muted)]">
              {emptyText}
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border-admin)]/50">
              {filtered.map((option) => (
                <li
                  key={option.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p
                      className="truncate text-[var(--color-text-admin)]"
                      title={option.label}
                    >
                      {option.label}
                    </p>
                    {option.hint && (
                      <p className="text-xs text-[var(--color-text-admin-muted)]">
                        {option.hint}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => addOption(option)}
                    disabled={disabled}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" /> Ekle
                </button>
              </li>
            ))}
            </ul>
          )}
        </div>
      </div>
      {helper && (
        <p className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
          {helper}
        </p>
      )}
    </div>
  );
}
