import mongoose from "mongoose";

const StackedDiscountTierSchema = new mongoose.Schema(
  {
    quantity: { type: Number, required: true, min: 2 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const StackedDiscountSchema = new mongoose.Schema(
  {
    singleton: {
      type: String,
      default: "stacked_discount",
      unique: true,
      index: true,
    },
    active: { type: Boolean, default: false },
    allowCouponStacking: { type: Boolean, default: true },
    allowDiscountStacking: { type: Boolean, default: true },
    targets: {
      products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      sets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Set" }],
      categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    },
    tiers: { type: [StackedDiscountTierSchema], default: [] },
  },
  { timestamps: true }
);

StackedDiscountSchema.statics.getSingleton = async function () {
  const existing = await this.findOne({ singleton: "stacked_discount" });
  if (existing) return existing;
  return this.create({ singleton: "stacked_discount" });
};

export default mongoose.models["StackedDiscount"] ||
  mongoose.model("StackedDiscount", StackedDiscountSchema);
