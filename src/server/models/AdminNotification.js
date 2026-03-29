import mongoose from "mongoose";

const AdminNotificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["low_stock", "review_pending"],
      required: true,
      index: true,
    },
    ownerModel: {
      type: String,
      enum: ["Product", "Set"],
      default: "Product",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "ownerModel",
      required: true,
      index: true,
    },
    stockItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockItem",
      default: null,
    },
    comboKey: { type: String, default: "", trim: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    data: {
      productName: { type: String, default: "" },
      productSlug: { type: String, default: "" },
      image: { type: String, default: "" },
      color: { type: String, default: null },
      size: { type: String, default: null },
      attributeValue: { type: String, default: null },
      variantLabel: { type: String, default: "" },
      previousQty: { type: Number, default: 0 },
      qtyOnHand: { type: Number, default: 0 },
      threshold: { type: Number, default: 3 },
      targetType: { type: String, default: "" },
      targetName: { type: String, default: "" },
      targetSlug: { type: String, default: "" },
      reviewId: { type: String, default: "" },
      reviewerName: { type: String, default: "" },
      reviewerEmail: { type: String, default: "" },
      rating: { type: Number, default: 0 },
      reviewTitle: { type: String, default: "" },
      reviewBody: { type: String, default: "" },
    },
    readAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

AdminNotificationSchema.index({ createdAt: -1 });
AdminNotificationSchema.index({
  type: 1,
  ownerModel: 1,
  owner: 1,
  comboKey: 1,
  readAt: 1,
});

export default (
  mongoose.models["AdminNotification"] ||
  mongoose.model("AdminNotification", AdminNotificationSchema)
);
