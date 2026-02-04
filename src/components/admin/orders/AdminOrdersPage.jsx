import { useEffect, useMemo, useState } from "react";
import { orderApi } from "../../../api/orders";
import AlertBanner from "../../ui/AlertBanner.jsx";
import LoadingOverlay from "../../ui/LoadingOverlay.jsx";
import {
  ArrowLeftRight,
  RefreshCw,
  Search,
  Truck,
  User2,
  CalendarDays,
  PackageCheck,
} from "lucide-react";
import OrderDetailsModal from "../../orders/OrderDetailsModal";

const STATUS_OPTIONS = [
  { value: "", label: "Tümü" },
  { value: "pending", label: "Beklemede" },
  { value: "paid", label: "Ödendi" },
  { value: "shipped", label: "Kargolandı" },
  { value: "completed", label: "Tamamlandı" },
  { value: "cancelled", label: "İptal Edildi" },
];

const STATUS_COLORS = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  shipped: "bg-blue-50 text-blue-700 ring-blue-200",
  completed: "bg-slate-900 text-white ring-slate-700",
  cancelled: "bg-rose-50 text-rose-600 ring-rose-200",
};

const money = (value) => {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
    }).format(Number(value || 0));
  } catch {
    return `€${Number(value || 0).toFixed(2)}`;
  }
};

function StatusBadge({ status }) {
  const key = String(status || "pending").toLowerCase();
  const cls = STATUS_COLORS[key] || STATUS_COLORS.pending;
  const labels = {
    pending: "Beklemede",
    paid: "Ödendi",
    shipped: "Kargolandı",
    completed: "Tamamlandı",
    cancelled: "İptal Edildi",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cls}`}
    >
      {labels[key] || "Bilinmiyor"}
    </span>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "", q: "" });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [busyOrderId, setBusyOrderId] = useState(null);
  const [banner, setBanner] = useState(null);

  const fetchOrders = async (nextPage = page, nextFilters = filters) => {
    setLoading(true);
    try {
      const data = await orderApi.adminList({
        page: nextPage,
        status: nextFilters.status,
        q: nextFilters.q,
      });
      setOrders(data.orders || []);
      setPagination(data.pagination || { total: 0, pages: 1 });
      setPage(nextPage);
      setBanner(null);
    } catch (error) {
      setBanner({
        variant: "danger",
        message: error?.message || "Siparişler yüklenemedi",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status]);

  const onSubmitSearch = (e) => {
    e.preventDefault();
    fetchOrders(1, filters);
  };

  const onRefresh = () => {
    fetchOrders(page, filters);
  };

  const onStatusChange = async (orderId, nextStatus) => {
    if (!nextStatus) return;
    setBusyOrderId(orderId);
    try {
      const updated = await orderApi.adminUpdateStatus(orderId, {
        status: nextStatus,
      });
      setOrders((prev) =>
        prev.map((order) =>
          order.id === updated.id || order.orderNumber === updated.orderNumber
            ? updated
            : order
        )
      );
      setBanner({ variant: "success", message: "Sipariş durumu güncellendi" });
    } catch (error) {
      setBanner({
        variant: "danger",
        message: error?.message || "Durum güncellenemedi",
      });
    } finally {
      setBusyOrderId(null);
    }
  };

  const rows = useMemo(() => orders || [], [orders]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-admin)]">
            Siparişler
          </h1>
          <p className="text-sm text-[var(--color-text-admin-muted)]">
            Gelen siparişleri görüntüleyin, durumlarını güncelleyin ve kargo
            detaylarını inceleyin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm hover:bg-[var(--color-bg-hover)]"
          >
            <RefreshCw className="h-4 w-4" /> Yenile
          </button>
        </div>
      </header>

      {banner && (
        <AlertBanner
          variant={banner.variant}
          message={banner.message}
          onClose={() => setBanner(null)}
        />
      )}

      <section className="relative rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4">
        <LoadingOverlay show={loading} />
        <form
          onSubmit={onSubmitSearch}
          className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-center"
        >
          <div className="flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-1.5">
            <Search className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
            <input
              className="w-full border-0 bg-transparent text-sm outline-none"
              placeholder="Sipariş numarasına göre ara"
              value={filters.q}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, q: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <select
              className="w-full rounded-full border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-1.5 text-sm sm:w-auto"
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, status: e.target.value }))
              }
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-text-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90 sm:w-auto"
            >
              <Search className="h-4 w-4" /> Ara
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]">
        <div className="admin-table-container overflow-x-auto">
          <table className="admin-table min-w-full divide-y divide-[var(--color-border-admin)]/60 text-sm">
            <thead className="bg-[var(--color-bg-admin)]/60">
              <tr className="text-left text-[var(--color-text-admin-muted)]">
                <th className="px-4 py-3 font-medium">Sipariş</th>
                <th className="px-4 py-3 font-medium">Müşteri</th>
                <th className="px-4 py-3 font-medium">Toplam</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                <th className="px-4 py-3 font-medium">Tarih</th>
                <th className="px-4 py-3 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-admin)]/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm">
                    Siparişler yükleniyor...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm">
                    Hiç sipariş bulunamadı.
                  </td>
                </tr>
              ) : (
                rows.map((order) => {
                  const user =
                    order.user && typeof order.user === "object"
                      ? order.user
                      : null;
                  const created = order.createdAt
                    ? new Date(order.createdAt).toLocaleString()
                    : "-";
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-[var(--color-bg-admin)]/40"
                    >
                      <td className="px-4 py-3 align-top" data-label="Sipariş">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[var(--color-text-admin)]">
                            {order.orderNumber}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-[var(--color-text-admin-muted)]">
                            <PackageCheck className="h-3.5 w-3.5" />
                            {order.items?.length || 0} ürün
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top" data-label="Müşteri">
                        {user ? (
                          <div className="flex items-center gap-2 text-sm text-[var(--color-text-admin)]">
                            <User2 className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
                            <div>
                              <div className="font-medium">
                                {[user.firstName, user.lastName]
                                  .filter(Boolean)
                                  .join(" ") || "—"}
                              </div>
                              <div className="text-xs text-[var(--color-text-admin-muted)]">
                                {user.email || "—"}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--color-text-admin-muted)]">
                            {order.user || "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top" data-label="Toplam">
                        <div className="flex flex-col text-[var(--color-text-admin)]">
                          <span className="font-semibold">
                            {money(order.total)}
                          </span>
                          <span className="text-xs text-[var(--color-text-admin-muted)]">
                            {order.shippingName || "Kargo"}:{" "}
                            {money(order.shipping)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top" data-label="Durum">
                        <div className="flex flex-col gap-2">
                          <StatusBadge status={order.status} />
                          <select
                            className="rounded-full border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-2 py-1 text-xs"
                            value={order.status}
                            disabled={busyOrderId === order.id}
                            onChange={(e) =>
                              onStatusChange(order.id, e.target.value)
                            }
                          >
                            {STATUS_OPTIONS.filter((opt) => opt.value).map(
                              (opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-[var(--color-text-admin)]" data-label="Tarih">
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1 text-xs text-[var(--color-text-admin-muted)]">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Oluşturulma
                          </span>
                          <span>{created}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-left md:text-right" data-label="İşlemler">
                        <div className="mobile-full flex flex-col gap-2 md:flex-row md:justify-end">
                          <button
                            onClick={() => setSelectedOrderId(order.id)}
                            className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] md:w-auto"
                          >
                            <Truck className="h-3.5 w-3.5" /> Görüntüle
                          </button>
                          <button
                            onClick={() =>
                              setSelectedOrderId(order.orderNumber)
                            }
                            className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] md:w-auto"
                            title="Sipariş numarasıyla aç"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-3 border-t border-[var(--color-border-admin)]/60 px-4 py-3 text-sm text-[var(--color-text-admin-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Toplam {pagination.total || rows.length} siparişten {rows.length}{" "}
            tanesi gösteriliyor
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => fetchOrders(Math.max(1, page - 1), filters)}
              className="rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
            >
              Önceki
            </button>
            <span>
              Sayfa {page} / {pagination.pages || 1}
            </span>
            <button
              disabled={page >= (pagination.pages || 1) || loading}
              onClick={() => fetchOrders(page + 1, filters)}
              className="rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>
        </footer>
      </section>

      {selectedOrderId && (
        <OrderDetailsModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          admin
        />
      )}
    </div>
  );
}
