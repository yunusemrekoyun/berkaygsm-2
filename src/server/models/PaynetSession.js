import mongoose from "mongoose";

const PaynetSessionVariantSchema = new mongoose.Schema(
  {
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
  },
  { _id: false }
);

const PaynetSessionSelectionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
    qtyInSet: { type: Number, min: 1, default: 1 },
  },
  { _id: false }
);

const PaynetSessionItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["product", "set"], required: true },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    qty: { type: Number, min: 1, default: 1 },
    variant: { type: PaynetSessionVariantSchema, default: null },
    selections: { type: [PaynetSessionSelectionSchema], default: [] },
  },
  { _id: false }
);

const PaynetSessionAddressSchema = new mongoose.Schema(
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

const PaynetSessionCustomerSchema = new mongoose.Schema(
  {
    fullName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    isGuest: { type: Boolean, default: false },
  },
  { _id: false }
);

const PaynetSessionPricingSchema = new mongoose.Schema(
  {
    currency: { type: String, default: "TRY" },
    subtotal: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const PaynetSessionStockUsageSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
    qty: { type: Number, min: 1, default: 1 },
    source: { type: String, enum: ["product", "set_selection"], default: "product" },
    productName: { type: String, default: "" },
    image: { type: String, default: "" },
  },
  { _id: false }
);

const PaynetSessionStockReservationSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      enum: ["none", "reserved", "released", "committed"],
      default: "none",
    },
    entries: { type: [PaynetSessionStockUsageSchema], default: [] },
    reservedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    committedAt: { type: Date, default: null },
  },
  { _id: false }
);

const PaynetSessionErrorSchema = new mongoose.Schema(
  {
    phase: { type: String, default: "" },
    code: { type: String, default: "" },
    message: { type: String, default: "" },
  },
  { _id: false }
);

const ManualReviewNotificationSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      enum: ["pending", "sending", "sent"],
      default: "pending",
    },
    attemptCount: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
  },
  { _id: false }
);

const PaynetSessionSchema = new mongoose.Schema(
  {
    referanceNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    mode: {
      type: String,
      enum: ["sandbox", "live"],
      default: "live",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "callback_received",
        "success",
        "failed",
        "manual_review",
        "expired",
      ],
      default: "pending",
      index: true,
    },
    fingerprintKey: {
      type: String,
      default: null,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    customer: { type: PaynetSessionCustomerSchema, default: () => ({}) },
    identityNumber: { type: String, default: "11111111111" },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    paymentUrl: { type: String, default: null, trim: true },
    addressSnapshot: { type: PaynetSessionAddressSchema, required: true },
    items: { type: [PaynetSessionItemSchema], default: [] },
    couponCode: { type: String, default: null },
    note: { type: String, default: "" },
    pricing: { type: PaynetSessionPricingSchema, default: () => ({}) },
    stockReservation: {
      type: PaynetSessionStockReservationSchema,
      default: () => ({ state: "none", entries: [] }),
    },
    callbackData: { type: mongoose.Schema.Types.Mixed, default: null },
    callbackAt: { type: Date, default: null },
    finalizedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
    lastError: { type: PaynetSessionErrorSchema, default: null },
    manualReviewNotification: {
      type: ManualReviewNotificationSchema,
      default: null,
    },
  },
  { timestamps: true }
);

PaynetSessionSchema.index({ createdAt: -1 });
PaynetSessionSchema.index({ user: 1, status: 1, expiresAt: -1 });
PaynetSessionSchema.index(
  { fingerprintKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      fingerprintKey: { $type: "string" },
    },
  }
);

export default mongoose.models.PaynetSession ||
  mongoose.model("PaynetSession", PaynetSessionSchema);
