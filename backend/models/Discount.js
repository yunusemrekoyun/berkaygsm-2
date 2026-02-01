import mongoose from "mongoose";

const DiscountTranslationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const DiscountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    appliesTo: {
      products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
      sets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Set" }],
      categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    translations: {
      type: new mongoose.Schema(
        {
          tr: { type: DiscountTranslationSchema, default: () => ({}) },
          en: { type: DiscountTranslationSchema, default: () => ({}) },
          de: { type: DiscountTranslationSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      default: () => ({ tr: {} }),
    },
  },
  { timestamps: true }
);

DiscountSchema.index({ active: 1, "appliesTo.products": 1 });
DiscountSchema.index({ active: 1, "appliesTo.sets": 1 });
DiscountSchema.index({ active: 1, "appliesTo.categories": 1 });

export default mongoose.model("Discount", DiscountSchema);
