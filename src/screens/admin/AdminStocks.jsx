// src/pages/admin/AdminStocks.jsx
import { useEffect, useMemo, useState } from "react";
// ❌ AdminLayout kaldırıldı
import { productApi } from "../../api/products.js";
import { setApi } from "../../api/sets.js";
import { Boxes, Package2, Layers, Search, ChevronRight } from "lucide-react";
import StockManagerPanel from "../../components/admin/stocks/StockManagerPanel.jsx";

const PAGE_SIZE = 20;

export default function AdminStocks() {
  const [tab, setTab] = useState("products"); // "products" | "sets"
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total]
  );

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelOwner, setPanelOwner] = useState({
    model: null,
    id: null,
    name: "",
  });

  async function load() {
    try {
      if (tab === "products") {
        const data = await productApi.list({
          page,
          limit: PAGE_SIZE,
          search: query || undefined,
        });
        const rows = Array.isArray(data?.products)
          ? data.products
          : Array.isArray(data)
          ? data
          : [];
        setItems(rows);
        setTotal(Number(data?.pagination?.total ?? rows.length));
      } else {
        const data = await setApi.list({
          page,
          limit: PAGE_SIZE,
          search: query || undefined,
        });
        const rows = Array.isArray(data)
          ? data
          : Array.isArray(data?.sets)
          ? data.sets
          : [];
        setItems(rows);
        setTotal(Number(data?.pagination?.total ?? rows.length));
      }
    } catch (e) {
      console.error(e);
      setItems([]);
      setTotal(0);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page]);

  const themeCard = {
    borderColor: "var(--color-border-admin)",
    background: "var(--color-bg-card)",
    color: "var(--color-text-admin)",
  };

  const themeHover = {
    background: "var(--color-bg-hover)",
  };

  function openPanel(model, id, name) {
    setPanelOwner({ model, id, name });
    setPanelOpen(true);
  }

  return (
    <>
      {/* Tabs + Search */}
      <div className="mb-4 rounded-2xl border p-3 sm:p-4" style={themeCard}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`rounded-xl px-3 py-2 text-sm border transition ${
                tab === "products" ? "font-semibold" : ""
              }`}
              style={{
                ...themeCard,
                ...(tab === "products" ? themeHover : {}),
              }}
              onClick={() => {
                setTab("products");
                setPage(1);
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Package2 className="h-4 w-4" />
                Ürünler
              </span>
            </button>
            <button
              className={`rounded-xl px-3 py-2 text-sm border transition ${
                tab === "sets" ? "font-semibold" : ""
              }`}
              style={{ ...themeCard, ...(tab === "sets" ? themeHover : {}) }}
              onClick={() => {
                setTab("sets");
                setPage(1);
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Setler
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div
              className="flex w-full items-center gap-2 rounded-full border px-3 py-1.5"
              style={themeCard}
            >
              <Search className="h-4 w-4 opacity-60" />
              <input
                className="w-full border-0 bg-transparent text-sm outline-none sm:w-56"
                placeholder={
                  tab === "products" ? "Ürünlerde ara…" : "Setlerde ara…"
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    load();
                  }
                }}
              />
            </div>
            <button
              className="w-full rounded-xl border px-3 py-2 text-sm sm:w-auto"
              style={themeCard}
              onClick={() => {
                setPage(1);
                load();
              }}
            >
              Ara
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border" style={themeCard}>
        <div className="admin-table-container w-full overflow-x-auto">
          <table className="admin-table min-w-full text-sm">
            <thead
              className="text-left"
              style={{
                background: "var(--color-surface-light)",
                color: "var(--color-text-admin)",
              }}
            >
              <tr>
                <th className="px-4 py-3 font-semibold w-14">Tür</th>
                <th className="px-4 py-3 font-semibold">Ad</th>
                <th className="px-4 py-3 font-semibold">Fiyat</th>
                <th className="px-4 py-3 font-semibold">Kategori / Bilgi</th>
                <th className="px-4 py-3 font-semibold text-right">
                  Stokları Yönet
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const model = tab === "products" ? "Product" : "Set";
                const name = it?.name || it?.title || it?.slug || it?._id;
                return (
                  <tr
                    key={it._id}
                    className="border-t"
                    style={{ borderColor: "var(--color-border-admin)" }}
                  >
                    <td className="px-4 py-3" data-label="Tür">
                      {tab === "products" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                          Ürün
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                          Set
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3" data-label="Ad">
                      <div className="flex flex-col">
                        <span className="font-medium">{name}</span>
                        <span className="text-xs opacity-70">
                          {it.slug || it._id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3" data-label="Fiyat">
                      {"price" in it
                        ? `${Number(it.price || 0).toLocaleString()} ₺`
                        : "-"}
                    </td>
                    <td className="px-4 py-3" data-label="Kategori / Bilgi">
                      {tab === "products" ? (
                        <span className="opacity-80 text-xs">
                          {it?.category?.name ||
                            (it?.category ? String(it.category) : "-")}
                        </span>
                      ) : (
                        <span className="opacity-80 text-xs">
                          {(it?.products || []).length} parça
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-left md:text-right" data-label="Stok">
                      <div className="mobile-full flex flex-col gap-2 md:flex-row md:justify-end">
                        <button
                          onClick={() => openPanel(model, it._id, name)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium shadow-sm md:w-auto"
                          style={{
                            background: "var(--color-accent)",
                            color: "white",
                          }}
                          title="Bu öğenin stoklarını yönet"
                        >
                          Stokları Yönet
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center opacity-70">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div
          className="flex flex-col gap-2 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--color-border-admin)" }}
        >
          <div className="text-xs opacity-70">
            Toplam {total} kayıt — sayfa {page}/{pages}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-40"
              style={themeCard}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Önceki
            </button>
            <button
              className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-40"
              style={themeCard}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
            >
              Sonraki
            </button>
          </div>
        </div>
      </div>

      {/* Sağdan açılan stok paneli */}
      <StockManagerPanel
        open={panelOpen}
        ownerModel={panelOwner.model}
        ownerId={panelOwner.id}
        ownerName={panelOwner.name}
        onClose={() => setPanelOpen(false)}
      />
    </>
  );
}
