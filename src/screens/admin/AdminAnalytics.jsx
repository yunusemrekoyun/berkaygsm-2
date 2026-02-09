import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { Users, Eye, Activity, Gauge, AlertCircle } from "lucide-react";
import { analyticsApi } from "../../api/analytics.js";

const EMPTY_ANALYTICS = {
  periodDays: 30,
  summary: {
    totalVisits: 0,
    uniqueVisitors: 0,
    avgVisitsPerVisitor: 0,
    avgDailyVisits: 0,
    deltas: {
      visits: "0%",
      uniqueVisitors: "0%",
      avgDailyVisits: "0%",
      avgVisitsPerVisitor: "0%",
    },
  },
  trend: [],
  trafficSources: [],
  devices: [],
  heatmap: Array.from({ length: 7 }).map(() => Array(24).fill(0)),
  countries: [],
  topPages: [],
};

function mergeAnalyticsPayload(payload) {
  return {
    ...EMPTY_ANALYTICS,
    ...payload,
    summary: {
      ...EMPTY_ANALYTICS.summary,
      ...(payload?.summary || {}),
      deltas: {
        ...EMPTY_ANALYTICS.summary.deltas,
        ...(payload?.summary?.deltas || {}),
      },
    },
    trend: Array.isArray(payload?.trend) ? payload.trend : EMPTY_ANALYTICS.trend,
    trafficSources: Array.isArray(payload?.trafficSources)
      ? payload.trafficSources
      : EMPTY_ANALYTICS.trafficSources,
    devices: Array.isArray(payload?.devices) ? payload.devices : EMPTY_ANALYTICS.devices,
    heatmap: Array.isArray(payload?.heatmap) ? payload.heatmap : EMPTY_ANALYTICS.heatmap,
    countries: Array.isArray(payload?.countries) ? payload.countries : EMPTY_ANALYTICS.countries,
    topPages: Array.isArray(payload?.topPages) ? payload.topPages : EMPTY_ANALYTICS.topPages,
  };
}

function extractMessage(error) {
  if (!error) return "Analitik verisi alınamadı.";
  if (error instanceof Error) {
    if (!error.message) return "Analitik verisi alınamadı.";
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return parsed.message;
    } catch {
      // ignore parse errors
    }
    return error.message;
  }
  return "Analitik verisi alınamadı.";
}

function formatDecimal(value, digits = 1) {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function useCountUp(
  target = 0,
  ms = 900,
  formatter = (n) => n.toLocaleString("tr-TR")
) {
  const [val, setVal] = useState(formatter(0));
  const fmtRef = useRef(formatter);
  const durRef = useRef(ms);

  useEffect(() => {
    fmtRef.current = formatter;
  }, [formatter]);

  useEffect(() => {
    durRef.current = ms;
  }, [ms]);

  useEffect(() => {
    let raf;
    let start;
    const finalTarget = Math.max(0, Number(target || 0));
    const step = (time) => {
      if (!start) start = time;
      const progress = Math.min(1, (time - start) / durRef.current);
      const current = Math.round(progress * finalTarget);
      setVal(fmtRef.current(current));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target]);

  return val;
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--color-border-admin)] bg-bg-card p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, right }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <div className="text-lg font-semibold text-primary">{title}</div>
        {subtitle ? (
          <div className="text-sm text-text-admin-muted">{subtitle}</div>
        ) : null}
      </div>
      {right}
    </div>
  );
}

export default function AdminAnalytics() {
  const [entered, setEntered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);

  useEffect(() => {
    const timer = setTimeout(() => setEntered(true), 20);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await analyticsApi.visitsOverview({ days: 30 });
        if (cancelled) return;
        setAnalytics(mergeAnalyticsPayload(data));
      } catch (err) {
        if (cancelled) return;
        setError(extractMessage(err));
        setAnalytics(EMPTY_ANALYTICS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = analytics.summary || EMPTY_ANALYTICS.summary;
  const trend = analytics.trend || EMPTY_ANALYTICS.trend;
  const trafficSources =
    analytics.trafficSources || EMPTY_ANALYTICS.trafficSources;
  const devices = analytics.devices || EMPTY_ANALYTICS.devices;
  const heatmap = analytics.heatmap || EMPTY_ANALYTICS.heatmap;
  const countries =
    analytics.countries && analytics.countries.length
      ? analytics.countries
      : [{ country: "—", visitors: 0 }];
  const topPages = analytics.topPages || EMPTY_ANALYTICS.topPages;

  const totalVisits = useCountUp(summary.totalVisits, 1100);
  const uniqueVisitors = useCountUp(summary.uniqueVisitors, 1100);
  const avgDailyVisits = useCountUp(
    summary.avgDailyVisits * 10,
    900,
    (n) => formatDecimal(n / 10, 1)
  );
  const avgDepth = useCountUp(
    summary.avgVisitsPerVisitor * 100,
    900,
    (n) => formatDecimal(n / 100, 2)
  );

  const trendData = useMemo(() => {
    if (Array.isArray(trend) && trend.length > 0) return trend;
    return Array.from({ length: analytics.periodDays || 30 }).map((_, index) => ({
      day: `${index + 1}`,
      visits: 0,
      uniqueVisitors: 0,
    }));
  }, [analytics.periodDays, trend]);

  return (
    <section
      className={`transition-opacity duration-500 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<Eye className="h-5 w-5" />}
          title={`Toplam Ziyaret (${analytics.periodDays} gün)`}
          value={totalVisits}
          trend={summary.deltas.visits}
          trendPositive={String(summary.deltas.visits || "").startsWith("+")}
        />
        <Kpi
          icon={<Users className="h-5 w-5" />}
          title="Tekil Ziyaretçi"
          value={uniqueVisitors}
          trend={summary.deltas.uniqueVisitors}
          trendPositive={String(summary.deltas.uniqueVisitors || "").startsWith("+")}
        />
        <Kpi
          icon={<Activity className="h-5 w-5" />}
          title="Ort. Günlük Ziyaret"
          value={avgDailyVisits}
          trend={summary.deltas.avgDailyVisits}
          trendPositive={String(summary.deltas.avgDailyVisits || "").startsWith("+")}
        />
        <Kpi
          icon={<Gauge className="h-5 w-5" />}
          title="Ziyaret / Ziyaretçi"
          value={avgDepth}
          trend={summary.deltas.avgVisitsPerVisitor}
          trendPositive={String(summary.deltas.avgVisitsPerVisitor || "").startsWith("+")}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={`Ziyaret Trendi (${analytics.periodDays} gün)`}
            subtitle="toplam ve tekil ziyaretçi"
            right={
              loading ? (
                <span className="rounded-full bg-surface-light px-3 py-1 text-xs text-text-admin-muted">
                  Güncelleniyor...
                </span>
              ) : null
            }
          />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trendData}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="visitsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-primary)"
                      stopOpacity={0.55}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="uniqueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-accent)"
                      stopOpacity={0.55}
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
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-bg-card)",
                    border: "1px solid var(--color-border-admin)",
                  }}
                />
                <Legend wrapperStyle={{ color: "var(--color-secondary)" }} />
                <Area
                  type="monotone"
                  dataKey="visits"
                  name="Ziyaret"
                  stroke="var(--color-primary)"
                  fill="url(#visitsGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="uniqueVisitors"
                  name="Tekil Ziyaretçi"
                  stroke="var(--color-accent)"
                  fill="url(#uniqueGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Trafik Kaynakları" subtitle="ziyaret payı" />
          <div className="flex items-center gap-6">
            <div className="h-56 w-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trafficSources}
                    dataKey="value"
                    innerRadius={58}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {trafficSources.map((item, index) => (
                      <Cell key={`${item.key}-${index}`} fill={item.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="grow space-y-2 text-sm">
              {trafficSources.map((item) => (
                <li key={item.key} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: item.color }}
                    />
                    <span className="text-primary">{item.key}</span>
                  </span>
                  <span className="text-text-admin-muted">{item.value}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Saatlik Aktivite Isı Haritası" subtitle="son 7 gün" />
          <Heatmap data={heatmap} />
        </Card>

        <Card>
          <CardHeader title="Cihaz Dağılımı" subtitle="ziyaret payı" />
          <div className="flex items-center gap-6">
            <div className="h-56 w-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={devices}
                    dataKey="value"
                    innerRadius={58}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {devices.map((item, index) => (
                      <Cell key={`${item.key}-${index}`} fill={item.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="grow space-y-2 text-sm">
              {devices.map((item) => (
                <li key={item.key} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: item.color }}
                    />
                    <span className="text-primary">{item.key}</span>
                  </span>
                  <span className="text-text-admin-muted">{item.value}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Ülke Bazlı Ziyaretler" subtitle="adet bazında" />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={countries}
                layout="vertical"
                margin={{ left: 30, right: 20, top: 10, bottom: 10 }}
              >
                <CartesianGrid
                  stroke="var(--color-border-admin)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  tick={{ fill: "var(--color-text-admin-muted)", fontSize: 12 }}
                />
                <YAxis
                  dataKey="country"
                  type="category"
                  tick={{ fill: "var(--color-text-admin-muted)", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-bg-card)",
                    border: "1px solid var(--color-border-admin)",
                  }}
                />
                <Bar
                  dataKey="visitors"
                  fill="var(--color-primary)"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="En Çok Ziyaret Edilen Sayfalar" subtitle="son 30 gün" />
          <TopPagesList pages={topPages} />
        </Card>
      </div>
    </section>
  );
}

function Kpi({ icon, title, value, trend, trendPositive = true }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-light text-primary">
          {icon}
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
            trendPositive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {trend || "0%"}
        </span>
      </div>
      <div className="mt-4 text-3xl font-extrabold text-primary">{value}</div>
      <div className="text-sm text-text-admin-muted">{title}</div>
    </Card>
  );
}

function Heatmap({ data }) {
  const days = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  return (
    <div className="overflow-x-auto">
      <div className="min-w-full md:min-w-[720px]">
        <div className="grid grid-cols-[64px_repeat(24,minmax(0,1fr))] gap-1">
          <div />
          {Array.from({ length: 24 }).map((_, hour) => (
            <div
              key={`h-${hour}`}
              className="text-center text-[11px] text-text-admin-muted"
            >
              {hour}
            </div>
          ))}
          {data.map((row, rowIndex) => (
            <Fragment key={`row-${rowIndex}`}>
              <div className="flex items-center pr-2 text-right text-xs text-text-admin-muted">
                {days[rowIndex]}
              </div>
              {row.map((value, colIndex) => (
                <HeatCell key={`c-${rowIndex}-${colIndex}`} value={value} />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeatCell({ value }) {
  const opacity = Math.min(1, Number(value || 0) / 100);
  return (
    <div
      className="h-6 rounded-[6px] transition-all duration-700"
      style={{
        background: `rgba(216,124,130,${0.18 + opacity * 0.55})`,
        boxShadow:
          opacity > 0.7 ? "inset 0 0 0 1px var(--color-border-admin)" : "none",
      }}
      title={`${value}`}
    />
  );
}

function TopPagesList({ pages = [] }) {
  const safePages = Array.isArray(pages) ? pages : [];
  const maxVisits = Math.max(
    1,
    ...safePages.map((page) => Math.max(0, Number(page.visits || 0)))
  );

  return (
    <div className="space-y-3">
      {safePages.length ? (
        safePages.map((page) => {
          const visits = Math.max(0, Number(page.visits || 0));
          const width = Math.round((visits / maxVisits) * 100);
          return (
            <div key={page.path} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="line-clamp-1 text-primary">{page.path}</span>
                <span className="text-text-admin-muted">
                  {visits.toLocaleString("tr-TR")}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-border-admin)]/70">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-700"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })
      ) : (
        <p className="text-sm text-text-admin-muted">
          Henüz ziyaret verisi oluşmadı.
        </p>
      )}
    </div>
  );
}
