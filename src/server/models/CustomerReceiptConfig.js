import mongoose from "mongoose";
import { DEFAULT_CUSTOMER_RECEIPT_CONFIG } from "../../shared/customerReceiptConfig.js";

const CustomerReceiptConfigSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "customer_receipt_config", unique: true },
    slogan: {
      type: String,
      trim: true,
      default: DEFAULT_CUSTOMER_RECEIPT_CONFIG.slogan,
    },
    message: {
      type: String,
      trim: true,
      default: DEFAULT_CUSTOMER_RECEIPT_CONFIG.message,
    },
    instagramUrl: {
      type: String,
      trim: true,
      default: DEFAULT_CUSTOMER_RECEIPT_CONFIG.instagramUrl,
    },
    tiktokUrl: {
      type: String,
      trim: true,
      default: DEFAULT_CUSTOMER_RECEIPT_CONFIG.tiktokUrl,
    },
  },
  { timestamps: true }
);

CustomerReceiptConfigSchema.statics.getSingleton = async function () {
  const existing = await this.findOne({ singleton: "customer_receipt_config" });
  if (existing) return existing;
  return this.create({ singleton: "customer_receipt_config" });
};

export default mongoose.models["CustomerReceiptConfig"] ||
  mongoose.model("CustomerReceiptConfig", CustomerReceiptConfigSchema);
