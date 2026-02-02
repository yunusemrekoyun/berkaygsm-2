import { getColorInfo } from "../../../utils/colors.js";

export default function ColorBadge({ value, showLabel = true, className = "" }) {
  const info = getColorInfo(value);
  if (!info.value) {
    return (
      <span
        className={`inline-flex items-center gap-2 text-xs text-[var(--color-text-admin-muted)] ${className}`}
      >
        —
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full bg-[var(--color-surface-light)] px-2 py-1 text-xs font-medium text-[var(--color-text-admin)] ${className}`}
    >
      <span
        className="h-3 w-3 rounded-full border border-white/70 shadow-inner"
        style={{ background: info.swatch }}
        aria-hidden="true"
      />
      {showLabel && <span>{info.label}</span>}
    </span>
  );
}
