import mongoose from "mongoose";

const ListBlockSchema = new mongoose.Schema(
  {
    heading: { type: String, default: "" },
    items: { type: [String], default: [] },
  },
  { _id: false }
);

const SectionSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    paragraphs: { type: [String], default: [] }, // sıralı paragraflar
    list: { type: ListBlockSchema, default: () => ({}) }, // opsiyonel liste
  },
  { _id: false }
);

const SidebarContactSchema = new mongoose.Schema(
  {
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    hoursText: { type: String, default: "" }, // "Mon–Fri 09:00–17:00 CET" gibi
    note: { type: String, default: "" }, // kısa bilgilendirme kutusu metni
  },
  { _id: false }
);

const SeoSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    keywords: { type: [String], default: [] },
  },
  { _id: false }
);

const ListBlockTranslationSchema = new mongoose.Schema(
  {
    heading: { type: String, trim: true },
    items: { type: [String], default: undefined },
  },
  { _id: false }
);

const SectionTranslationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    paragraphs: { type: [String], default: undefined },
    list: { type: ListBlockTranslationSchema, default: undefined },
  },
  { _id: false }
);

const SidebarContactTranslationSchema = new mongoose.Schema(
  {
    hoursText: { type: String, trim: true },
    note: { type: String, trim: true },
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

const ShippingReturnsTranslationSchema = new mongoose.Schema(
  {
    heroTitle: { type: String, trim: true },
    heroIntro: { type: String, trim: true },
    sections: { type: [SectionTranslationSchema], default: undefined },
    quickFacts: { type: [String], default: undefined },
    sidebarContact: {
      type: SidebarContactTranslationSchema,
      default: undefined,
    },
    seo: { type: SeoTranslationSchema, default: undefined },
  },
  { _id: false }
);

const ShippingReturnsSchema = new mongoose.Schema(
  {
    // singleton kilidi
    singleton: {
      type: String,
      required: true,
      unique: true,
      default: "shipping_returns",
    },

    // hero
    heroTitle: { type: String, default: "Shipping & Returns" },
    heroIntro: { type: String, default: "" },

    // gövde
    sections: { type: [SectionSchema], default: [] },

    // sağ panel
    quickFacts: { type: [String], default: [] },
    sidebarContact: { type: SidebarContactSchema, default: () => ({}) },

    // durum/seo
    isActive: { type: Boolean, default: true, index: true },
    seo: { type: SeoSchema, default: () => ({}) },
    translations: {
      type: new mongoose.Schema(
        {
          tr: {
            type: ShippingReturnsTranslationSchema,
            default: () => ({}),
          },
          en: {
            type: ShippingReturnsTranslationSchema,
            default: () => ({}),
          },
          de: {
            type: ShippingReturnsTranslationSchema,
            default: () => ({}),
          },
        },
        { _id: false }
      ),
      default: () => ({ tr: {} }),
    },
  },
  { timestamps: true }
);

export default mongoose.models["ShippingReturns"] || mongoose.model("ShippingReturns", ShippingReturnsSchema);
