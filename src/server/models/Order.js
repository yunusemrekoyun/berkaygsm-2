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

const OrderItemStandardDiscountSchema = new mongoose.Schema(
  {
    discountId: { type: mongoose.Schema.Types.ObjectId, ref: "Discount", default: null },
    name: { type: String, default: "" },
    percentage: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    removedBy: {
      type: String,
      enum: ["stacked", "coupon", null],
      default: null,
    },
  },
  { _id: false }
);

const OrderItemStackedDiscountSchema = new mongoose.Schema(
  {
    stackedDiscountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StackedDiscount",
      default: null,
    },
    percentage: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    disabledByCoupon: { type: Boolean, default: false },
  },
  { _id: false }
);

const OrderItemCouponDiscountSchema = new mongoose.Schema(
  {
    code: { type: String, default: null },
    percentage: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const OrderItemPricingSchema = new mongoose.Schema(
  {
    baseUnitPrice: { type: Number, default: 0 },
    standard: { type: OrderItemStandardDiscountSchema, default: null },
    stacked: { type: OrderItemStackedDiscountSchema, default: null },
    coupon: { type: OrderItemCouponDiscountSchema, default: null },
  },
  { _id: false }
);

const OrderStockUsageSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    color: { type: String, default: null },
    size: { type: String, default: null },
    attribute: { type: String, default: null },
    qty: { type: Number, min: 1, default: 1 },
    source: {
      type: String,
      enum: ["product", "set_selection"],
      default: "product",
    },
    productName: { type: String, default: "" },
    image: { type: String, default: "" },
  },
  { _id: false }
);

const OrderItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["product", "set"], required: true }, // ürün mü set mi
    ref: { type: mongoose.Schema.Types.ObjectId, required: true }, // Product|Set _id
    name: { type: String, required: true }, // isim snapshot
    unitPrice: { type: Number, required: true }, // fiyat snapshot
    originalUnitPrice: { type: Number, default: 0 },
    qty: { type: Number, min: 1, default: 1 },
    image: { type: String, default: "" }, // küçük görsel (opsiyonel)
    variant: { type: VariantSnapshotSchema, default: null },
    pricing: { type: OrderItemPricingSchema, default: null },
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
    providerPayerId: { type: String, default: null },
    countryCode: { type: String, default: null },
  },
  { _id: false }
);

const PaymentSchema = new mongoose.Schema(
  {
    method: { type: String, default: "online" }, // ödeme şekli
    provider: { type: String, default: null },
    txnId: { type: String, default: "" },
    processorOrderId: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "refunded"],
      default: "pending",
    },
    currency: { type: String, default: null },
    amount: { type: Number, default: 0 },
    payer: { type: PayerSchema, default: null },
  },
  { _id: false }
);

const OrderStackedPricingSchema = new mongoose.Schema(
  {
    stackedDiscountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StackedDiscount",
      default: null,
    },
    quantity: { type: Number, default: 0 },
    eligibleQuantity: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    eligibleSubtotal: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    allowCouponStacking: { type: Boolean, default: true },
    allowDiscountStacking: { type: Boolean, default: true },
    disabledByCoupon: { type: Boolean, default: false },
  },
  { _id: false }
);

const OrderPricingSchema = new mongoose.Schema(
  {
    baseSubtotal: { type: Number, default: 0 },
    standardDiscountAmount: { type: Number, default: 0 },
    stackedDiscountAmount: { type: Number, default: 0 },
    couponDiscountAmount: { type: Number, default: 0 },
    stacked: { type: OrderStackedPricingSchema, default: null },
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
    note: { type: String, default: "" },

    subtotal: { type: Number, required: true },
    shipping: { type: Number, required: true, default: 0 },
    shippingName: { type: String, default: "Standart Kargo" },
    total: { type: Number, required: true },

    coupon: {
      couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
        default: null,
      },
      assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CouponAssignment",
        default: null,
      },
      code: { type: String, default: null },
      template: { type: String, default: null },
      audience: { type: String, default: null },
      percentage: { type: Number, default: 0 },
      minSubtotal: { type: Number, default: 0 },
      eligibleSubtotal: { type: Number, default: 0 },
      discountAmount: { type: Number, default: 0 },
    },

    status: {
      type: String,
      enum: ["pending", "paid", "shipped", "completed", "cancelled"],
      default: "pending",
      index: true,
    },

    payment: { type: PaymentSchema, default: () => ({}) },
    pricing: { type: OrderPricingSchema, default: null },
    accounting: {
      stockApplied: { type: Boolean, default: false },
      couponConsumed: { type: Boolean, default: false },
      stockUsage: { type: [OrderStockUsageSchema], default: [] },
      accountedAt: { type: Date, default: null },
      revertedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

export default mongoose.models["Order"] || mongoose.model("Order", OrderSchema);
