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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative w-full ${widthClass} max-h-[90vh] overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-2xl`}
      >
        <header className="flex items-start justify-between border-b border-[var(--color-border-admin)] px-6 py-4">
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
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-3 border-t border-[var(--color-border-admin)] px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
