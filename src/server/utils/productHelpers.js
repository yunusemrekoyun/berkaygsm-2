import slugify from "slugify";

export function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value))
    return value.filter(Boolean).map((v) => String(v).trim());
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed))
        return parsed.filter(Boolean).map((v) => String(v).trim());
    } catch (_) {}
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(lower)) return true;
    if (["false", "0", "no", "off"].includes(lower)) return false;
  }
  return fallback;
}

export function sanitizeOption(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

export function parseAttribute(value) {
  if (!value) return { title: "", values: [], show: false };
  let payload = value;
  if (typeof value === "string") {
    try {
      payload = JSON.parse(value);
    } catch {
      return { title: value, values: [], show: true };
    }
  }
  if (typeof payload !== "object" || Array.isArray(payload)) {
    return { title: "", values: [], show: false };
  }
  const title = String(payload.title || "").trim();
  let values = [];
  if (Array.isArray(payload.values)) {
    values = payload.values.map((item) => String(item).trim()).filter(Boolean);
  } else if (typeof payload.values === "string") {
    values = payload.values
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return { title, values, show: parseBoolean(payload.show, true) };
}

/**
 * Envanter parser:
 * - stockCatalog & stockSet: yeni ikili havuz
 * - legacy "stock" verilirse stockCatalog olarak kabul edilir (set havuzu 0)
 * - aynı varyant anahtarını (color|size|attribute) tekilleştirir
 */
export function parseInventory(value) {
  if (!value) return [];
  let payload = value;
  if (typeof value === "string") {
    try {
      payload = JSON.parse(value);
    } catch (error) {
      return [];
    }
  }
  if (!Array.isArray(payload)) return [];

  const map = new Map();
  payload.forEach((item) => {
    if (!item) return;
    const color = sanitizeOption(item.color);
    const size = sanitizeOption(item.size);
    const attributeValue = sanitizeOption(item.attributeValue);

    // legacy
    const stock = Number(item.stock);
    const safeStock =
      Number.isFinite(stock) && stock >= 0 ? Math.floor(stock) : 0;

    // yeni havuzlar (varsa onları al, yoksa legacy stock'a eşitle)
    const stockCatalogRaw = Number(item.stockCatalog);
    const stockSetRaw = Number(item.stockSet);
    const stockCatalog =
      Number.isFinite(stockCatalogRaw) && stockCatalogRaw >= 0
        ? Math.floor(stockCatalogRaw)
        : safeStock;
    const stockSet =
      Number.isFinite(stockSetRaw) && stockSetRaw >= 0
        ? Math.floor(stockSetRaw)
        : safeStock;

    const key = [color || "", size || "", attributeValue || ""].join("||");
    map.set(key, {
      color: color ?? null,
      size: size ?? null,
      attributeValue: attributeValue ?? null,
      // legacy alanı elde tutuyoruz
      stock: safeStock,
      // yeni havuzlar
      stockCatalog,
      stockSet,
    });
  });

  return Array.from(map.values());
}

export function ensureSlug(doc, sourceField = "name") {
  if (!doc[sourceField]) return;
  if (!doc.slug || doc.isModified?.(sourceField)) {
    const baseSlug = slugify(doc[sourceField], { lower: true, strict: true });
    doc.slug = baseSlug;
  }
}

export function shapeProduct(
  doc,
  { discount = null, finalPrice = undefined } = {}
) {
  if (!doc) return null;

  const id =
    doc._id?.toString?.() || doc.id?.toString?.() || String(doc._id || doc.id);
  const basePrice = Number(doc.price) || 0;

  const normalizedDiscount = discount
    ? {
        id: discount.id || discount._id?.toString?.() || String(discount._id),
        name: discount.name,
        percentage: Number(discount.percentage) || 0,
        description: discount.description || "",
      }
    : null;

  let computedFinal = finalPrice;
  if (!Number.isFinite(computedFinal)) {
    computedFinal = normalizedDiscount
      ? Math.round(
          (basePrice - (basePrice * normalizedDiscount.percentage) / 100) * 100
        ) / 100
      : basePrice;
  }

  // inventory’yi üç alanla yansıt (legacy "stock" = stockCatalog)
  const inventory = Array.isArray(doc.inventory)
    ? doc.inventory.map((row) => {
        const stockCatalog =
          typeof row.stockCatalog === "number"
            ? row.stockCatalog
            : typeof row.stock === "number" // legacy
            ? row.stock
            : 0;
        const stockSet = typeof row.stockSet === "number" ? row.stockSet : 0;
        return {
          color: row?.color ?? null,
          size: row?.size ?? null,
          attributeValue: row?.attributeValue ?? null,
          stock: stockCatalog, // legacy alanı doldurmaya devam
          stockCatalog,
          stockSet,
        };
      })
    : [];

  const category = (() => {
    if (!doc.category) return doc.category ?? null;
    if (typeof doc.category === "string") return doc.category;

    const categoryId =
      doc.category._id?.toString?.() ||
      doc.category.id?.toString?.() ||
      (typeof doc.category.toString === "function" &&
      doc.category.toString !== Object.prototype.toString
        ? String(doc.category.toString())
        : null);

    if (!categoryId || categoryId === "[object Object]") return null;

    return {
      id: categoryId,
      _id: categoryId,
      name: doc.category.name || "",
      slug: doc.category.slug || "",
      parent: (() => {
        const value =
          doc.category.parent?._id?.toString?.() ||
          doc.category.parent?.id?.toString?.() ||
          (doc.category.parent ? String(doc.category.parent) : null);
        return value && value !== "[object Object]" ? value : null;
      })(),
      level: Number(doc.category.level || 0),
      ancestors: Array.isArray(doc.category.ancestors)
        ? doc.category.ancestors
            .map((entry) => {
              const value =
                entry?._id?.toString?.() ||
                entry?.id?.toString?.() ||
                (entry ? String(entry) : "");
              return value && value !== "[object Object]" ? value : "";
            })
            .filter(Boolean)
        : [],
      image: doc.category.image || null,
    };
  })();

  return {
    id,
    name: doc.name,
    slug: doc.slug,
    price: basePrice,
    finalPrice: Math.max(0, Number(computedFinal) || 0),
    discount: normalizedDiscount,
    hasDiscount: Boolean(normalizedDiscount) && basePrice !== computedFinal,
    images: doc.images,
    colors: doc.colors,
    sizes: doc.sizes,
    showColors: doc.showColors !== undefined ? doc.showColors : true,
    showSizes: doc.showSizes !== undefined ? doc.showSizes : true,
    customAttribute: doc.customAttribute
      ? {
          title: doc.customAttribute.title || "",
          values: doc.customAttribute.values || [],
          show: !!doc.customAttribute.show,
        }
      : { title: "", values: [], show: false },
    inventory,
    description: doc.description,
    careInstructions: doc.careInstructions,
    details: doc.details,
    category,
    isActive: doc.isActive,
    listedInCatalog:
      doc.listedInCatalog !== undefined ? doc.listedInCatalog : true,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * pool = "catalog" | "set"
 * Stok tanımsızsa (envanter yoksa) Infinity döner (set stok hesabı için)
 */
export function computeAvailableStock(product, context = { for: "catalog" }) {
  // context.for: "catalog" | "set"
  const inv = Array.isArray(product?.inventory) ? product.inventory : [];
  if (inv.length === 0) {
    return context?.for === "set" ? 0 : Infinity;
  }

  const resolveRowStock = (row, pool) => {
    if (typeof row[pool] === "number") return row[pool];
    if (
      typeof row.stockCatalog !== "number" &&
      typeof row.stockSet !== "number" &&
      typeof row.stock === "number"
    ) {
      return row.stock;
    }
    if (typeof row.stock === "number") return row.stock;
    return 0;
  };

  if (context?.for === "set") {
    let min = Infinity;
    for (const row of inv) {
      const raw = resolveRowStock(row, "stockSet");
      const numeric = Number(raw);
      const value = Number.isFinite(numeric)
        ? Math.max(0, Math.floor(numeric))
        : 0;
      min = Math.min(min, value);
    }
    return min === Infinity ? 0 : min;
  }

  let total = 0;
  for (const row of inv) {
    const raw = resolveRowStock(row, "stockCatalog");
    total += Math.max(0, Math.floor(Number(raw) || 0));
  }
  return total;
}
