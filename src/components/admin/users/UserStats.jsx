import { ShieldCheck, TrendingUp, UserPlus, Users } from "lucide-react";
import { formatRelative } from "./helpers.js";

export default function UserStats({ metrics = {} }) {
  const cards = [
    {
      title: "Toplam Kullanıcı",
      value: formatNumber(metrics.totalUsers),
      Icon: Users,
      accent: "from-sky-500/25 via-sky-500/10 to-transparent",
      helper:
        metrics.latestUser?.fullName && metrics.latestUser?.createdAt
          ? `Son kayıt ${formatRelative(metrics.latestUser.createdAt)}`
          : "Tüm hesaplar",
    },
    {
      title: "Yöneticiler",
      value: formatNumber(metrics.adminUsers),
      Icon: ShieldCheck,
      accent: "from-indigo-500/25 via-indigo-500/10 to-transparent",
      helper:
        metrics.adminUsers === 1
          ? "Tek yönetici"
          : `${formatNumber(metrics.adminUsers || 0)} ekip üyesi`,
    },
    {
      title: "Yeni (30 gün)",
      value: formatNumber(metrics.newUsersLast30Days),
      Icon: UserPlus,
      accent: "from-emerald-500/25 via-emerald-500/10 to-transparent",
      helper: "Son 30 gün",
    },
    {
      title: "Büyüme",
      value: `${formatGrowth(metrics.growthRate30Days)}%`,
      Icon: TrendingUp,
      accent:
        (metrics.growthRate30Days ?? 0) >= 0
          ? "from-teal-500/25 via-teal-500/10 to-transparent"
          : "from-rose-500/25 via-rose-500/10 to-transparent",
      helper:
        (metrics.growthRate30Days ?? 0) >= 0
          ? "önceki 30 güne göre"
          : "önceki döneme göre yavaşlama",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.Icon;
        return (
          <article
            key={card.title}
            className="relative overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-5 shadow-sm transition-all hover:shadow-md"
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-[0.55]`}
              aria-hidden="true"
            />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.08em] text-[var(--color-text-admin-muted)]">
                  {card.title}
                </p>
                <p className="mt-4 text-3xl font-semibold text-[var(--color-text-admin)]">
                  {card.value}
                </p>
                <p className="mt-2 text-xs text-[var(--color-text-admin-muted)]">
                  {card.helper}
                </p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/30 backdrop-blur">
                <Icon className="h-5 w-5 text-[var(--color-text-admin)]" />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function formatGrowth(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "0";
  }
  const n = Number(value);
  const formatted = Math.abs(n).toFixed(1);
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return "0.0";
}

function formatNumber(value) {
  if (value === undefined || value === null) return "0";
  const n = Number(value);
  if (Number.isNaN(n)) return "0";
  return n.toLocaleString("tr-TR");
}
