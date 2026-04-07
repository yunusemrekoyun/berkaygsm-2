import { HardDrive, FileImage, Server } from "lucide-react";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || value % 1 === 0 ? 0 : 1)} ${units[index]}`;
}

export default function MediaUsageCard({ usage, refreshing }) {
  const storage = usage?.storage || {};
  const resourcesCount = usage?.resourcesCount ?? null;

  return (
    <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-admin)]">
            Disk Kullanımı
          </h2>
          <p className="text-sm text-[var(--color-text-admin-muted)]">
            <span className="inline-flex items-center gap-1">
              <Server className="h-3.5 w-3.5" />
              VPS Local Storage
            </span>
            {usage?.lastUpdated && (
              <> • Güncelleme: {usage.lastUpdated}</>
            )}
          </p>
        </div>
        {refreshing && (
          <span className="text-xs text-[var(--color-text-admin-muted)]">
            Yenileniyor…
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <UsageMetric
          icon={HardDrive}
          title="Disk Kullanımı"
          used={storage.usedBytes}
          limit={storage.limitBytes}
          percent={storage.usedPercent}
          accent="var(--color-accent)"
          emptyLabel={storage.limitBytes ? undefined : "Limitsiz"}
        />
        <div className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/60 p-4 flex items-center gap-4">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl text-white shrink-0"
            style={{ background: "var(--color-secondary)" }}
          >
            <FileImage className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-admin)]">
              Toplam Varlık
            </h3>
            <p className="text-2xl font-bold text-[var(--color-text-admin)] mt-0.5">
              {resourcesCount ?? "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsageMetric({ icon: Icon, title, used, limit, percent, accent, emptyLabel }) {
  const valuePercent = percent != null ? Math.min(percent, 100) : null;
  return (
    <div className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/60 p-4">
      <div className="flex items-center gap-3">
        <div
          className="grid h-10 w-10 place-items-center rounded-xl text-white shrink-0"
          style={{ background: accent }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-admin)]">
            {title}
          </h3>
          <p className="text-xs text-[var(--color-text-admin-muted)]">
            {formatBytes(used)} / {limit ? formatBytes(limit) : (emptyLabel || "∞")}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border-admin)]/60">
          <div
            className="h-full rounded-full"
            style={{
              width: `${valuePercent != null ? valuePercent.toFixed(1) : 0}%`,
              background: accent,
              transition: "width 200ms ease",
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-admin-muted)]">
          <span>{formatBytes(used)}</span>
          <span>{valuePercent != null ? `${valuePercent.toFixed(1)}%` : "—"}</span>
        </div>
      </div>
    </div>
  );
}

export function MediaUsageSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-5 shadow-sm">
      <div className="h-6 w-40 animate-pulse rounded bg-[var(--color-bg-hover)]" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-hover)]"
          />
        ))}
      </div>
    </div>
  );
}

export function formatBytesShort(bytes) {
  return formatBytes(bytes);
}
