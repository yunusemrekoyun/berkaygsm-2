import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },
    set: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Set",
      default: null,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: { type: String, default: "", trim: true },
    body: { type: String, default: "", trim: true },

    approved: { type: Boolean, default: false, index: true },
    approvedAt: { type: Date, default: null },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

ReviewSchema.pre("validate", function (next) {
  const hasProduct = Boolean(this.product);
  const hasSet = Boolean(this.set);
  if (!hasProduct && !hasSet) {
    return next(new Error("Review must reference a product or set"));
  }
  if (hasProduct && hasSet) {
    return next(new Error("Review cannot reference both product and set"));
  }
  return next();
});

// aynı kullanıcı aynı ürüne / sete yalnızca 1 yorum
ReviewSchema.index(
  { product: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: { product: { $type: "objectId" } },
  }
);
ReviewSchema.index(
  { set: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: { set: { $type: "objectId" } },
  }
);

export default mongoose.model("Review", ReviewSchema);
