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
    productName: { type: String, default: "" },
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
    qtyInSet: { type: Number, default: 1 },
  },
  { _id: false }
);

const ItemPricingSnapshotSchema = new mongoose.Schema(
  {
    baseUnitPrice: { type: Number, default: 0 },
    standard: {
      discountId: { type: String, default: null },
      name: { type: String, default: "" },
      percentage: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      removedBy: { type: String, default: null },
    },
    stacked: {
      stackedDiscountId: { type: String, default: null },
      percentage: { type: Number, default: 0 },
      quantity: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      disabledByCoupon: { type: Boolean, default: false },
    },
    coupon: {
      code: { type: String, default: null },
      percentage: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const ItemSnapshotSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["product", "set"], required: true },
    ref: { type: String, default: "" },
    name: { type: String, required: true },
    unitPrice: { type: Number, default: 0 },
    originalUnitPrice: { type: Number, default: 0 },
    qty: { type: Number, default: 1 },
    image: { type: String, default: "" },
    variant: { type: VariantSnapshotSchema, default: null },
    pricing: { type: ItemPricingSnapshotSchema, default: null },
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

const CustomerSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    isGuest: { type: Boolean, default: false },
  },
  { _id: false }
);

const PaymentSnapshotSchema = new mongoose.Schema(
  {
    method: { type: String, default: "" },
    provider: { type: String, default: null },
    status: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    currency: { type: String, default: "TRY" },
    amount: { type: Number, default: 0 },
    txnId: { type: String, default: "" },
  },
  { _id: false }
);

const StockUsageSnapshotSchema = new mongoose.Schema(
  {
    stockItemId: { type: String, default: "" },
    productId: { type: String, default: "" },
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
    qty: { type: Number, default: 1 },
    source: { type: String, default: "product" },
    sku: { type: String, default: "" },
    previousQtyOnHand: { type: Number, default: null },
    remainingQtyOnHand: { type: Number, default: null },
    productName: { type: String, default: "" },
    image: { type: String, default: "" },
  },
  { _id: false }
);

const SnapshotSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true },
    createdAt: { type: Date, default: null },
    note: { type: String, default: "" },
    status: { type: String, default: "pending" },
    customerEmail: { type: String, default: "" },
    user: { type: UserSnapshotSchema, default: null },
    customer: { type: CustomerSnapshotSchema, default: () => ({}) },
    address: { type: AddressSnapshotSchema, required: true },
    payment: { type: PaymentSnapshotSchema, default: () => ({}) },
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
    accounting: {
      stockApplied: { type: Boolean, default: false },
      couponConsumed: { type: Boolean, default: false },
      stockUsage: { type: [StockUsageSnapshotSchema], default: [] },
      accountedAt: { type: Date, default: null },
    },
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
      default: "customer_receipt_100x150",
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
