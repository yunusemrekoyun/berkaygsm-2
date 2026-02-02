import mongoose from "mongoose";

const ShippingConfigTranslationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
  },
  { _id: false }
);

const ShippingConfigSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Standard Shipping" },
    fee: { type: Number, default: 0 },
    freeThreshold: { type: Number, default: 0 },
    translations: {
      type: new mongoose.Schema(
        {
          tr: { type: ShippingConfigTranslationSchema, default: () => ({}) },
          en: { type: ShippingConfigTranslationSchema, default: () => ({}) },
          de: { type: ShippingConfigTranslationSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      default: () => ({ tr: {} }),
    },
  },
  { timestamps: true }
);

ShippingConfigSchema.statics.getSingleton = async function () {
  const existing = await this.findOne();
  if (existing) return existing;
  return this.create({});
};

export default mongoose.models["ShippingConfig"] || mongoose.model("ShippingConfig", ShippingConfigSchema);
