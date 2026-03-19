import mongoose from "mongoose";

const VariantSnapshotSchema = new mongoose.Schema(
  {
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
  },
  { _id: false }
);

const SelectionSnapshotSchema = new mongoose.Schema(
  {
    productId: { type: String, default: "" },
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
    qtyInSet: { type: Number, default: 1 },
  },
  { _id: false }
);

const ItemSnapshotSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["product", "set"], required: true },
    ref: { type: String, default: "" },
    name: { type: String, required: true },
    unitPrice: { type: Number, default: 0 },
    qty: { type: Number, default: 1 },
    image: { type: String, default: "" },
    variant: { type: VariantSnapshotSchema, default: null },
    selections: { type: [SelectionSnapshotSchema], default: [] },
  },
  { _id: false }
);

const AddressSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, default: "" },
    phone: { type: String, default: "" },
    country: { type: String, default: "" },
    city: { type: String, default: "" },
    district: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    addressLine: { type: String, default: "" },
  },
  { _id: false }
);

const UserSnapshotSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
  },
  { _id: false }
);

const SnapshotSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true },
    createdAt: { type: Date, default: null },
    note: { type: String, default: "" },
    user: { type: UserSnapshotSchema, default: null },
    address: { type: AddressSnapshotSchema, required: true },
    items: { type: [ItemSnapshotSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    coupon: {
      code: { type: String, default: null },
      percentage: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
    },
    pricing: {
      baseSubtotal: { type: Number, default: 0 },
      standardDiscountAmount: { type: Number, default: 0 },
      stackedDiscountAmount: { type: Number, default: 0 },
      couponDiscountAmount: { type: Number, default: 0 },
      stacked: {
        percentage: { type: Number, default: 0 },
        quantity: { type: Number, default: 0 },
      },
    },
    shipping: { type: Number, default: 0 },
    shippingName: { type: String, default: "Standart Kargo" },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const LastErrorSchema = new mongoose.Schema(
  {
    message: { type: String, default: "" },
    at: { type: Date, default: null },
  },
  { _id: false }
);

const PrintJobSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    orderNumber: { type: String, required: true, index: true },
    template: {
      type: String,
      default: "order_label_100x150",
      index: true,
    },
    source: {
      type: String,
      enum: ["order_paid", "manual_requeue"],
      default: "order_paid",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "printed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    printer: { type: String, default: "" },
    claimedBy: { type: String, default: "" },
    claimedAt: { type: Date, default: null },
    printedAt: { type: Date, default: null },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lastError: { type: LastErrorSchema, default: null },
    snapshot: { type: SnapshotSchema, required: true },
    requestedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

PrintJobSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });

export default mongoose.models["PrintJob"] ||
  mongoose.model("PrintJob", PrintJobSchema);
