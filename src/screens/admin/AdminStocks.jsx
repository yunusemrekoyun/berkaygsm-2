import { useEffect, useMemo, useState } from "react";
import { productApi } from "../../api/products.js";
import { setApi } from "../../api/sets.js";
import { Package2, Layers, Search, ChevronRight } from "lucide-react";
import StockManagerPanel from "../../components/admin/stocks/StockManagerPanel.jsx";

const PAGE_SIZE = 20;

export default function AdminStocks() {
  const [tab, setTab] = useState("products");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const pages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelOwner, setPanelOwner] = useState({ model: null, id: null, name: "" });

  async function load() {
    try {
      if (tab === "products") {
        const data = await productApi.list({ page, limit: PAGE_SIZE, search: query || undefined });
        const rows = Array.isArray(data?.products) ? data.products : Array.isArray(data) ? data : [];
        setItems(rows);
        setTotal(Number(data?.pagination?.total ?? rows.length));
      } else {
        const data = await setApi.list({ page, limit: PAGE_SIZE, search: query || undefined });
        const rows = Array.isArray(data) ? data : Array.isArray(data?.sets) ? data.sets : [];
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

  function openPanel(model, id, name) {
    setPanelOwner({ model, id, name });
    setPanelOpen(true);
  }

  const card = {
    borderColor: "var(--color-border-admin)",
    background: "var(--color-bg-card)",
    color: "var(--color-text-admin)",
  };

  const TABS = [
    { key: "products", label: "Ürünler", Icon: Package2 },
    { key: "sets", label: "Setler", Icon: Layers },
  ];

  return (
    <>
      {/* Header */}
      <div
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border p-3 sm:p-4"
        style={card}
      >
        {/* Tabs */}
        <div
          className="flex gap-1 rounded-xl p-1"
          style={{ background: "var(--color-surface-light)" }}
        >
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setPage(1); }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                tab === key ? "shadow-sm" : "opacity-50 hover:opacity-80"
              }`}
              style={{
                background: tab === key ? "var(--color-bg-card)" : "transparent",
                color: "var(--color-text-admin)",
              }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 rounded-full border px-3 py-1.5"
          style={card}
        >
          <Search className="h-4 w-4 opacity-50" />
          <input
            className="w-full bg-transparent text-sm outline-none sm:w-52"
            placeholder={tab === "products" ? "Ürün ara…" : "Set ara…"}
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
              const model = tab === "products" ? "Product" : "Set";
              const name = it?.name || it?.title || it?.slug || it?._id;
              const ownerId = it?._id || it?.id || null;
              return (
                <button
                  key={ownerId || it.slug}
                  onClick={() => openPanel(model, ownerId, name)}
                  disabled={!ownerId}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-hover)] disabled:opacity-40"
                  style={{ color: "var(--color-text-admin)" }}
                >
                  <div
                    className="shrink-0 rounded-lg p-2"
                    style={{ background: "var(--color-surface-light)" }}
                  >
                    {tab === "products"
                      ? <Package2 className="h-4 w-4 opacity-60" />
                      : <Layers className="h-4 w-4 opacity-60" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{name}</div>
                    <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs opacity-60">
                      {"price" in it && (
                        <span>{Number(it.price || 0).toLocaleString("tr-TR")} ₺</span>
                      )}
                      {tab === "products" && it?.category?.name && (
                        <span>{it.category.name}</span>
                      )}
                      {tab === "sets" && (
                        <span>{(it?.products || []).length} parça</span>
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
