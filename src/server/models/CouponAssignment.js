import mongoose from "mongoose";

const CouponAssignmentSchema = new mongoose.Schema(
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
    code: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    active: { type: Boolean, default: true, index: true },
    uses: { type: Number, default: 0, min: 0 },
    lastUsedAt: { type: Date, default: null },
    lastOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    source: {
      type: String,
      enum: ["template_auto", "template_manual", "admin_manual"],
      default: "template_auto",
    },
  },
  { timestamps: true }
);

CouponAssignmentSchema.index({ coupon: 1, user: 1 }, { unique: true });

export default mongoose.models["CouponAssignment"] ||
  mongoose.model("CouponAssignment", CouponAssignmentSchema);
