import mongoose from "mongoose";

const SectionSchema = new mongoose.Schema({
  title: { type: String, default: "" },
  paragraphs: { type: [String], default: [] },
});

const SectionTranslationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    paragraphs: { type: [String], default: undefined },
  },
  { _id: false }
);

const SeoTranslationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    keywords: { type: [String], default: undefined },
  },
  { _id: false }
);

const TermsTranslationSchema = new mongoose.Schema(
  {
    heroTitle: { type: String, trim: true },
    heroIntro: { type: String, trim: true },
    sections: { type: [SectionTranslationSchema], default: undefined },
    footerNote: { type: String, trim: true },
    seo: { type: SeoTranslationSchema, default: undefined },
  },
  { _id: false }
);

const TermsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "terms", unique: true, index: true },
    heroTitle: { type: String, default: "Terms of Service" },
    heroIntro: { type: String, default: "" },
    sections: { type: [SectionSchema], default: [] },
    footerNote: { type: String, default: "" }, // ← ÖNEMLİ
    isActive: { type: Boolean, default: true },
    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      keywords: { type: [String], default: [] },
    },
    translations: {
      type: new mongoose.Schema(
        {
          tr: { type: TermsTranslationSchema, default: () => ({}) },
          en: { type: TermsTranslationSchema, default: () => ({}) },
          de: { type: TermsTranslationSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      default: () => ({ tr: {} }),
    },
  },
  { timestamps: true }
);

export default mongoose.models["Terms"] || mongoose.model("Terms", TermsSchema);
