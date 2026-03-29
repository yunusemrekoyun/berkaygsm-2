// src/components/admin/stocks/StockManagerPanel.jsx
import { useEffect, useMemo, useState } from "react";
import { stocksApi } from "../../../api/stocks.js";
import { setApi } from "../../../api/sets.js";
import ColorBadge from "../common/ColorBadge.jsx";
import { X, Plus, Minus, Trash2, PlusCircle } from "lucide-react";

export default function StockManagerPanel({
  open,
  ownerModel, // "Product" | "Set"
  ownerId, // ObjectId
  ownerName = "",
  onClose,
}) {
  // eslint-disable-next-line no-unused-vars
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [addingOpen, setAddingOpen] = useState(false); // ← yeni: “Varyant Ekle” panelini aç/kapa
  const [addForm, setAddForm] = useState(() =>
    emptyAddForm(ownerModel, ownerId)
  );
  const [savingAll, setSavingAll] = useState(false);

  const themeCard = {
    borderColor: "var(--color-border-admin)",
    background: "var(--color-bg-card)",
    color: "var(--color-text-admin)",
  };

  useEffect(() => {
    if (!open || !ownerModel || !ownerId) return;
    setAddingOpen(false);
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
        const nextRows = list.map((row) => ({
          ...row,
          rowId:
            row._id ||
            [
              row.owner || ownerId,
              row.color || "",
              row.size || "",
              row.attributeValue || "",
            ].join("|"),
        }));
        setRows(nextRows);
      } else if (ownerModel === "Set") {
        const setDoc = await setApi.get(ownerId, undefined, { auth: true });
        const nextRows = [];
        (setDoc?.products || []).forEach((entry) => {
          const product = entry?.product || {};
          const productId =
            product.id || product._id?.toString?.() || product._id || "";
          const productName = product.name || "Ürün";
          const qtyInSet = Math.max(1, Number(entry?.quantity) || 1);
          const inventory = Array.isArray(product.inventory)
            ? product.inventory
            : [];
          if (!inventory.length) {
            const rowId = `${productId || "p"}::default`;
            nextRows.push({
              rowId,
              productId,
              productName,
              qtyInSet,
              color: null,
              size: null,
              attributeValue: null,
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
            const rowId = `${productId || "p"}::${key || "default"}`;
            nextRows.push({
              rowId,
              productId,
              productName,
              qtyInSet,
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

  // --------- Inline edit helpers ----------
  function patchRowLocal(id, patch) {
    setRows((prev) => prev.map((r) => (r.rowId === id ? { ...r, ...patch } : r)));
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

  async function saveRow(r) {
    try {
      const shouldReload = await persistRow(r);
      if (shouldReload) {
        await load();
      }
    } catch (e) {
      console.error(e);
      alert(e?.message || "Güncelleme başarısız.");
    }
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
    if (shouldReload) {
      await load();
    }
    setSavingAll(false);
    if (errors.length) {
      alert(
        `Bazı satırlar kaydedilemedi:\n${errors
          .slice(0, 5)
          .join("\n")}${errors.length > 5 ? "\n..." : ""}`
      );
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

  // --------- Yeni varyant ekleme (opsiyonel) ----------
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

  const total = useMemo(
    () =>
      rows.reduce((acc, r) => acc + Math.max(0, Number(r.qtyOnHand || 0)), 0),
    [rows]
  );

  const emptyMessage =
    ownerModel === "Product"
      ? "Bu öğe için tanımlı stok yok. İstersen yeni varyant ekleyebilirsin."
      : "Bu setteki ürünler için kayıtlı stok bilgisi bulunamadı.";

  return (
    <div
      className={`fixed inset-0 z-[90] ${open ? "" : "pointer-events-none"}`}
    >
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-[95%] max-w-[860px] transform border-l shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={themeCard}
      >
        {/* header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--color-border-admin)" }}
        >
          <div>
            <div className="text-sm opacity-70">
              {ownerModel === "Product" ? "Ürün" : "Set"}
            </div>
            <div className="text-base font-semibold">
              {ownerName || ownerId}
            </div>
            <div className="text-xs opacity-60">Toplam stok: {total}</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={saveAllRows}
              disabled={savingAll || !rows.length}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: "var(--color-accent)" }}
            >
              {savingAll ? "Kaydediliyor…" : "Tümünü Kaydet"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border p-2"
              style={{
                borderColor: "var(--color-border-admin)",
                background: "var(--color-bg-card)",
              }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex h-[calc(100%-3.5rem)] flex-col gap-4 p-4 overflow-y-auto">
          {/* MEVCUT STOKLAR — inline düzenleme */}
          <div className="rounded-xl border" style={themeCard}>
            <div
              className="border-b px-3 py-2 text-sm font-semibold"
              style={{ borderColor: "var(--color-border-admin)" }}
            >
              Mevcut Stoklar
            </div>

            <div
              className="divide-y"
              style={{ borderColor: "var(--color-border-admin)" }}
            >
              {rows.map((r) => {
                const activeId = `active-${r._id || r.rowId}`;
                return (
                  <div
                    key={r.rowId || r._id}
                    className="grid gap-3 px-3 py-3 md:grid-cols-12 md:items-center"
                  >
                  {/* varyant bilgisi */}
                  <div className="md:col-span-5 space-y-1">
                    {ownerModel === "Set" && (
                      <div className="flex items-baseline gap-2 text-sm font-semibold text-[var(--color-text-admin)]">
                        <span>{r.productName || "Ürün"}</span>
                        <span className="text-xs font-normal text-[var(--color-text-admin-muted)]">
                          × {Math.max(1, Number(r.qtyInSet || 1))}
                        </span>
                      </div>
                    )}
                    <VariantPills
                      color={r.color}
                      size={r.size}
                      attributeValue={r.attributeValue}
                    />
                    <div className="text-xs text-[var(--color-text-admin-muted)]">
                      SKU: {r.sku || "-"}
                    </div>
                    {r.note ? (
                      <div className="text-xs text-[var(--color-text-admin-muted)]">
                        Not: {r.note}
                      </div>
                    ) : null}
                  </div>

                  {/* miktar */}
                  <div className="md:col-span-3">
                    <label className="text-xs opacity-70">Miktar</label>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        onClick={() =>
                          patchRowLocal(r.rowId, {
                            qtyOnHand: Math.max(
                              0,
                              Number(r.qtyOnHand || 0) - 1
                            ),
                          })
                        }
                        className="rounded-lg border p-1"
                        title="-1"
                        style={{
                          borderColor: "var(--color-border-admin)",
                          background: "var(--color-bg-card)",
                        }}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        value={r.qtyOnHand ?? 0}
                        onChange={(e) =>
                          patchRowLocal(r.rowId, { qtyOnHand: e.target.value })
                        }
                        className="w-24 rounded-xl border px-3 py-2 text-sm"
                        style={{
                          borderColor: "var(--color-border-admin)",
                          background: "var(--color-surface-light)",
                        }}
                      />
                      <button
                        onClick={() =>
                          patchRowLocal(r.rowId, {
                            qtyOnHand: Number(r.qtyOnHand || 0) + 1,
                          })
                        }
                        className="rounded-lg border p-1"
                        title="+1"
                        style={{
                          borderColor: "var(--color-border-admin)",
                          background: "var(--color-bg-card)",
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* aktif + not */}
                  <div className="md:col-span-3">
                    <label className="text-xs opacity-70 block mb-1">
                      Durum
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={activeId}
                        type="checkbox"
                        checked={!!r.isActive}
                        onChange={(e) =>
                          patchRowLocal(r.rowId, {
                            isActive: e.target.checked,
                          })
                        }
                      />
                      <label htmlFor={activeId} className="text-sm">
                        Aktif
                      </label>
                    </div>
                    <TextArea
                      label="Not"
                      value={r.note || ""}
                      onChange={(v) => patchRowLocal(r.rowId, { note: v })}
                    />
                  </div>

                  {/* aksiyonlar */}
                  <div className="md:col-span-1 flex md:block items-center gap-2 justify-end">
                    <button
                      onClick={() => saveRow(r)}
                      className="rounded-xl px-3 py-2 text-sm font-medium text-white"
                      style={{ background: "var(--color-accent)" }}
                    >
                      Kaydet
                    </button>
                    {ownerModel === "Product" && (
                      <button
                        onClick={() => removeRow(r._id)}
                        className="rounded-xl border px-3 py-2 text-sm ml-2 md:ml-0 md:mt-2"
                        style={{
                          borderColor: "var(--color-border-admin)",
                          background: "var(--color-bg-card)",
                        }}
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    )}
                  </div>
                  </div>
                );
              })}

              {rows.length === 0 && (
                <div className="px-3 py-8 text-center text-sm opacity-70">
                  {emptyMessage}
                </div>
              )}
            </div>
          </div>

          {ownerModel === "Product" && (
            <div className="rounded-xl border" style={themeCard}>
              <div
                className="flex items-center justify-between border-b px-3 py-2"
                style={{ borderColor: "var(--color-border-admin)" }}
              >
                <div className="text-sm font-semibold">
                  Yeni Varyant Ekle (opsiyonel)
                </div>
                <button
                  onClick={() => setAddingOpen((s) => !s)}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm"
                  style={{
                    borderColor: "var(--color-border-admin)",
                    background: "var(--color-bg-hover)",
                  }}
                >
                  <PlusCircle className="h-4 w-4" />
                  {addingOpen ? "Kapat" : "Aç"}
                </button>
              </div>

              {addingOpen && (
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                      onChange={(v) =>
                        setAddForm((f) => ({ ...f, attributeValue: v }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextInput
                      label="Miktar"
                      type="number"
                      value={addForm.qtyOnHand}
                      onChange={(v) =>
                        setAddForm((f) => ({ ...f, qtyOnHand: v }))
                      }
                    />
                    <div className="flex items-center gap-2">
                      <input
                        id="isActive"
                        type="checkbox"
                        checked={!!addForm.isActive}
                        onChange={(e) =>
                          setAddForm((f) => ({
                            ...f,
                            isActive: e.target.checked,
                          }))
                        }
                      />
                      <label htmlFor="isActive" className="text-sm">
                        Aktif
                      </label>
                    </div>
                  </div>

                  <TextArea
                    label="Not"
                    value={addForm.note}
                    onChange={(v) => setAddForm((f) => ({ ...f, note: v }))}
                  />

                  <div className="flex justify-end">
                    <button
                      onClick={addNewVariant}
                      className="rounded-xl px-4 py-2 text-sm font-medium text-white"
                      style={{ background: "var(--color-accent)" }}
                    >
                      Varyantı Ekle
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function emptyAddForm(ownerModel, owner) {
  return {
    ownerModel,
    owner,
    color: "",
    size: "",
    attributeValue: "",
    components: [],
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
      {label && <label className="text-xs opacity-70">{label}</label>}
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

function TextArea({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs opacity-70">{label}</label>}
      <textarea
        rows={3}
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
  if (attributeValue)
    chips.push(<VariantBadge key="attr" value={attributeValue} />);

  if (!chips.length) {
    return (
      <span className="inline-flex items-center rounded-full border border-[var(--color-border-admin)]/60 bg-[var(--color-surface-light)] px-2 py-1 text-xs font-medium text-[var(--color-text-admin-muted)]">
        Varsayılan varyant
      </span>
    );
  }

  return <div className="flex flex-wrap items-center gap-2">{chips}</div>;
}

function VariantBadge({ label, value }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)]/60 bg-[var(--color-surface-light)] px-2 py-1 text-xs font-medium text-[var(--color-text-admin)]">
      {label ? (
        <span className="text-[var(--color-text-admin-muted)]">{label}:</span>
      ) : null}
      <span>{value}</span>
    </span>
  );
}
