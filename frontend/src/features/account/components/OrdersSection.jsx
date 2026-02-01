import { useEffect, useMemo, useState } from "react";
import { orderApi } from "../../../api/orders";
import OrderDetailsModal from "../../../components/orders/OrderDetailsModal";
import { useStorefrontLang } from "../../../context/LangContext.jsx";
import { formatStaticText } from "../../../i18n/staticContent.js";

function StatusBadge({ status, copy = {} }) {
  const state = String(status || "created").toLowerCase();
  const classes = {
    created: "bg-surface text-primary border-border",
    pending: "bg-surface text-primary border-border",
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    processing: "bg-amber-50 text-amber-700 border-amber-200",
    shipped: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-slate-900 text-white border-slate-800",
    cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const cls = classes[state] || classes.created;
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {copy[state] || state.charAt(0).toUpperCase() + state.slice(1)}
    </span>
  );
}

export default function OrdersSection({ copy = {} }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const { lang } = useStorefrontLang();
  const locale = lang === "tr" ? "tr-TR" : lang === "de" ? "de-DE" : "en-US";
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale]
  );
  const statusCopy = copy.status || {};
  const totalLabel = copy.totalLabel || "Total";

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await orderApi.mine();
        if (mounted) setOrders(list);
      } catch (error) {
        console.error("orders.mine error:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-primary">
          {copy.heading || "Orders"}
        </h2>
        <div className="mt-4 h-28 rounded-xl border border-border bg-surface animate-pulse" />
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-primary">
          {copy.heading || "Orders"}
        </h2>
        <p className="mt-2 text-secondary">
          {copy.empty || "You don't have any orders yet."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-primary">
        {copy.heading || "Orders"}
      </h2>

      <ul className="mt-4 divide-y divide-border rounded-2xl border border-border overflow-hidden">
        {orders.map((order) => {
          const id = order.id || order._id;
          const number = order.orderNumber || order.number || String(id).slice(-6);
          const created = order.createdAt
            ? dateFormatter.format(new Date(order.createdAt))
            : "-";
          const total = Number(order.totals?.grand ?? order.total ?? 0).toFixed(2);
          const status = String(order.status || "created");
          const shippingAmount = Number(order.shipping || 0).toFixed(2);
          return (
            <li
              key={id}
              className="bg-white p-4 sm:flex sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-primary">
                  {formatStaticText(copy.orderLabel || "Order #{number}", { number })}
                </div>
                <div className="mt-0.5 text-xs text-secondary flex flex-wrap items-center gap-1">
                  <span>{created}</span>
                  <span>•</span>
                  <StatusBadge status={status} copy={statusCopy} />
                  {order.shippingName && (
                    <span className="text-secondary">
                      •
                      {formatStaticText(
                        copy.shippingLine || "Shipping: {name} (€{amount})",
                        {
                          name: order.shippingName,
                          amount: shippingAmount,
                        }
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 sm:mt-0 flex items-center gap-3">
                <div className="text-sm text-primary font-semibold">
                  {totalLabel}: €{total}
                </div>
                <button
                  onClick={() => setSelectedId(id)}
                  className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-primary hover:bg-surface-hover"
                >
                  {copy.viewDetails || "View details"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {selectedId && (
        <OrderDetailsModal
          orderId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
