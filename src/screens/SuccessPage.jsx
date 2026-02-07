import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import BreadCrumb from "../components/shop/BreadCrumb";
import { orderApi } from "../api/orders";

export default function SuccessPage() {
  const location = useLocation();
  const orderId = new URLSearchParams(location.search).get("order");
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!orderId) return;
      try {
        const o = await orderApi.get(orderId);
        if (mounted) setOrder(o);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  return (
    <section className="bg-surface-light/60">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6">
        <BreadCrumb
          items={[{ label: "Ana Sayfa", to: "/" }, { label: "Başarılı" }]}
        />
      </div>

      <div className="mx-auto max-w-xl px-4 sm:px-6 pb-16">
        <div className="rounded-2xl border border-border bg-white p-6 text-center">
          <h1 className="text-2xl font-semibold text-primary">Teşekkürler!</h1>
          <p className="mt-2 text-secondary">
            Siparişiniz başarıyla oluşturuldu.
          </p>

          {order && (
            <div className="mt-4 text-left text-sm">
              <div className="font-medium text-primary">
                Sipariş #{order.orderNumber || order.id}
              </div>
              <div className="text-xs text-secondary">
                Durum: <span className="capitalize">{order.status}</span> •{" "}
                {order.shippingName || "Kargo"}: ₺
                {Number(order.shipping || 0).toFixed(2)}
              </div>
              <ul className="mt-2 space-y-1">
                {order.items.map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-primary truncate">
                      {it.name} × {it.qty}
                    </span>
                    <span className="text-secondary">
                      ₺{Number(it.unitPrice * it.qty).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-border pt-3 flex justify-between">
                <span className="text-primary font-semibold">Toplam</span>
                <span className="text-primary font-semibold">
                  ₺{Number(order.total).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/"
              className="rounded-full border border-border px-4 py-2 text-sm text-primary hover:bg-surface-hover"
            >
              Alışverişe devam et
            </Link>
            <Link
              to="/account?tab=Orders"
              className="rounded-full bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover"
            >
              Siparişlerimi gör
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
