import mongoose from "mongoose";

const SetSelectionSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
    qtyInSet: { type: Number, min: 1, default: 1 },
  },
  { _id: false }
);

const VariantSnapshotSchema = new mongoose.Schema(
  {
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
  },
  { _id: false }
);

const OrderItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["product", "set"], required: true }, // ürün mü set mi
    ref: { type: mongoose.Schema.Types.ObjectId, required: true }, // Product|Set _id
    name: { type: String, required: true }, // isim snapshot
    unitPrice: { type: Number, required: true }, // fiyat snapshot
    qty: { type: Number, min: 1, default: 1 },
    image: { type: String, default: "" }, // küçük görsel (opsiyonel)
    variant: { type: VariantSnapshotSchema, default: null },
    // sadece kind === 'set' için anlamlı
    selections: { type: [SetSelectionSchema], default: [] },
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

const PayerSchema = new mongoose.Schema(
  {
    email: { type: String, default: null },
    name: { type: String, default: null },
    paypalId: { type: String, default: null },
    countryCode: { type: String, default: null },
  },
  { _id: false }
);

const PaymentSchema = new mongoose.Schema(
  {
    method: { type: String, default: "cod" }, // ödeme şekli
    txnId: { type: String, default: "" },
    processorOrderId: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "refunded"],
      default: "pending",
    },
    simulation: {
      type: String,
      enum: ["success", "failure", null],
      default: null,
    },
    currency: { type: String, default: null },
    amount: { type: Number, default: 0 },
    payer: { type: PayerSchema, default: null },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, index: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },

    items: { type: [OrderItemSchema], default: [] },

    address: { type: AddressSnapshotSchema, required: true },

    subtotal: { type: Number, required: true },
    shipping: { type: Number, required: true, default: 0 },
    shippingName: { type: String, default: "Standart Kargo" },
    total: { type: Number, required: true },

    coupon: {
      code: { type: String, default: null },
      percentage: { type: Number, default: 0 },
      minSubtotal: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
    },

    status: {
      type: String,
      enum: ["pending", "paid", "shipped", "completed", "cancelled"],
      default: "pending",
      index: true,
    },

    payment: { type: PaymentSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.models["Order"] || mongoose.model("Order", OrderSchema);
