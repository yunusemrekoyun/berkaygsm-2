/* eslint-disable no-unused-vars */
import { Fragment, useEffect, useRef, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { Users, MousePointer2, Clock3, TrendingUp } from "lucide-react";

/* ---------------- helpers ---------------- */
function useCountUp(
  target = 0,
  ms = 900,
  formatter = (n) => n.toLocaleString()
) {
  const [val, setVal] = useState(0);
  const fmtRef = useRef(formatter);
  const durRef = useRef(ms);

  // formatter veya ms prop’u değişirse güncelle (animasyonu tetiklemeden)
  useEffect(() => {
    fmtRef.current = formatter;
  }, [formatter]);
  useEffect(() => {
    durRef.current = ms;
  }, [ms]);

  useEffect(() => {
    let raf, start;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / durRef.current);
      setVal(fmtRef.current(Math.round(p * target)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return val;
}

function msToMin(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, "0")}`;
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
        {subtitle && (
          <div className="text-sm text-text-admin-muted">{subtitle}</div>
        )}
      </div>
      {right}
    </div>
  );
}

/* ---------------- dummy data factories ---------------- */
function makeTrend(days = 30) {
  const baseV = 1500,
    baseS = 1000;
  return Array.from({ length: days }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    const bump = Math.sin(i / 3) * 180 + (Math.random() * 160 - 80);
    const visitors = Math.max(400, Math.round(baseV + bump));
    const sessions = Math.max(260, Math.round(baseS + bump * 0.8));
    return {
      day: `${date.getDate()}/${date.getMonth() + 1}`,
      visitors,
      sessions,
    };
  });
}

function makeTraffic() {
  // toplam %100
  const raw = [
    { key: "Organik", color: "var(--color-primary)" },
    { key: "Ücretli", color: "var(--color-accent)" },
    { key: "Sosyal", color: "var(--color-secondary)" },
    { key: "Yönlendirme", color: "var(--color-surface)" },
    { key: "Doğrudan", color: "var(--color-contact-bg)" },
  ].map((x) => ({ ...x, v: Math.random() * 30 + 10 }));
  const sum = raw.reduce((a, b) => a + b.v, 0);
  return raw.map((x) => ({ ...x, value: Math.round((x.v / sum) * 100) }));
}

function makeDevices() {
  const d = [
    { key: "Mobil", color: "var(--color-accent)" },
    { key: "Masaüstü", color: "var(--color-primary)" },
    { key: "Tablet", color: "var(--color-secondary)" },
  ].map((x) => ({ ...x, v: Math.random() * 50 + 15 }));
  const sum = d.reduce((a, b) => a + b.v, 0);
  return d.map((x) => ({ ...x, value: Math.round((x.v / sum) * 100) }));
}

function makeHeatmap() {
  // 7 gün x 24 saat
  return Array.from({ length: 7 }).map((_, d) =>
    Array.from({ length: 24 }).map((_, h) => {
      const k =
        (Math.sin(h / 3) + Math.random() * 0.7) *
        (d === 5 || d === 6 ? 1.2 : 1);
      return Math.max(0, Math.round(k * 100));
    })
  );
}

function makeCountries() {
  const list = ["TR", "DE", "NL", "FR", "GB", "US", "SA", "AE", "AZ", "RU"];
  return list.map((c, i) => ({
    country: c,
    visitors: Math.round(300 + Math.random() * (1200 - i * 60)),
  }));
}

function makeFunnel() {
  const visits = 12000 + Math.round(Math.random() * 1000);
  const view = Math.round(visits * 0.62);
  const add = Math.round(visits * 0.18);
  const checkout = Math.round(visits * 0.1);
  const purchase = Math.round(visits * 0.07);
  return [
    { name: "Ziyaretler", value: visits },
    { name: "Ürün Görüntülemeleri", value: view },
    { name: "Sepete Eklemeler", value: add },
    { name: "Ödeme", value: checkout },
    { name: "Satın Almalar", value: purchase },
  ];
}

/* ---------------- page ---------------- */
export default function AdminAnalytics() {
  const trend = useMemo(() => makeTrend(30), []);
  const traffic = useMemo(() => makeTraffic(), []);
  const devices = useMemo(() => makeDevices(), []);
  const heat = useMemo(() => makeHeatmap(), []);
  const countries = useMemo(() => makeCountries(), []);
  const funnel = useMemo(() => makeFunnel(), []);

  const totalVisitors = trend.reduce((a, b) => a + b.visitors, 0);
  const totalSessions = trend.reduce((a, b) => a + b.sessions, 0);
  const bounceRate =
    100 - Math.round((totalSessions / (totalVisitors || 1)) * 80); // dummy
  const avgMs = 1000 * (60 + Math.round(Math.random() * 120)); // 1–3 dk

  const visitorsCount = useCountUp(totalVisitors, 1100);
  const sessionsCount = useCountUp(totalSessions, 1100);
  const bounceCount = useCountUp(bounceRate, 900, (n) => `${n}%`);
  const avgDur = useCountUp(1, 900, () => msToMin(avgMs));

  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 20);
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      className={`transition-opacity duration-500 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<Users className="h-5 w-5" />}
          title="Ziyaretçiler"
          value={visitorsCount}
          trend="+8%"
        />
        <Kpi
          icon={<MousePointer2 className="h-5 w-5" />}
          title="Oturumlar"
          value={sessionsCount}
          trend="+5%"
        />
        <Kpi
          icon={<TrendingUp className="h-5 w-5" />}
          title="Hemen Çıkma Oranı"
          value={bounceCount}
          trend="-2%"
          negative
        />
        <Kpi
          icon={<Clock3 className="h-5 w-5" />}
          title="Ort. Oturum Süresi"
          value={avgDur}
          trend="+6%"
        />
      </div>

      {/* Trend + Sources */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Ziyaretçi ve Oturumlar (30 gün)"
            subtitle="düzgünleştirilmiş, bot filtrelemesi içerir"
          />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trend}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1">
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
                  <linearGradient id="sesGrad" x1="0" y1="0" x2="0" y2="1">
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
                    border: `1px solid var(--color-border-admin)`,
                  }}
                />
                <Legend wrapperStyle={{ color: "var(--color-secondary)" }} />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  name="Ziyaretçiler"
                  stroke="var(--color-primary)"
                  fill="url(#visGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="sessions"
                  name="Oturumlar"
                  stroke="var(--color-accent)"
                  fill="url(#sesGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Trafik Kaynakları"
            subtitle="toplam oturum payı"
          />
          <div className="flex items-center gap-6">
            <div className="h-56 w-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={traffic}
                    dataKey="value"
                    innerRadius={58}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {traffic.map((t, i) => (
                      <Cell key={i} fill={t.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="grow space-y-2 text-sm">
              {traffic.map((t) => (
                <li key={t.key} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: t.color }}
                    />
                    <span className="text-primary">{t.key}</span>
                  </span>
                  <span className="text-text-admin-muted">{t.value}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Heatmap + Devices */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Saatlik Aktivite Isı Haritası"
            subtitle="son 7 gün"
          />
          <Heatmap data={heat} />
        </Card>

        <Card>
          <CardHeader title="Cihazlar" subtitle="oturum payı" />
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
                    {devices.map((t, i) => (
                      <Cell key={i} fill={t.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="grow space-y-2 text-sm">
              {devices.map((t) => (
                <li key={t.key} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: t.color }}
                    />
                    <span className="text-primary">{t.key}</span>
                  </span>
                  <span className="text-text-admin-muted">{t.value}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Countries + Funnel */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="En Çok Ziyaretçi Gelen Ülkeler"
            subtitle="ziyaretçi sayısına göre"
          />
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
                    border: `1px solid var(--color-border-admin)`,
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
          <CardHeader
            title="Dönüşüm Hunisi"
            subtitle="oturum → satın alma"
          />
          <Funnel data={funnel} />
        </Card>
      </div>
    </section>
  );
}

/* ---------------- sub components ---------------- */
function Kpi({ icon, title, value, trend, negative = false }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-light text-primary">
          {icon}
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
            negative
              ? "bg-rose-50 text-rose-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {trend}
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
          {Array.from({ length: 24 }).map((_, h) => (
            <div
              key={h}
              className="text-center text-[11px] text-text-admin-muted"
            >
              {h}
            </div>
          ))}
          {data.map((row, r) => (
            <Fragment key={`row-${r}`}>
              <div className="flex items-center pr-2 text-right text-xs text-text-admin-muted">
                {days[r]}
              </div>
              {row.map((v, c) => (
                <HeatCell key={`c-${r}-${c}`} value={v} />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
function HeatCell({ value }) {
  // 0..100 -> opacity & tint
  const op = Math.min(1, value / 100);
  return (
    <div
      className="h-6 rounded-[6px] transition-all duration-700"
      style={{
        background: `rgba(216,124,130,${0.18 + op * 0.55})`, // accent tonu
        boxShadow:
          op > 0.7 ? "inset 0 0 0 1px var(--color-border-admin)" : "none",
      }}
      title={`${value}`}
    />
  );
}

function Funnel({ data }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="space-y-3">

      {data.map((s, i) => {
        const w = Math.round((s.value / max) * 100);
        return (
          <div key={s.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-primary">{s.name}</span>
              <span className="text-text-admin-muted">
                {s.value.toLocaleString()}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-border-admin)]/70">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-700"
                style={{ width: `${w}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
