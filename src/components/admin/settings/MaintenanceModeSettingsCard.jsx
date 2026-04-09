import { useEffect, useState } from "react";
import { Loader2, MailWarning, Power, ShieldAlert } from "lucide-react";
import { siteModeApi } from "../../../api/siteMode.js";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(date);
}

export default function MaintenanceModeSettingsCard() {
  const [siteMode, setSiteMode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await siteModeApi.getManage();
        if (!mounted) return;
        setSiteMode(data);
      } catch (err) {
        if (mounted) setError(err?.message || "Tatil modu yüklenemedi");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const enabled = !!siteMode?.maintenanceModeEnabled;

  const handleToggle = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const next = await siteModeApi.updateManage(!enabled);
      setSiteMode(next);
      setMessage(
        !enabled
          ? "Tatil modu açıldı. Duyuru mailleri sıraya alındı."
          : "Tatil modu kapatıldı. Açılış mailleri sıraya alındı."
      );
    } catch (err) {
      setError(err?.message || "Tatil modu güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex h-full flex-col rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]">
      <header className="flex items-center gap-3 border-b border-[var(--color-border-admin)]/60 px-4 py-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-admin)]">
            Tatil Modu
          </h3>
          <p className="text-xs text-[var(--color-text-admin-muted)]">
            Public mağazayı bakım ekranına alır ve abone kullanıcılara duyuru gönderir.
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col justify-between px-4 py-4">
        <div className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {message}
            </div>
          ) : null}

          <div className="rounded-2xl border border-[var(--color-border-admin)]/60 bg-white/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--color-text-admin)]">
                  Durum
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
                  {loading
                    ? "Yükleniyor..."
                    : enabled
                    ? "Site şu an bakım ekranında."
                    : "Site normal modda yayında."}
                </div>
              </div>
              <div
                className={[
                  "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                  enabled
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700",
                ].join(" ")}
              >
                {enabled ? "Bakımda" : "Açık"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border-admin)]/60 bg-white/60 p-4 text-xs text-[var(--color-text-admin-muted)]">
            <div className="flex items-center gap-2 font-semibold text-[var(--color-text-admin)]">
              <MailWarning className="h-4 w-4" />
              Son duyuru
            </div>
            <div className="mt-2 space-y-1">
              <div>Durum: {siteMode?.lastAnnouncementState || "—"}</div>
              <div>Başlatıldı: {formatDate(siteMode?.lastAnnouncementQueuedAt)}</div>
              <div>Bitti: {formatDate(siteMode?.lastAnnouncementCompletedAt)}</div>
              <div>
                Alıcı / Başarılı / Hata:{" "}
                {Number(siteMode?.lastAnnouncementRecipientCount || 0)} /{" "}
                {Number(siteMode?.lastAnnouncementDeliveredCount || 0)} /{" "}
                {Number(siteMode?.lastAnnouncementFailedCount || 0)}
              </div>
              {siteMode?.announcementDispatching ? (
                <div className="text-amber-700">Mail gönderimi sürüyor...</div>
              ) : null}
              {siteMode?.lastAnnouncementError ? (
                <div className="text-rose-600">
                  Son hata: {siteMode.lastAnnouncementError}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <footer className="mt-6 border-t border-[var(--color-border-admin)]/60 pt-3">
          <button
            type="button"
            onClick={handleToggle}
            disabled={loading || saving}
            className={[
              "inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold",
              enabled
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : "bg-[var(--color-text-admin)] text-[var(--color-bg-admin)] hover:opacity-90",
              loading || saving ? "opacity-60" : "",
            ].join(" ")}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            {enabled ? "Tatil Modunu Kapat" : "Tatil Modunu Aç"}
          </button>
        </footer>
      </div>
    </section>
  );
}
