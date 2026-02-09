import React from "react";

export default function QtyStepper({
  value = 1,
  min = 1,
  max = 99,
  onChange,
  className = "",
}) {
  const parseNumber = (input, fallback) => {
    const numeric = Number(input);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const dec = () => {
    const current = parseNumber(value, min);
    onChange?.(Math.max(min, current - 1));
  };
  const inc = () => {
    const current = parseNumber(value, min);
    onChange?.(Math.min(max, current + 1));
  };

  const numericValue = parseNumber(value, min);
  const canDec = numericValue > min;
  const canInc = numericValue < max;

  return (
    <div className={["inline-flex items-center gap-2", className].join(" ")}>
      <button
        type="button"
        aria-label="Azalt"
        onClick={dec}
        disabled={!canDec}
        className="h-8 w-8 rounded-full border border-border bg-white text-base leading-none
                   hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
      >
        −
      </button>

      <div className="w-8 text-center text-sm font-semibold tabular-nums">
        {numericValue}
      </div>

      <button
        type="button"
        aria-label="Artır"
        onClick={inc}
        disabled={!canInc}
        className="h-8 w-8 rounded-full border border-border bg-white text-base leading-none
                   hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  );
}
