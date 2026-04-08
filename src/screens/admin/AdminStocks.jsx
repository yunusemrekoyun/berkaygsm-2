import { useEffect, useMemo, useState } from "react";
import { productApi } from "../../api/products.js";
import { Package2, Search, ChevronRight } from "lucide-react";
import StockManagerPanel from "../../components/admin/stocks/StockManagerPanel.jsx";

const PAGE_SIZE = 20;

export default function AdminStocks() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const pages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelOwner, setPanelOwner] = useState({ model: null, id: null, name: "" });

  async function load() {
    try {
      const data = await productApi.list({ page, limit: PAGE_SIZE, search: query || undefined });
      const rows = Array.isArray(data?.products) ? data.products : Array.isArray(data) ? data : [];
      setItems(rows);
      setTotal(Number(data?.pagination?.total ?? rows.length));
    } catch (e) {
      console.error(e);
      setItems([]);
      setTotal(0);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function openPanel(id, name) {
    setPanelOwner({ model: "Product", id, name });
    setPanelOpen(true);
  }

  const card = {
    borderColor: "var(--color-border-admin)",
    background: "var(--color-bg-card)",
    color: "var(--color-text-admin)",
  };

  return (
    <>
      {/* Header */}
      <div
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border p-3 sm:p-4"
        style={card}
      >
        <div className="flex items-center gap-2 text-sm font-medium opacity-70">
          <Package2 className="h-4 w-4" />
          Ürün Stokları
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 rounded-full border px-3 py-1.5"
          style={card}
        >
          <Search className="h-4 w-4 opacity-50" />
          <input
            className="w-full bg-transparent text-sm outline-none sm:w-52"
            placeholder="Ürün ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { setPage(1); load(); }
            }}
          />
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border overflow-hidden" style={card}>
        <div className="divide-y" style={{ borderColor: "var(--color-border-admin)" }}>
          {items.length === 0 ? (
            <div className="py-16 text-center text-sm opacity-50">Kayıt bulunamadı.</div>
          ) : (
            items.map((it) => {
              const name = it?.name || it?.title || it?.slug || it?._id;
              const ownerId = it?._id || it?.id || null;
              return (
                <button
                  key={ownerId || it.slug}
                  onClick={() => openPanel(ownerId, name)}
                  disabled={!ownerId}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-hover)] disabled:opacity-40"
                  style={{ color: "var(--color-text-admin)" }}
                >
                  <div
                    className="shrink-0 rounded-lg p-2"
                    style={{ background: "var(--color-surface-light)" }}
                  >
                    <Package2 className="h-4 w-4 opacity-60" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{name}</div>
                    <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs opacity-60">
                      {"price" in it && (
                        <span>{Number(it.price || 0).toLocaleString("tr-TR")} ₺</span>
                      )}
                      {it?.category?.name && (
                        <span>{it.category.name}</span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
                </button>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div
            className="flex items-center justify-between border-t px-4 py-3"
            style={{ borderColor: "var(--color-border-admin)" }}
          >
            <span className="text-xs opacity-60">
              Toplam {total} kayıt — {page}/{pages}
            </span>
            <div className="flex gap-2">
              <button
                className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-40"
                style={card}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Önceki
              </button>
              <button
                className="rounded-xl border px-3 py-1.5 text-sm disabled:opacity-40"
                style={card}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>

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
