import mongoose from "mongoose";

const VariantSchema = new mongoose.Schema(
  {
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
  },
  { _id: false }
);

const SelectionSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
    qtyInSet: { type: Number, min: 1, default: 1 },
  },
  { _id: false }
);

const PayloadItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["product", "set"], required: true },
    id: { type: String, required: true },
    qty: { type: Number, min: 1, required: true },
    variant: { type: VariantSchema, default: null },
    selections: { type: [SelectionSchema], default: [] },
  },
  { _id: false }
);

const PayloadSchema = new mongoose.Schema(
  {
    addressId: { type: String, required: true },
    items: { type: [PayloadItemSchema], default: [] },
    couponCode: { type: String, default: null },
  },
  { _id: false }
);

const AddressSnapshotSchema = new mongoose.Schema(
  {
    fullName: String,
    phone: String,
    country: String,
    city: String,
    district: String,
    postalCode: String,
    addressLine: String,
  },
  { _id: false }
);

const SummarySchema = new mongoose.Schema(
  {
    subtotal: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    shippingName: { type: String, default: "Standart Kargo" },
    total: { type: Number, default: 0 },
    currency: { type: String, default: "TRY" },
  },
  { _id: false }
);

const PayPalCheckoutSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    paypalOrderId: { type: String, required: true },
    payload: { type: PayloadSchema, required: true },
    addressSnapshot: { type: AddressSnapshotSchema, required: true },
    summary: { type: SummarySchema, required: true },
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled", "expired"],
      default: "pending",
      index: true,
    },
    approveUrl: { type: String, default: null },
    completedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    completedAt: { type: Date, default: null },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 1000 * 60 * 30),
    },
  },
  { timestamps: true }
);

PayPalCheckoutSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PayPalCheckoutSchema.index({ paypalOrderId: 1 }, { unique: true });

export default mongoose.models["PayPalCheckout"] || mongoose.model("PayPalCheckout", PayPalCheckoutSchema);
