export default function DiscountBadge({
  percentage,
  size = "md",
  className = "",
  prefix = "-",
}) {
  const value = Number(percentage);
  if (!Number.isFinite(value) || value <= 0) return null;

  const sizeClass = size === "sm"
    ? "px-2 py-1 text-[11px]"
    : size === "lg"
    ? "px-4 py-2 text-sm"
    : "px-3 py-1.5 text-xs";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-rose-600 font-semibold text-white shadow-sm ${sizeClass} ${className}`.trim()}
    >
      {`${prefix}${Math.round(value)}%`}
    </span>
  );
}
