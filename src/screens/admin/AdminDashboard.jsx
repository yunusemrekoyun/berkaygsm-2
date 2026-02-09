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
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Users,
  Package,
  Tag,
} from "lucide-react";

/* ------- küçük yardımcılar ------- */
function useCountUp(target = 0, ms = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf, start;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      setVal(Math.round(p * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return val;
}

function RingStat({
  size = 96,
  value = 72,
  label = "Dönüşüm",
  color = "var(--color-accent)",
}) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let raf, start;
    const animate = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / 1000);
      setPct(Math.round(p * value));
      if (p < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const stroke = `conic-gradient(${color} ${
    pct * 3.6
  }deg, rgba(0,0,0,0.06) 0deg)`;
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid place-items-center rounded-full"
        style={{
          width: size,
          height: size,
          background: stroke,
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
        <div className="text-xs text-secondary">bu ay</div>
      </div>
    </div>
  );
}

/* ------- dummy data üreticileri ------- */
function makeSparkData(days = 12) {
  const base = 1200;
  return Array.from({ length: days }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const v = Math.round(
      base + Math.sin(i / 2) * 250 + (Math.random() * 200 - 100)
    );
    return {
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      value: Math.max(300, v),
    };
  });
}

function makeBars(categories = 6) {
  return Array.from({ length: categories }).map((_, i) => ({
    name: ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][i] || `G${i}`,
    orders: Math.round(20 + Math.random() * 80),
    refunds: Math.round(Math.random() * 12),
  }));
}

/* ------- ana bileşen ------- */
export default function AdminDashboard() {
  // KPI’lar
  const orders = useCountUp(1248);
  const customers = useCountUp(302);
  const products = useCountUp(184);
  const coupons = useCountUp(12);

  // grafikleri her mount’ta “fresh” üret
  const areaData = useMemo(() => makeSparkData(14), []);
  const barData = useMemo(() => makeBars(7), []);

  // giriş animasyonu için hafif “fade & slide”
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      className={`transition-opacity duration-500 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Üst KPI’lar */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<ShoppingCart className="h-5 w-5" />}
          title="Siparişler"
          value={orders}
          delta="+12%"
          positive
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          title="Yeni Müşteriler"
          value={customers}
          delta="+5%"
          positive
        />
        <KpiCard
          icon={<Package className="h-5 w-5" />}
          title="Aktif Ürünler"
          value={products}
          delta="-1%"
          positive={false}
        />
        <KpiCard
          icon={<Tag className="h-5 w-5" />}
          title="Aktif Kuponlar"
          value={coupons}
          delta="+2"
          positive
        />
      </div>

      {/* Ortadaki grafikler */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Gelir (son 14 gün)"
            subtitle="vergiler ve kargo dahil"
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={areaData}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
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
                  dataKey="date"
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
                  labelStyle={{ color: "var(--color-secondary)" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-accent)"
                  fill="url(#g1)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Haftalık Sipariş vs İade"
            subtitle="günlük adet"
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--color-border-admin)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="name"
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
                  labelStyle={{ color: "var(--color-secondary)" }}
                />
                <Bar
                  dataKey="orders"
                  fill="var(--color-primary)"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="refunds"
                  fill="var(--color-surface)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-text-admin-muted">
            <RingStat
              value={76}
              label="Teslimat SLA'sı"
              color="var(--color-primary)"
            />
            <RingStat
              value={42}
              label="İade Oranı"
              color="var(--color-secondary)"
            />
          </div>
        </Card>
      </div>

      {/* Alt kısım: Son siparişler + Top ürünler */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Son Siparişler" subtitle="son 10" />
          <OrdersTable />
        </Card>
        <Card>
          <CardHeader title="En Çok Satan Ürünler" subtitle="gelire göre" />
          <TopProducts />
        </Card>
      </div>
    </section>
  );
}

/* ------- parça bileşenler ------- */
function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-[var(--color-border-admin)] bg-bg-card p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle }) {
  return (
    <div className="mb-3">
      <div className="text-lg font-semibold text-primary">{title}</div>
      {subtitle && (
        <div className="text-sm text-text-admin-muted">{subtitle}</div>
      )}
    </div>
  );
}

function KpiCard({ icon, title, value, delta, positive = true }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-light text-primary">
          {icon}
        </div>
        <div
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
            positive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {positive ? (
            <ArrowUpRight className="h-4 w-4" />
          ) : (
            <ArrowDownRight className="h-4 w-4" />
          )}
          {delta}
        </div>
      </div>
      <div className="mt-4 text-3xl font-extrabold text-primary">
        {value.toLocaleString()}
      </div>
      <div className="text-sm text-text-admin-muted">{title}</div>
    </Card>
  );
}

function OrdersTable() {
  const rows = useMemo(
    () =>
      Array.from({ length: 10 }).map((_, i) => ({
        id: 100120 + i,
        customer: [
          "Ayla Yılmaz",
          "Ece Demir",
          "Merve Kaya",
          "Sena Şahin",
          "Aslı K.",
          "Elif A.",
          "Nehir B.",
          "Duygu E.",
          "Sude D.",
          "Gizem K.",
        ][i],
        total: (49 + Math.random() * 250).toFixed(2),
        status: ["Ödendi", "Beklemede", "İade edildi", "Kargolandı"][
          Math.floor(Math.random() * 4)
        ],
        date: new Date(Date.now() - i * 86400000).toLocaleDateString(),
      })),
    []
  );
  const badge = (s) => {
    const map = {
      "Ödendi": "bg-emerald-50 text-emerald-700 border-emerald-200",
      "Beklemede": "bg-amber-50 text-amber-700 border-amber-200",
      "İade edildi": "bg-rose-50 text-rose-700 border-rose-200",
      "Kargolandı": "bg-indigo-50 text-indigo-700 border-indigo-200",
    };
    return map[s] || "bg-gray-50 text-gray-700 border-gray-200";
  };
  return (
    <div className="admin-table-container overflow-hidden rounded-xl border border-[var(--color-border-admin)]">
      <table className="admin-table min-w-full divide-y divide-[var(--color-border-admin)]">
        <thead className="bg-surface-light">
          <tr className="text-left text-sm text-text-admin-muted">
            <th className="px-4 py-3 font-medium">Sipariş</th>
            <th className="px-4 py-3 font-medium">Müşteri</th>
            <th className="px-4 py-3 font-medium">Tarih</th>
            <th className="px-4 py-3 font-medium">Durum</th>
            <th className="px-4 py-3 font-medium text-right">Toplam</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-admin)] bg-bg-card">
          {rows.map((r) => (
            <tr
              key={r.id}
              className="text-sm hover:bg-[var(--color-bg-hover)]/60 transition-colors"
            >
              <td className="px-4 py-3 font-semibold text-primary" data-label="Sipariş">
                #{r.id}
              </td>
              <td className="px-4 py-3" data-label="Müşteri">
                {r.customer}
              </td>
              <td className="px-4 py-3" data-label="Tarih">
                {r.date}
              </td>
              <td className="px-4 py-3" data-label="Durum">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${badge(
                    r.status
                  )}`}
                >
                  {r.status}
                </span>
              </td>
              <td className="px-4 py-3 text-left font-semibold text-primary md:text-right" data-label="Toplam">
                ₺{r.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopProducts() {
  const items = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => ({
        name: [
          "MagSafe Şeffaf Kılıf",
          "USB-C Hızlı Şarj Adaptörü",
          "Ekran Koruyucu Cam",
          "Araç İçi Telefon Tutucu",
          "Type-C Data Kablosu",
          "Kablosuz Şarj Standı",
        ][i],
        sku: "SKU-" + (1000 + i),
        revenue: Math.round(1200 + Math.random() * 4000),
        pct: Math.round(30 + Math.random() * 65),
      })),
    []
  );
  return (
    <div className="space-y-3">

      {items.map((p) => (
        <div
          key={p.sku}
          className="rounded-xl border border-[var(--color-border-admin)] p-3 hover:bg-[var(--color-bg-hover)]/60 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-primary">{p.name}</div>
              <div className="text-xs text-text-admin-muted">{p.sku}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-primary">
                ₺{p.revenue.toLocaleString()}
              </div>
              <div className="text-xs text-text-admin-muted">kategori payı</div>
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--color-border-admin)]/60">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-700"
              style={{ width: `${p.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
