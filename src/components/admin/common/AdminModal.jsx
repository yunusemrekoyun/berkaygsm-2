import { X } from "lucide-react";

export default function AdminModal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  widthClass = "max-w-5xl",
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-3 py-3 sm:items-center sm:px-4 sm:py-6">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative w-full ${widthClass} max-h-[92vh] overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-2xl sm:max-h-[90vh]`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border-admin)] px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-admin)]">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-[var(--color-text-admin-muted)] hover:bg-[var(--color-bg-hover)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="max-h-[72vh] overflow-y-auto px-4 py-4 sm:max-h-[70vh] sm:px-6 sm:py-5">
          {children}
        </div>
        {footer && (
          <footer className="flex flex-col-reverse gap-3 border-t border-[var(--color-border-admin)] px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
