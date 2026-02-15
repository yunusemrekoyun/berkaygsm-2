import mongoose from "mongoose";

const CouponRedemptionSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    uses: { type: Number, default: 0, min: 0 },
    lastUsedAt: { type: Date, default: null },
    lastOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
  },
  { timestamps: true }
);

CouponRedemptionSchema.index({ coupon: 1, user: 1 }, { unique: true });

export default mongoose.models["CouponRedemption"] ||
  mongoose.model("CouponRedemption", CouponRedemptionSchema);
