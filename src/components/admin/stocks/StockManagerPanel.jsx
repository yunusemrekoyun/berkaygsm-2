import { useEffect, useMemo, useState } from "react";
import { stocksApi } from "../../../api/stocks.js";
import { setApi } from "../../../api/sets.js";
import ColorBadge from "../common/ColorBadge.jsx";
import { X, Plus, Minus, Trash2, PlusCircle, AlertTriangle } from "lucide-react";

const LOW_STOCK = 3;

export default function StockManagerPanel({
  open,
  ownerModel,
  ownerId,
  ownerName = "",
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [addingOpen, setAddingOpen] = useState(false);
  const [addForm, setAddForm] = useState(() => emptyAddForm(ownerModel, ownerId));
  const [savingAll, setSavingAll] = useState(false);

  const card = {
    borderColor: "var(--color-border-admin)",
    background: "var(--color-bg-card)",
    color: "var(--color-text-admin)",
  };

  useEffect(() => {
    if (!open || !ownerModel || !ownerId) return;
    setAddingOpen(false);
    setDirty(false);
    setAddForm(emptyAddForm(ownerModel, ownerId));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ownerModel, ownerId]);

  async function load() {
    if (!ownerModel || !ownerId) return;
    setLoading(true);
    try {
      if (ownerModel === "Product") {
        const data = await stocksApi.listByOwner("Product", ownerId);
        const list = Array.isArray(data?.stocks)
          ? data.stocks
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setRows(
          list.map((row) => ({
            ...row,
            rowId:
              row._id ||
              [row.owner || ownerId, row.color || "", row.size || "", row.attributeValue || ""].join("|"),
          }))
        );
      } else if (ownerModel === "Set") {
        const setDoc = await setApi.get(ownerId, undefined, { auth: true });
        const nextRows = [];
        (setDoc?.products || []).forEach((entry) => {
          const product = entry?.product || {};
          const productId = product.id || product._id?.toString?.() || product._id || "";
          const productName = product.name || "Ürün";
          const qtyInSet = Math.max(1, Number(entry?.quantity) || 1);
          const inventory = Array.isArray(product.inventory) ? product.inventory : [];
          if (!inventory.length) {
            nextRows.push({
              rowId: `${productId || "p"}::default`,
              productId, productName, qtyInSet,
              color: null, size: null, attributeValue: null,
              qtyOnHand: Number(product.totalStock || 0),
              sku: product.sku || "",
              isActive: product.isActive ?? true,
              note: "",
              stockItemId: null,
              _id: null,
            });
            return;
          }
          inventory.forEach((inv) => {
            const key = [
              (norm(inv.color) || "").toLowerCase(),
              (norm(inv.size) || "").toLowerCase(),
              (norm(inv.attributeValue) || "").toLowerCase(),
            ].join("||");
            nextRows.push({
              rowId: `${productId || "p"}::${key || "default"}`,
              productId, productName, qtyInSet,
              color: inv.color ?? null,
              size: inv.size ?? null,
              attributeValue: inv.attributeValue ?? null,
              qtyOnHand: Number(inv.stock || 0),
              sku: inv.sku || "",
              isActive: inv.isActive !== false,
              note: inv.note || "",
              stockItemId: inv.stockItemId || null,
              _id: inv.stockItemId || null,
            });
          });
        });
        setRows(nextRows);
      } else {
        setRows([]);
      }
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function patchRowLocal(id, patch) {
    setRows((prev) => prev.map((r) => (r.rowId === id ? { ...r, ...patch } : r)));
    setDirty(true);
  }

  async function persistRow(r) {
    if (ownerModel === "Product") {
      if (r._id) {
        await stocksApi.update(r._id, {
          qtyOnHand: Number(r.qtyOnHand || 0),
          sku: r.sku || undefined,
          isActive: !!r.isActive,
          note: r.note || "",
        });
      } else {
        await stocksApi.upsert(
          stocksApi.helpers.forProduct({
            owner: ownerId,
            color: norm(r.color),
            size: norm(r.size),
            attributeValue: norm(r.attributeValue),
            qtyOnHand: Number(r.qtyOnHand || 0),
            note: r.note || "",
            isActive: !!r.isActive,
            mode: "set",
            sku: norm(r.sku) || undefined,
          })
        );
      }
      return false;
    }
    if (ownerModel === "Set") {
      await stocksApi.upsert(
        stocksApi.helpers.forProduct({
          owner: r.productId,
          color: norm(r.color),
          size: norm(r.size),
          attributeValue: norm(r.attributeValue),
          qtyOnHand: Number(r.qtyOnHand || 0),
          sku: norm(r.sku) || undefined,
          note: r.note || "",
          isActive: !!r.isActive,
          mode: "set",
        })
      );
      return true;
    }
    return false;
  }

  async function saveAllRows() {
    if (!rows.length || savingAll) return;
    setSavingAll(true);
    let shouldReload = false;
    const errors = [];
    for (const row of rows) {
      try {
        const reloadNeeded = await persistRow(row);
        if (reloadNeeded) shouldReload = true;
      } catch (e) {
        console.error(e);
        errors.push(e?.message || "Kaydedilemedi");
      }
    }
    if (shouldReload) await load();
    setSavingAll(false);
    setDirty(false);
    if (errors.length) {
      alert(`Bazı satırlar kaydedilemedi:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? "\n..." : ""}`);
    }
  }

  async function removeRow(id) {
    if (ownerModel !== "Product") return;
    if (!confirm("Bu stok satırını silmek istediğine emin misin?")) return;
    try {
      await stocksApi.remove(id);
      setRows((prev) => prev.filter((r) => r.rowId !== id && r._id !== id));
    } catch (e) {
      console.error(e);
      alert(e?.message || "Silme başarısız.");
    }
  }

  async function addNewVariant() {
    if (ownerModel !== "Product") return;
    try {
      await stocksApi.upsert(
        stocksApi.helpers.forProduct({
          owner: ownerId,
          color: norm(addForm.color),
          size: norm(addForm.size),
          attributeValue: norm(addForm.attributeValue),
          qtyOnHand: Number(addForm.qtyOnHand || 0),
          note: addForm.note || "",
          isActive: !!addForm.isActive,
          mode: "set",
        })
      );
      await load();
      setAddingOpen(false);
      setAddForm(emptyAddForm(ownerModel, ownerId));
    } catch (e) {
      console.error(e);
      alert(e?.message || "Ekleme başarısız.");
    }
  }

  const totalQty = useMemo(
    () => rows.reduce((acc, r) => acc + Math.max(0, Number(r.qtyOnHand || 0)), 0),
    [rows]
  );
  const lowCount = useMemo(
    () => rows.filter((r) => Number(r.qtyOnHand || 0) <= LOW_STOCK).length,
    [rows]
  );

  return (
    <div className={`fixed inset-0 z-[90] ${open ? "" : "pointer-events-none"}`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={`absolute right-0 top-0 flex h-full w-[95%] max-w-[680px] flex-col border-l shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={card}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--color-border-admin)" }}
        >
          <div className="min-w-0">
            <div className="text-xs opacity-50">{ownerModel === "Product" ? "Ürün" : "Set"}</div>
            <div className="truncate font-semibold">{ownerName || ownerId}</div>
          </div>

          <div className="ml-4 flex shrink-0 items-center gap-3">
            {/* Özet */}
            <div className="flex items-center gap-2 text-sm">
              <span className="opacity-60">
                Toplam: <b className="opacity-100">{totalQty}</b>
              </span>
              {lowCount > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {lowCount} az stok
                </span>
              )}
            </div>

            {/* Kaydet */}
            <div className="relative">
              <button
                onClick={saveAllRows}
                disabled={savingAll || !rows.length}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "var(--color-accent)" }}
              >
                {savingAll ? "Kaydediliyor…" : "Kaydet"}
              </button>
              {dirty && !savingAll && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400" />
              )}
            </div>

            <button
              onClick={onClose}
              className="rounded-lg border p-1.5"
              style={card}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-sm opacity-50">Yükleniyor…</div>
          ) : (
            <>
              {/* Stok satırları */}
              <div className="overflow-hidden rounded-xl border" style={card}>
                {rows.length === 0 ? (
                  <div className="py-10 text-center text-sm opacity-50">
                    {ownerModel === "Product"
                      ? "Stok tanımlı değil. Aşağıdan yeni varyant ekleyebilirsin."
                      : "Bu setteki ürünler için stok bilgisi bulunamadı."}
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--color-border-admin)" }}>
                    {rows.map((r) => {
                      const qty = Number(r.qtyOnHand || 0);
                      const isLow = qty > 0 && qty <= LOW_STOCK;
                      const isEmpty = qty === 0;
                      return (
                        <div
                          key={r.rowId || r._id}
                          className="flex items-center gap-3 px-3 py-2.5"
                        >
                          {/* Stok seviye göstergesi */}
                          <div
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              isEmpty ? "bg-red-500" : isLow ? "bg-amber-400" : "bg-emerald-400"
                            }`}
                            title={isEmpty ? "Stok yok" : isLow ? "Az stok" : "Yeterli stok"}
                          />

                          {/* Varyant bilgisi */}
                          <div className="flex-1 min-w-0">
                            {ownerModel === "Set" && (
                              <div className="truncate text-xs font-medium opacity-70 mb-0.5">
                                {r.productName}
                                {r.qtyInSet > 1 && (
                                  <span className="opacity-60"> ×{r.qtyInSet}</span>
                                )}
                              </div>
                            )}
                            <VariantPills
                              color={r.color}
                              size={r.size}
                              attributeValue={r.attributeValue}
                            />
                            {r.sku && (
                              <div className="mt-0.5 text-xs opacity-40">SKU: {r.sku}</div>
                            )}
                          </div>

                          {/* Miktar stepper */}
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() =>
                                patchRowLocal(r.rowId, {
                                  qtyOnHand: Math.max(0, qty - 1),
                                })
                              }
                              className="rounded-md border p-1 transition-colors hover:bg-[var(--color-bg-hover)]"
                              style={{ borderColor: "var(--color-border-admin)" }}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              value={r.qtyOnHand ?? 0}
                              onChange={(e) =>
                                patchRowLocal(r.rowId, { qtyOnHand: e.target.value })
                              }
                              className="w-14 rounded-lg border px-2 py-1 text-center text-sm"
                              style={{
                                borderColor: isLow || isEmpty
                                  ? "#f59e0b"
                                  : "var(--color-border-admin)",
                                background: "var(--color-surface-light)",
                                color: "var(--color-text-admin)",
                              }}
                            />
                            <button
                              onClick={() =>
                                patchRowLocal(r.rowId, { qtyOnHand: qty + 1 })
                              }
                              className="rounded-md border p-1 transition-colors hover:bg-[var(--color-bg-hover)]"
                              style={{ borderColor: "var(--color-border-admin)" }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Aktif toggle */}
                          <label
                            className="relative inline-flex shrink-0 cursor-pointer items-center"
                            title={r.isActive ? "Aktif" : "Pasif"}
                          >
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={!!r.isActive}
                              onChange={(e) =>
                                patchRowLocal(r.rowId, { isActive: e.target.checked })
                              }
                            />
                            <div
                              className="h-5 w-9 rounded-full bg-gray-300 transition-colors peer-checked:bg-[var(--color-accent)]
                              after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full
                              after:bg-white after:shadow after:transition-all peer-checked:after:translate-x-4"
                            />
                          </label>

                          {/* Sil */}
                          {ownerModel === "Product" && (
                            <button
                              onClick={() => removeRow(r._id)}
                              className="shrink-0 rounded-lg p-1.5 text-red-500 opacity-60 transition-opacity hover:opacity-100"
                              title="Sil"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Yeni varyant ekle (yalnızca Product) */}
              {ownerModel === "Product" && (
                <>
                  {!addingOpen ? (
                    <button
                      onClick={() => setAddingOpen(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm opacity-50 transition-opacity hover:opacity-100"
                      style={{ borderColor: "var(--color-border-admin)" }}
                    >
                      <PlusCircle className="h-4 w-4" />
                      Yeni Varyant Ekle
                    </button>
                  ) : (
                    <div className="rounded-xl border p-4 space-y-3" style={card}>
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Yeni Varyant</div>
                        <button
                          onClick={() => setAddingOpen(false)}
                          className="opacity-50 hover:opacity-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <TextInput
                          label="Renk"
                          value={addForm.color}
                          onChange={(v) => setAddForm((f) => ({ ...f, color: v }))}
                        />
                        <TextInput
                          label="Beden"
                          value={addForm.size}
                          onChange={(v) => setAddForm((f) => ({ ...f, size: v }))}
                        />
                        <TextInput
                          label="Özellik"
                          value={addForm.attributeValue}
                          onChange={(v) => setAddForm((f) => ({ ...f, attributeValue: v }))}
                        />
                      </div>

                      <div className="flex items-end gap-3">
                        <TextInput
                          label="Miktar"
                          type="number"
                          value={addForm.qtyOnHand}
                          onChange={(v) => setAddForm((f) => ({ ...f, qtyOnHand: v }))}
                        />
                        <button
                          onClick={addNewVariant}
                          className="rounded-xl px-4 py-2 text-sm font-medium text-white"
                          style={{ background: "var(--color-accent)" }}
                        >
                          Ekle
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// --- Helpers ---

function emptyAddForm(ownerModel, owner) {
  return {
    ownerModel,
    owner,
    color: "",
    size: "",
    attributeValue: "",
    qtyOnHand: 0,
    isActive: true,
    note: "",
  };
}

function norm(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function TextInput({ label, value, onChange, type = "text" }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs opacity-60">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-xl border px-3 py-2 text-sm"
        style={{
          borderColor: "var(--color-border-admin)",
          background: "var(--color-surface-light)",
          color: "var(--color-text-admin)",
        }}
      />
    </div>
  );
}

function VariantPills({ color, size, attributeValue }) {
  const chips = [];
  if (color) chips.push(<ColorBadge key="color" value={color} />);
  if (size) chips.push(<VariantBadge key="size" label="Beden" value={size} />);
  if (attributeValue) chips.push(<VariantBadge key="attr" value={attributeValue} />);

  if (!chips.length) {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--color-border-admin)]/60 bg-[var(--color-surface-light)] px-2 py-1 text-xs font-medium text-[var(--color-text-admin-muted)]">
        Varsayılan
      </span>
    );
  }

  return <div className="flex flex-wrap items-center gap-2">{chips}</div>;
}

function VariantBadge({ label, value }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)]/60 bg-[var(--color-surface-light)] px-2 py-1 text-xs font-medium text-[var(--color-text-admin)]">
      {label && (
        <span className="text-[var(--color-text-admin-muted)]">{label}:</span>
      )}
      <span>{value}</span>
    </span>
  );
}
