import { Loader2, Languages } from "lucide-react";
import AdminModal from "../common/AdminModal.jsx";
import AlertBanner from "../../ui/AlertBanner.jsx";

function PanelCard({
  label,
  summary,
  dirty,
  saving,
  onCopy,
  onReset,
  onSave,
  children,
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-admin)]">
            <Languages className="h-4 w-4" />
            {label}
            {dirty && (
              <span className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                Kaydedilmemiş
              </span>
            )}
          </div>
          {summary && (
            <p className="mt-1 break-words text-xs text-[var(--color-text-admin-muted)]">
              {summary}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {onCopy && (
            <button
              type="button"
              className="rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
              onClick={onCopy}
            >
              Türkçeden kopyala
            </button>
          )}
          {onReset && (
            <button
              type="button"
              className="rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
              onClick={onReset}
            >
              Sıfırla
            </button>
          )}
          {onSave && (
            <button
              type="button"
              disabled={saving}
              className="rounded-full bg-[var(--color-primary)] px-4 py-1.5 text-[var(--color-text-on-primary)] font-semibold disabled:opacity-70"
              onClick={onSave}
            >
              {saving ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kaydediliyor...
                </span>
              ) : (
                "Kaydet"
              )}
            </button>
          )}
        </div>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function TranslationModal({
  open,
  onClose,
  title,
  description,
  loading,
  error,
  emptyMessage,
  alert,
  onDismissAlert,
  panels = [],
  footer,
}) {
  let content = null;

  if (loading) {
    content = (
      <div className="flex items-center justify-center py-12 text-[var(--color-text-admin-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">İçerik yükleniyor…</span>
      </div>
    );
  } else if (error) {
    content = (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
        {error}
      </div>
    );
  } else if (emptyMessage) {
    content = (
      <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-4 py-6 text-center text-sm text-[var(--color-text-admin-muted)]">
        {emptyMessage}
      </div>
    );
  } else if (!panels.length) {
    content = (
      <div className="rounded-2xl border border-dashed border-[var(--color-border-admin)] px-4 py-6 text-center text-sm text-[var(--color-text-admin-muted)]">
        Gösterilecek dil bulunamadı.
      </div>
    );
  } else {
    content = (
      <div className="space-y-4">
        {alert && (
          <AlertBanner
            variant={alert.variant}
            message={alert.message}
            onClose={onDismissAlert}
          />
        )}
        {panels.map((panel) => (
          <PanelCard key={panel.value} {...panel}>
            {typeof panel.render === "function" ? panel.render(panel) : null}
          </PanelCard>
        ))}
      </div>
    );
  }

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        footer || (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] sm:w-auto"
          >
            Kapat
          </button>
        )
      }
    >
      {content}
    </AdminModal>
  );
}
