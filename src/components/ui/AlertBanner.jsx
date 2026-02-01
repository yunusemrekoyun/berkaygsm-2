import { X } from "lucide-react";

const VARIANTS = {
  info: "bg-sky-50 text-sky-800 border-sky-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function AlertBanner({
  title,
  message,
  variant = "info",
  onClose,
  icon,
  className = "",
}) {
  const tone = VARIANTS[variant] || VARIANTS.info;
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${tone} ${className}`.trim()}
      role="alert"
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="flex-1 space-y-1">
        {title && <h3 className="font-medium leading-none">{title}</h3>}
        <p className="leading-snug">{message}</p>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/40 focus:outline-none"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
