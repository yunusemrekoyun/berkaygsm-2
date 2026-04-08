import mongoose from "mongoose";

const SessionSelectionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
    qtyInSet: { type: Number, min: 1, default: 1 },
  },
  { _id: false }
);

const SessionVariantSchema = new mongoose.Schema(
  {
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
  },
  { _id: false }
);

const SessionItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["product", "set"], required: true },
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    qty: { type: Number, min: 1, default: 1 },
    variant: { type: SessionVariantSchema, default: null },
    selections: { type: [SessionSelectionSchema], default: [] },
  },
  { _id: false }
);

const SessionAddressSchema = new mongoose.Schema(
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

const SessionPricingSchema = new mongoose.Schema(
  {
    currency: { type: String, default: "TRY" },
    subtotal: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const SessionPaymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, default: "" },
    paymentStatus: { type: String, default: "" },
    fraudStatus: { type: Number, default: null },
    installment: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
    paidPrice: { type: Number, default: 0 },
    cardType: { type: String, default: "" },
    cardAssociation: { type: String, default: "" },
    cardFamily: { type: String, default: "" },
    binNumber: { type: String, default: "" },
    lastFourDigits: { type: String, default: "" },
    authCode: { type: String, default: "" },
    hostReference: { type: String, default: "" },
  },
  { _id: false }
);

const SessionErrorSchema = new mongoose.Schema(
  {
    phase: { type: String, default: "" },
    code: { type: String, default: "" },
    message: { type: String, default: "" },
  },
  { _id: false }
);

const PaymentSessionSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["iyzico"], default: "iyzico" },
    mode: { type: String, enum: ["sandbox", "live"], default: "sandbox" },
    status: {
      type: String,
      enum: [
        "initialized",
        "callback_received",
        "webhook_received",
        "success",
        "failed",
        "manual_review",
        "expired",
      ],
      default: "initialized",
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    basketId: { type: String, required: true, trim: true },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    checkoutUrl: { type: String, required: true, trim: true },
    addressSnapshot: { type: SessionAddressSchema, required: true },
    items: { type: [SessionItemSchema], default: [] },
    couponCode: { type: String, default: null },
    note: { type: String, default: "" },
    pricing: { type: SessionPricingSchema, default: () => ({}) },
    payment: { type: SessionPaymentSchema, default: () => ({}) },
    callbackAt: { type: Date, default: null },
    webhookAt: { type: Date, default: null },
    finalizedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null, index: true },
    lastError: { type: SessionErrorSchema, default: null },
  },
  { timestamps: true }
);

PaymentSessionSchema.index({ createdAt: -1 });

export default mongoose.models.PaymentSession ||
  mongoose.model("PaymentSession", PaymentSessionSchema);
