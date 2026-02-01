// src/components/set-detail/SetVariantPickerModal.jsx
import { useEffect, useMemo, useState } from "react";
import { getColorInfo } from "../../utils/colors.js";
import { useStorefrontLang } from "../../context/LangContext.jsx";

function normalize(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.toLowerCase() : null;
}

function sanitizeOption(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

// inventory kaydından SET havuzu stoğunu oku (yoksa legacy stock'a düş)
function getInventoryStockForSet(inv) {
  const n = Number(inv?.stockSet);
  if (Number.isFinite(n) && n >= 0) return n;
  const legacy = Number(inv?.stock);
  return Number.isFinite(legacy) && legacy >= 0 ? legacy : 0;
}

// --- Hook KULLANMADAN seçenekleri üret ---
function getInventory(product = {}) {
  return Array.isArray(product.inventory) ? product.inventory : [];
}

function buildOptions(product = {}, lang) {
  const inventory = getInventory(product);

  // Renkler
  let colorOptions = [];
  if (product.showColors !== false) {
    const map = new Map();
    const register = (input) => {
      const raw = sanitizeOption(input);
      const info = getColorInfo(raw, lang);
      if (!raw && !info.value) return;
      const key = (info.value || raw || "").toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          key: key || String(map.size),
          value: raw,
          label: info.label || raw || "Default",
          swatch: info.swatch,
          isHex: info.isHex,
        });
      }
    };
    (product.colors || []).forEach(register);
    inventory.forEach((item) => register(item.color));
    colorOptions = Array.from(map.values());
  }

  // Bedenler
  let sizeOptions = [];
  if (product.showSizes !== false) {
    const set = new Set(product.sizes || []);
    inventory.forEach((item) => {
      if (item.size) set.add(item.size);
    });
    sizeOptions = Array.from(set).filter(Boolean);
  }

  // Custom attribute
  let attribute = null;
  if (product.customAttribute?.show) {
    const baseValues = product.customAttribute.values || [];
    const map = new Map();
    baseValues.forEach((value) => {
      const key = `${value || ""}`.toLowerCase();
      if (!key) return;
      map.set(key, value);
    });
    inventory.forEach((item) => {
      const key = `${item.attributeValue || ""}`.toLowerCase();
      if (!key) return;
      if (!map.has(key)) map.set(key, item.attributeValue);
    });
    const values = Array.from(map.values()).filter(Boolean);
    attribute = {
      title: product.customAttribute.title || "Option",
      values,
    };
  }

  return { inventory, colorOptions, sizeOptions, attribute };
}

function computeCurrentStock(inventory, sel) {
  if (!inventory?.length) return 0;
  const match = inventory.find((item) => {
    const c = normalize(item.color) === normalize(sel.color);
    const s = normalize(item.size) === normalize(sel.size);
    const a = normalize(item.attributeValue) === normalize(sel.attribute);
    return c && s && a;
  });
  return match ? getInventoryStockForSet(match) : 0;
}

export default function SetVariantPickerModal({
  open,
  onClose,
  setDoc,
  setQty = 1, // 1 set satırı kaç adet eklenecek (SetSummary’den)
  // onConfirm(selections: Array<{ productId, color, colorHex, size, attribute, qtyInSet }>)
  onConfirm,
}) {
  const { lang } = useStorefrontLang();
  const setQuantity = Math.max(0, Number(setQty) || 0);
  const items = useMemo(
    () => (Array.isArray(setDoc?.products) ? setDoc.products : []),
    [setDoc?.products]
  );

  // her ürün için seçim state’i
  const [selections, setSelections] = useState(() =>
    items.map((entry) => {
      const p = entry?.product || entry || {};
      return {
        productId: p.id || p._id || null,
        name: p.name || "Product",
        qtyInSet: Number(entry?.quantity) || 1,
        color: null,
        size: null,
        attribute: null,
      };
    })
  );

  // set / items değişirse sıfırla
  useEffect(() => {
    setSelections(
      items.map((entry) => {
        const p = entry?.product || entry || {};
        return {
          productId: p.id || p._id || null,
          name: p.name || "Product",
          qtyInSet: Number(entry?.quantity) || 1,
          color: null,
          size: null,
          attribute: null,
        };
      })
    );
  }, [items]);

  // satırlar (UI + stok uygunluğu)
  const rows = useMemo(() => {
    return items.map((entry, idx) => {
      const p = entry?.product || entry || {};
      const { inventory, colorOptions, sizeOptions, attribute } =
        buildOptions(p, lang);

      const sel = selections[idx] || {};
      const current = {
        color: sel.color ?? colorOptions[0]?.value ?? null,
        size: sel.size ?? sizeOptions[0] ?? null,
        attribute: sel.attribute ?? attribute?.values?.[0] ?? null,
      };

      const stock = computeCurrentStock(inventory, current);
      const perSet = Math.max(1, Number(sel.qtyInSet) || 1);
      const required = setQuantity * perSet;
      const ok = stock >= required;

      const cInfo = current.color ? getColorInfo(current.color, lang) : null;

      return {
        product: p,
        entryQty: Number(entry?.quantity) || 1,
        colorOptions,
        sizeOptions,
        attribute,
        selection: current,
        colorInfo: cInfo,
        stock,
        required,
        ok,
      };
    });
  }, [items, lang, selections, setQuantity]);

  const allOk = rows.every((r) => r.ok);

  const updateSel = (idx, patch) => {
    setSelections((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    );
  };

  const confirm = () => {
    if (setQuantity <= 0) return;
    if (!allOk) return;
    const payload = rows.map((r, idx) => ({
      productId: selections[idx]?.productId,
      qtyInSet: selections[idx]?.qtyInSet || r.entryQty,
      color: r.selection.color,
      colorHex: r.colorInfo?.isHex ? r.colorInfo.swatch : null,
      size: r.selection.size,
      attribute: r.selection.attribute,
    }));
    onConfirm?.(payload);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
          <h3 className="text-sm font-semibold text-primary">
            Choose variants for set items
          </h3>
          <button
            className="rounded-full border border-border px-3 py-1 text-sm text-primary hover:bg-surface-hover"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className="max-h-[65vh] overflow-auto p-4">
          <div className="space-y-4">
            {rows.map((row, idx) => (
              <div
                key={row.product?.id || row.product?._id || idx}
                className="rounded-xl border border-border bg-contact-bg p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-primary">
                      {row.product?.name || "Product"}
                    </div>
                    <div className="text-xs text-secondary">
                      In set: x{row.entryQty}
                    </div>
                  </div>
                  <div
                    className={[
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                      row.ok
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                        : "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
                    ].join(" ")}
                  >
                    {row.ok
                      ? `Stock OK (${row.stock} ≥ ${row.required})`
                      : `Insufficient (${row.stock} / ${row.required})`}
                  </div>
                </div>

                {/* Colour */}
                {row.colorOptions.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-primary">
                      Colour
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {row.colorOptions.map((opt) => {
                        const active =
                          normalize(opt.value) ===
                          normalize(row.selection.color);
                        return (
                          <button
                            key={opt.key || opt.value || "color"}
                            onClick={() => updateSel(idx, { color: opt.value })}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                              active
                                ? "border-accent bg-accent text-white"
                                : "border-border bg-white text-primary hover:bg-surface-hover"
                            }`}
                          >
                            <span
                              className="grid h-5 w-5 place-items-center rounded-full border border-white/70 shadow-inner"
                              style={{ background: opt.swatch }}
                              aria-hidden="true"
                            />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Size */}
                {row.sizeOptions.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-primary">
                      Size
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {row.sizeOptions.map((size) => {
                        const active =
                          size === (row.selection.size ?? row.sizeOptions[0]);
                        return (
                          <button
                            key={size}
                            onClick={() => updateSel(idx, { size })}
                            className={`rounded-full border px-3 py-1.5 text-sm transition ${
                              active
                                ? "border-accent bg-accent text-white"
                                : "border-border bg-white text-primary hover:bg-surface-hover"
                            }`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom Attribute */}
                {row.attribute && row.attribute.values.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-primary">
                      {row.attribute.title || "Option"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {row.attribute.values.map((v) => {
                        const active =
                          normalize(v) === normalize(row.selection.attribute);
                        return (
                          <button
                            key={v}
                            onClick={() => updateSel(idx, { attribute: v })}
                            className={`rounded-full border px-3 py-1.5 text-sm transition ${
                              active
                                ? "border-accent bg-accent text-white"
                                : "border-border bg-white text-primary hover:bg-surface-hover"
                            }`}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
          <div className="text-xs text-secondary">
            You’re adding{" "}
            <strong className="text-primary">{setQuantity}</strong> set
            {setQuantity > 1 ? "s" : ""}.
          </div>
          <button
            onClick={confirm}
            disabled={!allOk || setQuantity <= 0}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            Confirm selections
          </button>
        </footer>
      </div>
    </div>
  );
}
