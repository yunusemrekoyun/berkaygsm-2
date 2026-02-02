import mongoose from "mongoose";

const StockSetComponentSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, min: 1, default: 1 },
    color: { type: String, default: null },
    size: { type: String, default: null },
    attributeValue: { type: String, default: null },
  },
  { _id: false }
);

const StockItemSchema = new mongoose.Schema(
  {
    ownerModel: { type: String, enum: ["Product", "Set"], required: true },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "ownerModel",
      required: true,
    },

    color: { type: String, default: null },
    size: { type: String, default: null },
    attributeValue: { type: String, default: null },

    components: { type: [StockSetComponentSchema], default: [] },

    comboKey: { type: String, required: true },

    sku: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },

    qtyOnHand: { type: Number, min: 0, default: 0 },

    isActive: { type: Boolean, default: true },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

function norm(v) {
  if (v == null) return "";
  return String(v).trim().toLowerCase();
}
function buildComboKeyForProduct(doc) {
  return `p|${norm(doc.color)}|${norm(doc.size)}|${norm(doc.attributeValue)}`;
}
function buildComboKeyForSet(doc) {
  const parts = (doc.components || []).map((c) => {
    const pid = c.product?.toString?.() || String(c.product || "");
    return [
      pid,
      Number.isFinite(c.quantity) && c.quantity > 0 ? c.quantity : 1,
      norm(c.color),
      norm(c.size),
      norm(c.attributeValue),
    ].join(":");
  });
  return `s|${parts.join("|")}`;
}
function makeSku(doc) {
  const ownerPrefix = doc.ownerModel === "Set" ? "S" : "P";
  const base = `${ownerPrefix}-${(doc.comboKey || "")
    .replace(/[^a-z0-9|:]/gi, "-")
    .slice(0, 18)
    .toUpperCase()}`;
  const tail = (
    doc._id?.toString?.().slice(-5) || Math.random().toString(36).slice(-5)
  ).toUpperCase();
  return `AYY-${base}-${tail}`;
}

StockItemSchema.index(
  { ownerModel: 1, owner: 1, comboKey: 1 },
  { unique: true }
);
StockItemSchema.index({ ownerModel: 1, owner: 1 });
StockItemSchema.index({ isActive: 1, updatedAt: -1 });

StockItemSchema.pre("validate", function (next) {
  if (!this.comboKey || !this.comboKey.trim()) {
    this.comboKey =
      this.ownerModel === "Set"
        ? buildComboKeyForSet(this)
        : buildComboKeyForProduct(this);
  }
  next();
});

StockItemSchema.pre("save", function (next) {
  if (!this.sku || !this.sku.trim()) this.sku = makeSku(this);
  next();
});

export default mongoose.models["StockItem"] || mongoose.model("StockItem", StockItemSchema);
