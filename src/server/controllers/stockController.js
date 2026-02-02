import mongoose from "mongoose";
import StockItem from "../models/StockItem.js";
import Product from "../models/Product.js";
import Set from "../models/Set.js";

const isId = (s) => typeof s === "string" && /^[0-9a-fA-F]{24}$/.test(s);

function toBool(v, fb = false) {
  if (v === undefined || v === null) return fb;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(s)) return true;
  if (["false", "0", "no", "off"].includes(s)) return false;
  return fb;
}

async function assertOwner(ownerModel, owner) {
  if (!["Product", "Set"].includes(ownerModel))
    throw new Error("ownerModel must be Product or Set");
  if (!isId(owner)) throw new Error("owner is not a valid ObjectId");
  const Model = ownerModel === "Set" ? Set : Product;
  const exists = await Model.exists({ _id: owner });
  if (!exists) throw new Error(`${ownerModel} not found`);
}

function norm(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}
function normalizeComponents(list) {
  const arr = Array.isArray(list) ? list : [];
  return arr
    .map((c) => ({
      product: c?.product, // ObjectId string beklenir
      quantity: Math.max(1, Number(c?.quantity) || 1),
      color: norm(c?.color),
      size: norm(c?.size),
      attributeValue: norm(c?.attributeValue),
    }))
    .filter((c) => isId(String(c.product)));
}

/** GET /api/stocks */
export async function listStocks(req, res) {
  try {
    const {
      ownerModel,
      owner,
      page = 1,
      limit = 50,
      search,
      isActive,
    } = req.query;
    const filter = {};
    if (ownerModel) filter.ownerModel = ownerModel;
    if (owner && isId(owner)) filter.owner = owner;
    if (isActive !== undefined) filter.isActive = toBool(isActive, true);
    if (search) filter.sku = { $regex: String(search).trim(), $options: "i" };

    const p = Math.max(1, Number(page));
    const l = Math.min(200, Math.max(1, Number(limit)));

    const [items, total] = await Promise.all([
      StockItem.find(filter)
        .sort({ updatedAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .populate({ path: "owner" })
        .populate({ path: "components.product", model: "Product" })
        .lean(),
      StockItem.countDocuments(filter),
    ]);

    res.json({
      stocks: items,
      pagination: {
        page: p,
        limit: l,
        total,
        pages: Math.max(1, Math.ceil(total / l)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "List failed" });
  }
}

/** GET /api/stocks/by-owner/:ownerModel/:owner */
export async function listByOwner(req, res) {
  try {
    const { ownerModel, owner } = req.params;
    await assertOwner(ownerModel, owner);
    const rows = await StockItem.find({ ownerModel, owner })
      .sort({ updatedAt: -1 })
      .populate({ path: "components.product", model: "Product" })
      .lean();
    res.json({ stocks: rows });
  } catch (err) {
    const status = /owner|not a valid/.test(err.message) ? 400 : 500;
    res.status(status).json({ message: err.message || "List by owner failed" });
  }
}

/** POST /api/stocks  (upsert by owner+combo) */
export async function upsertStock(req, res) {
  try {
    const {
      ownerModel,
      owner,
      color = null,
      size = null,
      attributeValue = null,
      components,
      qtyOnHand,
      delta,
      sku,
      isActive,
      note,
      mode = "set", // "set" | "inc"
    } = req.body;

    await assertOwner(ownerModel, owner);

    const base = {
      ownerModel,
      owner,
      color: ownerModel === "Product" ? norm(color) : null,
      size: ownerModel === "Product" ? norm(size) : null,
      attributeValue: ownerModel === "Product" ? norm(attributeValue) : null,
      components: ownerModel === "Set" ? normalizeComponents(components) : [],
    };
    if (base.ownerModel === "Set" && base.components.length === 0) {
      return res
        .status(400)
        .json({ message: "Set stock row requires non-empty components" });
    }

    // comboKey pre-hook’ta üretilecek — ama upsert için var olanı bulmak adına SAFE hesap
    const probe = await new StockItem(base).validate().then(() => base); // validate triggers comboKey build via pre('validate')
    const comboKeyHost = await new StockItem(probe);
    comboKeyHost.validateSync();
    const comboKey = comboKeyHost.comboKey;

    let found = await StockItem.findOne({ ownerModel, owner, comboKey });
    if (!found) {
      const doc = await StockItem.create({
        ...base,
        comboKey,
        qtyOnHand:
          mode === "inc"
            ? Math.max(0, Math.floor(Number(delta) || 0))
            : Math.max(0, Math.floor(Number(qtyOnHand) || 0)),
        sku: sku ? String(sku).trim().toUpperCase() : undefined,
        isActive: isActive === undefined ? true : !!isActive,
        note: note ?? "",
      });
      const populated = await doc.populate([
        { path: "owner", model: doc.ownerModel },
        { path: "components.product", model: "Product" },
      ]);
      return res.status(201).json({ stock: populated });
    }

    if (mode === "inc") {
      const d = Math.floor(Number(delta) || 0);
      found.qtyOnHand = Math.max(0, (found.qtyOnHand || 0) + d);
    } else {
      const q = Math.floor(Number(qtyOnHand) || 0);
      found.qtyOnHand = Math.max(0, q);
    }
    if (sku) found.sku = String(sku).trim().toUpperCase();
    if (isActive !== undefined) found.isActive = !!isActive;
    if (note !== undefined) found.note = String(note);

    await found.save();
    const populated = await found.populate([
      { path: "owner", model: found.ownerModel },
      { path: "components.product", model: "Product" },
    ]);
    res.json({ stock: populated });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.sku)
      return res.status(400).json({ message: "SKU already exists" });
    res.status(400).json({ message: err.message || "Upsert failed" });
  }
}

/** PATCH /api/stocks/:id */
export async function updateStock(req, res) {
  try {
    const { id } = req.params;
    const stock = await StockItem.findById(id);
    if (!stock) return res.status(404).json({ message: "Stock not found" });

    const { qtyOnHand, delta, sku, isActive, note } = req.body;
    if (delta !== undefined) {
      const d = Math.floor(Number(delta) || 0);
      stock.qtyOnHand = Math.max(0, (stock.qtyOnHand || 0) + d);
    }
    if (qtyOnHand !== undefined) {
      const q = Math.floor(Number(qtyOnHand) || 0);
      stock.qtyOnHand = Math.max(0, q);
    }
    if (sku !== undefined)
      stock.sku = sku ? String(sku).trim().toUpperCase() : undefined;
    if (isActive !== undefined) stock.isActive = !!isActive;
    if (note !== undefined) stock.note = String(note);

    await stock.save();
    const populated = await stock.populate([
      { path: "owner", model: stock.ownerModel },
      { path: "components.product", model: "Product" },
    ]);
    res.json({ stock: populated });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.sku)
      return res.status(400).json({ message: "SKU already exists" });
    res.status(400).json({ message: err.message || "Update failed" });
  }
}

/** DELETE /api/stocks/:id */
export async function deleteStock(req, res) {
  try {
    const { id } = req.params;
    const stock = await StockItem.findById(id);
    if (!stock) return res.status(404).json({ message: "Stock not found" });
    await stock.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || "Delete failed" });
  }
}

/** PUT /api/stocks/sync  — replace-mode: owner’ın tüm satırlarını gelen listeyle senkronlar */
export async function syncOwnerStocks(req, res) {
  try {
    const { ownerModel, owner, rows = [] } = req.body || {};
    await assertOwner(ownerModel, owner);

    await StockItem.deleteMany({ ownerModel, owner });

    const docs = rows.map((r) => ({
      ownerModel,
      owner,
      color: ownerModel === "Product" ? norm(r.color) : null,
      size: ownerModel === "Product" ? norm(r.size) : null,
      attributeValue: ownerModel === "Product" ? norm(r.attributeValue) : null,
      components: ownerModel === "Set" ? normalizeComponents(r.components) : [],
      qtyOnHand: Math.max(0, Math.floor(Number(r.qtyOnHand) || 0)),
      sku: r.sku ? String(r.sku).trim().toUpperCase() : undefined,
      isActive: r.isActive === undefined ? true : !!r.isActive,
      note: r.note ?? "",
      // comboKey & sku pre-hooks
    }));
    const inserted = await StockItem.create(docs);
    res.json({
      ok: true,
      count: Array.isArray(inserted) ? inserted.length : 0,
    });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.sku)
      return res.status(400).json({ message: "SKU already exists" });
    const status = /ownerModel|valid ObjectId|not found/.test(err.message)
      ? 400
      : 500;
    res.status(status).json({ message: err.message || "Sync failed" });
  }
}

/** GET /api/stocks/summary?ownerModel=Product|Set&owner=<id> */
export async function getStockSummary(req, res) {
  try {
    const ownerModel = String(req.query.ownerModel || "Product");
    const owner = String(req.query.owner || "");
    if (!["Product", "Set"].includes(ownerModel))
      return res
        .status(400)
        .json({ message: "ownerModel must be Product or Set" });
    if (!isId(owner))
      return res.status(400).json({ message: "owner is not a valid ObjectId" });

    const [{ total = 0 } = {}] = await StockItem.aggregate([
      {
        $match: {
          ownerModel,
          owner: new mongoose.Types.ObjectId(owner),
          isActive: true,
        },
      },
      {
        $group: { _id: null, total: { $sum: { $ifNull: ["$qtyOnHand", 0] } } },
      },
      { $project: { _id: 0, total: 1 } },
    ]);

    res.json({ ownerModel, owner, total });
  } catch (err) {
    res.status(500).json({ message: err.message || "Summary failed" });
  }
}
