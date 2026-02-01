import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import {
  COLOR_PALETTE,
  dedupeColors,
  getColorInfo,
  normalizeColorValue,
} from "../../../utils/colors.js";

export default function ColorSelector({
  values = [],
  onChange,
  disabled = false,
}) {
  const [customColor, setCustomColor] = useState("#000000");

  const normalizedValues = useMemo(() => dedupeColors(values), [values]);

  const selectedSet = useMemo(() => {
    const set = new Set();
    normalizedValues.forEach((value) => set.add(value.toLowerCase()));
    return set;
  }, [normalizedValues]);

  const emitChange = (nextValues) => {
    if (disabled) return;
    const unique = dedupeColors(nextValues);
    onChange?.(unique);
  };

  const handleTogglePalette = (colorValue) => {
    if (disabled) return;
    const normalized = normalizeColorValue(colorValue);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (selectedSet.has(key)) {
      emitChange(normalizedValues.filter((item) => item.toLowerCase() !== key));
    } else {
      emitChange([...normalizedValues, normalized]);
    }
  };

  const handleAddCustom = () => {
    if (disabled) return;
    const normalized = normalizeColorValue(customColor);
    if (!normalized) return;
    emitChange([...normalizedValues, normalized]);
  };

  const handleRemove = (value) => {
    if (disabled) return;
    const key = value.toLowerCase();
    emitChange(normalizedValues.filter((item) => item.toLowerCase() !== key));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2">
        {COLOR_PALETTE.map((entry) => {
          const normalized = normalizeColorValue(entry.value);
          const active = selectedSet.has(normalized.toLowerCase());
          return (
            <button
              key={entry.value}
              type="button"
              disabled={disabled}
              onClick={() => handleTogglePalette(entry.value)}
              className={[
                "group flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition",
                active
                  ? "border-[var(--color-text-admin)] bg-[var(--color-bg-admin)]/40 text-[var(--color-text-admin)]"
                  : "border-[var(--color-border-admin)] bg-[var(--color-bg-card)] text-[var(--color-text-admin)] hover:border-[var(--color-text-admin)]",
                disabled ? "opacity-60" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-full border border-white/60 shadow-inner"
                style={{ background: entry.value }}
              >
                {active ? (
                  <Check className="h-3.5 w-3.5 text-white drop-shadow" />
                ) : null}
              </span>
              <span className="truncate">{entry.name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={customColor}
            onChange={(event) => setCustomColor(event.target.value)}
            disabled={disabled}
            className="h-9 w-9 cursor-pointer rounded-lg border border-[var(--color-border-admin)] bg-white p-0"
            title="Özel renk seç"
          />
          <div>
            <div className="text-xs font-semibold text-[var(--color-text-admin)]">
              Özel renk
            </div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              {customColor.toUpperCase()}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleAddCustom}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
        >
          Renk ekle
        </button>
        <p className="text-[11px] text-[var(--color-text-admin-muted)]">
          Daha spesifik örnekler oluşturmak için birden fazla ton ekleyin.
        </p>
      </div>

      {normalizedValues.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
            Seçilen renkler
          </div>
          <ul className="flex flex-wrap gap-2">
            {normalizedValues.map((value) => {
              const info = getColorInfo(value);
              return (
                <li key={value}>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs text-[var(--color-text-admin)]">
                    <span
                      className="h-4 w-4 rounded-full border border-white/80 shadow-inner"
                      style={{ background: info.swatch }}
                      aria-hidden="true"
                    />
                    <span>{info.label}</span>
                    {!disabled ? (
                      <button
                        type="button"
                        onClick={() => handleRemove(value)}
                        className="rounded-full p-0.5 text-[var(--color-text-admin-muted)] hover:text-[var(--color-text-admin)]"
                        aria-label={`Kaldır ${info.label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--color-border-admin)]/60 bg-[var(--color-bg-card)] px-3 py-2 text-xs text-[var(--color-text-admin-muted)]">
          Henüz renk seçilmedi.
        </div>
      )}
    </div>
  );
}
