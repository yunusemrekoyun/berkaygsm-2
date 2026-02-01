import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: Number,
    height: Number,
    format: String,
  },
  { _id: false }
);

const CampaignTranslationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    description: { type: String, trim: true },
    badge: { type: String, trim: true },
    ctaText: { type: String, trim: true },
  },
  { _id: false }
);

const CampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    badge: { type: String, default: "" },
    ctaText: { type: String, default: "" },
    layout: {
      type: String,
      enum: ["BIG", "WIDE", "SMALL"],
      default: "SMALL",
    },
    image: { type: MediaSchema, required: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    target: {
      type: {
        type: String,
        enum: ["PRODUCTS", "SETS"],
        required: true,
        default: "PRODUCTS",
      },
      products: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
        default: [],
      },
      sets: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Set" }],
        default: [],
      },
      categories: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
        default: [],
      },
      discounts: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Discount" }],
        default: [],
      },
    },
    translations: {
      type: new mongoose.Schema(
        {
          tr: { type: CampaignTranslationSchema, default: () => ({}) },
          en: { type: CampaignTranslationSchema, default: () => ({}) },
          de: { type: CampaignTranslationSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      default: () => ({ tr: {} }),
    },
  },
  { timestamps: true }
);

export default mongoose.model("Campaign", CampaignSchema);
