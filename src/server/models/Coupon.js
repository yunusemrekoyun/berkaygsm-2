import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: "" },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    minSubtotal: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

CouponSchema.index({ active: 1 });

export default mongoose.models["Coupon"] || mongoose.model("Coupon", CouponSchema);
