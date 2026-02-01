import StockItem from "../models/StockItem.js";

function normalizeValue(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function variantKeyOf(stock) {
  return [
    String(normalizeValue(stock.color) || "").toLowerCase(),
    String(normalizeValue(stock.size) || "").toLowerCase(),
    String(normalizeValue(stock.attributeValue) || "").toLowerCase(),
  ].join("||");
}

export function stockItemToInventoryRow(stock) {
  const qty = Number(stock?.qtyOnHand || 0);
  return {
    color: normalizeValue(stock?.color),
    size: normalizeValue(stock?.size),
    attributeValue: normalizeValue(stock?.attributeValue),
    stock: qty,
    stockCatalog: qty,
    stockSet: qty,
    stockItemId: stock?._id?.toString?.() || null,
    isActive: stock?.isActive !== false,
    sku: stock?.sku || null,
    note: stock?.note || "",
  };
}

export async function fetchProductStockMap(productIds = [], { includeInactive = false } = {}) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return new Map();
  }

  const ids = productIds
    .map((id) => (id?._id ? id._id : id))
    .filter(Boolean)
    .map((id) => String(id));

  if (!ids.length) return new Map();

  const query = { ownerModel: "Product", owner: { $in: ids } };
  if (!includeInactive) {
    query.isActive = true;
  }

  const rows = await StockItem.find(query).lean();
  const map = new Map();

  rows.forEach((row) => {
    const owner = String(row.owner);
    if (!map.has(owner)) {
      map.set(owner, {
        items: [],
        itemMap: new Map(),
      });
    }
    const bucket = map.get(owner);
    bucket.items.push(row);
    bucket.itemMap.set(variantKeyOf(row), row);
  });

  return map;
}

export async function hydrateProductsWithInventory(products = [], options = {}) {
  if (!Array.isArray(products) || products.length === 0) {
    return new Map();
  }

  const ids = products
    .map((doc) => doc?._id?.toString?.() || doc?.id || null)
    .filter(Boolean);

  const stockMap = await fetchProductStockMap(ids, options);

  products.forEach((product) => {
    const key = product?._id?.toString?.() || product?.id;
    if (!key) return;
    const bucket = stockMap.get(String(key)) || { items: [] };
    const inventory = bucket.items.map((row) => stockItemToInventoryRow(row));

    if (typeof product.set === "function") {
      product.set("inventory", inventory, { strict: false });
      product.set(
        "totalStock",
        inventory.reduce((acc, row) => acc + row.stock, 0),
        { strict: false }
      );
    }

    product.inventory = inventory;
    product.totalStock = inventory.reduce((acc, row) => acc + row.stock, 0);
  });

  return stockMap;
}
