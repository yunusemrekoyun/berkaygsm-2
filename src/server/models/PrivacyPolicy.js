import mongoose from "mongoose";

const SectionSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    title: { type: String, default: "" },
    content: { type: [String], default: [] },
  },
  { _id: false }
);

const SectionTranslationSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    title: { type: String, trim: true },
    content: { type: [String], default: undefined },
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

const PrivacyPolicyTranslationSchema = new mongoose.Schema(
  {
    heroTitle: { type: String, trim: true },
    heroIntro: { type: String, trim: true },
    sections: { type: [SectionTranslationSchema], default: undefined },
    footerHtml: { type: String, trim: true },
    seo: { type: SeoTranslationSchema, default: undefined },
  },
  { _id: false }
);

const PrivacyPolicySchema = new mongoose.Schema(
  {
    singleton: { type: String, unique: true, default: "privacy_policy" },
    heroTitle: { type: String, default: "Gizlilik Politikası" },
    heroIntro: { type: String, default: "" },
    sections: { type: [SectionSchema], default: [] },
    footerHtml: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    seo: {
      title: { type: String, default: "" },
      description: { type: String, default: "" },
      keywords: { type: [String], default: [] },
    },
    translations: {
      type: new mongoose.Schema(
        {
          tr: { type: PrivacyPolicyTranslationSchema, default: () => ({}) },
          en: { type: PrivacyPolicyTranslationSchema, default: () => ({}) },
          de: { type: PrivacyPolicyTranslationSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      default: () => ({ tr: {} }),
    },
  },
  { timestamps: true }
);

export default mongoose.models["PrivacyPolicy"] || mongoose.model("PrivacyPolicy", PrivacyPolicySchema);
