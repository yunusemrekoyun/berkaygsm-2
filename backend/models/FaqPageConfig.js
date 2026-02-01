// backend/models/FaqPageConfig.js
import mongoose from "mongoose";

const FaqItemSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { _id: true }
);

const FaqSectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: "", trim: true },
    sortOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    items: { type: [FaqItemSchema], default: [] },
  },
  { _id: true }
);

const SeoSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    keywords: { type: [String], default: [] },
  },
  { _id: false }
);

/**
 * 🔧 ÇEVİRİ ŞEMALARI
 * Burada _id'leri ObjectId değil STRING tutuyoruz.
 * Sebep: frontend, yeni eklenen section/item'lar için section_0, section_0_item_0 gibi
 * pseudo id'ler gönderiyor. Bunlar ObjectId olmadığı için cast hatasına sebep oluyordu.
 */

const FaqItemTranslationSchema = new mongoose.Schema(
  {
    _id: { type: String }, // ✅ ObjectId yerine String
    question: { type: String, trim: true },
    answer: { type: String, trim: true },
  },
  { _id: false }
);

const FaqSectionTranslationSchema = new mongoose.Schema(
  {
    _id: { type: String }, // ✅ ObjectId yerine String
    title: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    items: { type: [FaqItemTranslationSchema], default: undefined },
  },
  { _id: false }
);

const FaqSeoTranslationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    keywords: { type: [String], default: undefined },
  },
  { _id: false }
);

const FaqPageTranslationSchema = new mongoose.Schema(
  {
    heroTitle: { type: String, trim: true },
    heroIntro: { type: String, trim: true },
    sections: { type: [FaqSectionTranslationSchema], default: undefined },
    seo: { type: FaqSeoTranslationSchema, default: undefined },
  },
  { _id: false }
);

// Tek belge konfig
const FaqPageConfigSchema = new mongoose.Schema(
  {
    heroTitle: {
      type: String,
      default: "Frequently Asked Questions",
      trim: true,
    },
    heroIntro: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true, index: true },

    // Bölümler
    sections: { type: [FaqSectionSchema], default: [] },

    // SEO
    seo: { type: SeoSchema, default: () => ({}) },

    // Audit
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // 🔤 Çeviriler
    translations: {
      type: new mongoose.Schema(
        {
          tr: { type: FaqPageTranslationSchema, default: () => ({}) },
          en: { type: FaqPageTranslationSchema, default: () => ({}) },
          de: { type: FaqPageTranslationSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      default: () => ({ tr: {} }),
    },
  },
  { timestamps: true }
);

// İsteğe bağlı indexler
FaqPageConfigSchema.index({ isActive: 1, updatedAt: -1 });

export default mongoose.models["FaqPageConfig"] || mongoose.model("FaqPageConfig", FaqPageConfigSchema);
