import mongoose from "mongoose";

const CouponConfigSchema = new mongoose.Schema(
  {
    singleton: {
      type: String,
      default: "coupon_config",
      unique: true,
      index: true,
    },
    cartInputVisible: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

CouponConfigSchema.statics.getSingleton = async function () {
  const existing = await this.findOne({ singleton: "coupon_config" });
  if (existing) return existing;
  return this.create({ singleton: "coupon_config" });
};

export default mongoose.models["CouponConfig"] ||
  mongoose.model("CouponConfig", CouponConfigSchema);
