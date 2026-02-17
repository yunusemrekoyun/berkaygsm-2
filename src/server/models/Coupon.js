import mongoose from "mongoose";

const CouponTargetsSchema = new mongoose.Schema(
  {
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    sets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Set" }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
  },
  { _id: false }
);

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      trim: true,
    },
    template: {
      type: String,
      enum: [
        "first_purchase",
        "cart_threshold",
        "category_specific",
        "winback",
        "manual",
      ],
      default: "manual",
      index: true,
    },
    audience: {
      type: String,
      enum: ["public", "personal"],
      default: "public",
      index: true,
    },
    assignmentMode: {
      type: String,
      enum: ["everyone", "manual"],
      default: "everyone",
    },
    autoAssignNewUsers: { type: Boolean, default: false },
    manualUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    description: { type: String, default: "" },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    minSubtotal: { type: Number, default: 0 },
    maxTotalUses: { type: Number, default: null, min: 1 },
    maxUsesPerUser: { type: Number, default: 1, min: 1 },
    totalUses: { type: Number, default: 0, min: 0 },
    firstPurchaseOnly: { type: Boolean, default: false },
    winbackDays: { type: Number, default: null, min: 1 },
    targets: { type: CouponTargetsSchema, default: () => ({}) },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CouponSchema.index({ active: 1 });
CouponSchema.index({ active: 1, audience: 1, template: 1 });
CouponSchema.index(
  { code: 1 },
  {
    unique: true,
    partialFilterExpression: { code: { $type: "string" } },
  }
);

export default mongoose.models["Coupon"] || mongoose.model("Coupon", CouponSchema);
