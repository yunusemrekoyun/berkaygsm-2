import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Package,
  ShoppingCart,
  Tag,
  Users,
} from "lucide-react";
import { dashboardApi } from "../../api/dashboard.js";

const EMPTY_DASHBOARD = {
  summary: {
    totalOrders: 0,
    totalVisits: 0,
    activeProducts: 0,
    activeCoupons: 0,
    totalRevenue: 0,
    paidOrders: 0,
    conversionRate: 0,
    paidRate: 0,
    deltas: {
      orders: "0%",
      visits: "0%",
      revenue: "0%",
    },
    recentActiveProducts: 0,
    recentActiveCoupons: 0,
  },
  charts: {
    revenueTrend: [],
    visitsOrdersTrend: [],
  },
  recentOrders: [],
  topItems: [],
};

const STATUS_BADGES = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  shipped: "bg-indigo-50 text-indigo-700 border-indigo-200",
  completed: "bg-slate-100 text-slate-700 border-slate-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

function useCountUp(target = 0, ms = 900) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    let raf;
    let start;

    const step = (time) => {
      if (!start) start = time;
      const progress = Math.min(1, (time - start) / ms);
      setVal(Math.round(progress * target));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return val;
}

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function money(value) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `TRY ${Number(value || 0).toFixed(2)}`;
  }
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseDelta(delta) {
  const normalized = String(delta || "0").trim();
  const numeric = Number(normalized.replace("%", ""));
  return {
    label: normalized || "0%",
    positive: Number.isFinite(numeric) ? numeric >= 0 : true,
  };
}

function RingStat({
  size = 96,
  value = 0,
  label = "",
  caption = "",
  color = "var(--color-accent)",
}) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf;
    let start;
    const target = Math.max(0, Math.min(100, Number(value || 0)));

    const animate = (ts) => {
      if (!start) start = ts;
      const progress = Math.min(1, (ts - start) / 1000);
      setPct(Math.round(progress * target));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div className="flex items-center gap-4">
      <div
        className="grid place-items-center rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(0,0,0,0.06) 0deg)`,
        }}
      >
        <div
          className="grid place-items-center rounded-full bg-bg-card"
          style={{
            width: size - 16,
            height: size - 16,
            boxShadow: "inset 0 0 0 1px var(--color-border-admin)",
          }}
        >
          <div className="text-lg font-semibold text-primary">{pct}%</div>
        </div>
      </div>
      <div className="space-y-0.5">
        <div className="text-sm text-text-admin-muted">{label}</div>
        <div className="text-xs text-secondary">{caption}</div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await dashboardApi.overview();
        if (!cancelled) {
          setDashboard({
            ...EMPTY_DASHBOARD,
            ...data,
            summary: {
              ...EMPTY_DASHBOARD.summary,
              ...(data?.summary || {}),
              deltas: {
                ...EMPTY_DASHBOARD.summary.deltas,
                ...(data?.summary?.deltas || {}),
              },
            },
            charts: {
              ...EMPTY_DASHBOARD.charts,
              ...(data?.charts || {}),
            },
            recentOrders: Array.isArray(data?.recentOrders) ? data.recentOrders : [],
            topItems: Array.isArray(data?.topItems) ? data.topItems : [],
          });
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError?.message || "Dashboard verileri yuklenemedi.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const timer = window.setTimeout(() => setEntered(true), 30);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const summary = dashboard.summary || EMPTY_DASHBOARD.summary;
  const revenueTrend = dashboard.charts?.revenueTrend || [];
  const visitsOrdersTrend = dashboard.charts?.visitsOrdersTrend || [];

  const ordersCount = useCountUp(summary.totalOrders || 0);
  const visitsCount = useCountUp(summary.totalVisits || 0);
  const productsCount = useCountUp(summary.activeProducts || 0);
  const couponsCount = useCountUp(summary.activeCoupons || 0);

  const orderDelta = parseDelta(summary.deltas?.orders);
  const visitDelta = parseDelta(summary.deltas?.visits);

  const revenueCaption = useMemo(() => {
    return summary.deltas?.revenue
      ? `Gelir degisimi ${summary.deltas.revenue}`
      : "Son 14 gun";
  }, [summary.deltas?.revenue]);

  return (
    <section
      className={cls(
        "transition-opacity duration-500",
        entered ? "opacity-100" : "opacity-0"
      )}
    >
      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<ShoppingCart className="h-5 w-5" />}
          title="Siparisler"
          value={ordersCount}
          delta={orderDelta.label}
          positive={orderDelta.positive}
          helper="Son 30 gun"
          loading={loading}
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          title="Ziyaretler"
          value={visitsCount}
          delta={visitDelta.label}
          positive={visitDelta.positive}
          helper="Son 30 gun"
          loading={loading}
        />
        <KpiCard
          icon={<Package className="h-5 w-5" />}
          title="Aktif Urunler"
          value={productsCount}
          note={`${summary.recentActiveProducts || 0} yeni urun / 30 gun`}
          loading={loading}
        />
        <KpiCard
          icon={<Tag className="h-5 w-5" />}
          title="Aktif Kuponlar"
          value={couponsCount}
          note={`${summary.recentActiveCoupons || 0} yeni kupon / 30 gun`}
          loading={loading}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Gelir" subtitle={revenueCaption} />
          <ChartShell loading={loading}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={revenueTrend}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-accent)"
                      stopOpacity={0.6}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-accent)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="var(--color-border-admin)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "var(--color-text-admin-muted)", fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: "var(--color-text-admin-muted)", fontSize: 12 }}
                  tickFormatter={(value) => `${Math.round(Number(value || 0))}`}
                />
                <Tooltip
                  formatter={(value) => [money(value), "Gelir"]}
                  contentStyle={{
                    background: "var(--color-bg-card)",
                    border: "1px solid var(--color-border-admin)",
                  }}
                  labelStyle={{ color: "var(--color-secondary)" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-accent)"
                  fill="url(#dashboardRevenueFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartShell>
        </Card>

        <Card>
          <CardHeader title="Ziyaret vs Siparis" subtitle="Son 7 gun" />
          <ChartShell loading={loading}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={visitsOrdersTrend}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--color-border-admin)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "var(--color-text-admin-muted)", fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: "var(--color-text-admin-muted)", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-bg-card)",
                    border: "1px solid var(--color-border-admin)",
                  }}
                  labelStyle={{ color: "var(--color-secondary)" }}
                />
                <Bar
                  dataKey="visits"
                  name="Ziyaret"
                  fill="var(--color-primary)"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="orders"
                  name="Siparis"
                  fill="var(--color-accent)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartShell>

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-text-admin-muted">
            <RingStat
              value={summary.conversionRate || 0}
              label="Donusum"
              caption="siparis / ziyaret"
              color="var(--color-primary)"
            />
            <RingStat
              value={summary.paidRate || 0}
              label="Odeme Basarisi"
              caption="paid ve sonrasi"
              color="var(--color-accent)"
            />
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Son Siparisler" subtitle="Son 10 kayit" />
          <OrdersTable rows={dashboard.recentOrders} loading={loading} />
        </Card>

        <Card>
          <CardHeader title="En Cok Satan Kalemler" subtitle="Son 30 gun geliri" />
          <TopItems items={dashboard.topItems} loading={loading} />
        </Card>
      </div>
    </section>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={cls(
        "rounded-2xl border border-[var(--color-border-admin)] bg-bg-card p-5 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle }) {
  return (
    <div className="mb-3">
      <div className="text-lg font-semibold text-primary">{title}</div>
      {subtitle ? (
        <div className="text-sm text-text-admin-muted">{subtitle}</div>
      ) : null}
    </div>
  );
}

function ChartShell({ children, loading = false }) {
  return (
    <div className="h-72">
      {loading ? (
        <div className="h-full animate-pulse rounded-xl bg-[var(--color-bg-admin)]/70" />
      ) : (
        children
      )}
    </div>
  );
}

function KpiCard({
  icon,
  title,
  value,
  delta = "",
  positive = true,
  helper = "",
  note = "",
  loading = false,
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-light text-primary">
          {icon}
        </div>
        {delta ? (
          <div
            className={cls(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
              positive
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            )}
          >
            {positive ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            {delta}
          </div>
        ) : null}
      </div>

      <div className="mt-4 text-3xl font-extrabold text-primary">
        {loading ? "..." : value.toLocaleString("tr-TR")}
      </div>
      <div className="text-sm text-text-admin-muted">{title}</div>
      {helper ? <div className="mt-1 text-xs text-secondary">{helper}</div> : null}
      {note ? <div className="mt-1 text-xs text-secondary">{note}</div> : null}
    </Card>
  );
}

function OrdersTable({ rows = [], loading = false }) {
  return (
    <div className="admin-table-container overflow-hidden rounded-xl border border-[var(--color-border-admin)]">
      <table className="admin-table min-w-full divide-y divide-[var(--color-border-admin)]">
        <thead className="bg-surface-light">
          <tr className="text-left text-sm text-text-admin-muted">
            <th className="px-4 py-3 font-medium">Siparis</th>
            <th className="px-4 py-3 font-medium">Musteri</th>
            <th className="px-4 py-3 font-medium">Tarih</th>
            <th className="px-4 py-3 font-medium">Durum</th>
            <th className="px-4 py-3 font-medium text-right">Toplam</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-admin)] bg-bg-card">
          {loading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <tr key={`dashboard-order-skeleton-${index}`}>
                <td colSpan={5} className="px-4 py-3">
                  <div className="h-9 animate-pulse rounded-lg bg-[var(--color-bg-admin)]/70" />
                </td>
              </tr>
            ))
          ) : rows.length ? (
            rows.map((row) => (
              <tr
                key={row.id || row.orderNumber}
                className="text-sm transition-colors hover:bg-[var(--color-bg-hover)]/60"
              >
                <td className="px-4 py-3 font-semibold text-primary" data-label="Siparis">
                  {row.orderNumber}
                </td>
                <td className="px-4 py-3" data-label="Musteri">
                  {row.customerName || "-"}
                </td>
                <td className="px-4 py-3" data-label="Tarih">
                  {formatDateTime(row.createdAt)}
                </td>
                <td className="px-4 py-3" data-label="Durum">
                  <span
                    className={cls(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                      STATUS_BADGES[String(row.status || "").toLowerCase()] ||
                        "bg-stone-50 text-stone-700 border-stone-200"
                    )}
                  >
                    {row.statusLabel || row.status || "-"}
                  </span>
                </td>
                <td
                  className="px-4 py-3 text-left font-semibold text-primary md:text-right"
                  data-label="Toplam"
                >
                  {money(row.total)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-secondary">
                Henuz siparis verisi yok.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TopItems({ items = [], loading = false }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={`top-item-skeleton-${index}`}
            className="h-24 animate-pulse rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/60"
          />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-[var(--color-border-admin)] px-4 py-8 text-center text-sm text-secondary">
        Henuz satis verisi yok.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-xl border border-[var(--color-border-admin)] p-3 transition-colors hover:bg-[var(--color-bg-hover)]/60"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate font-medium text-primary">{item.name}</div>
              <div className="text-xs text-text-admin-muted">
                {item.sku || "-"} / {item.quantitySold || 0} adet
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-primary">
                {money(item.revenue)}
              </div>
              <div className="text-xs text-text-admin-muted">
                {item.share || 0}% pay
              </div>
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--color-border-admin)]/60">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-700"
              style={{ width: `${Math.max(0, Math.min(100, item.share || 0))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
