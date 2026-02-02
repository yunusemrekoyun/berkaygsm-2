import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: Number,
    height: Number,
    format: String,
  },
  { _id: false }
);

const DotBlockSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const StatSchema = new mongoose.Schema(
  {
    value: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const CtaSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    variant: {
      type: String,
      enum: ["primary", "secondary"],
      default: "primary",
    },
  },
  { _id: false }
);

const DotBlockTranslationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    text: { type: String, trim: true },
  },
  { _id: false }
);

const StatTranslationSchema = new mongoose.Schema(
  {
    value: { type: String, trim: true },
    label: { type: String, trim: true },
  },
  { _id: false }
);

const CtaTranslationSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true },
  },
  { _id: false }
);

const AboutTranslationSchema = new mongoose.Schema(
  {
    heroTitle: { type: String, trim: true },
    heroSubtitle: { type: String, trim: true },
    dotBlocks: { type: [DotBlockTranslationSchema], default: undefined },
    stats: { type: [StatTranslationSchema], default: undefined },
    materialsTitle: { type: String, trim: true },
    materialsText: { type: String, trim: true },
    materialsBullets: { type: [String], default: undefined },
    ctaTitle: { type: String, trim: true },
    ctaSubtitle: { type: String, trim: true },
    ctas: { type: [CtaTranslationSchema], default: undefined },
  },
  { _id: false }
);

const AboutSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "about", index: true },
    heroTitle: { type: String, default: "About Berkay GSM" },
    heroSubtitle: {
      type: String,
      default:
        "Discover the story behind our passion for dependable phone accessories—crafted for protection, power, and everyday use.",
    },
    heroImage: { type: ImageSchema, default: null },
    leftImage: { type: ImageSchema, default: null },
    dotBlocks: {
      type: [DotBlockSchema],
      default: [
        {
          title: "Our Story",
          text: "Berkay GSMstarted with a simple idea: make reliable, stylish phone gear easy to find. From a small workshop to a growing storefront, we have always focused on quality, fit, and customer care.",
        },
        {
          title: "Our Vision",
          text: "To be the most trusted destination for premium mobile accessories—blending durable materials with modern design and fair pricing.",
        },
        {
          title: "Our Values",
          text: "Safety-certified charging, device-first fit, and long-lasting materials. We work with trusted partners to ensure performance and compatibility you can rely on.",
        },
      ],
    },
    stats: {
      type: [StatSchema],
      default: [
        { value: "10K+", label: "Devices Protected" },
        { value: "45K+", label: "Happy Customers" },
        { value: "5", label: "Service Centers" },
        { value: "98%", label: "Compatibility Success" },
      ],
    },
    materialsTitle: {
      type: String,
      default: "Materials & Safety",
    },
    materialsText: {
      type: String,
      default:
        "We select impact-resistant polymers, tempered glass, and certified charging components from audited suppliers. Packaging is minimal, and we prioritize partners with responsible manufacturing practices.",
    },
    materialsBullets: {
      type: [String],
      default: [
        "• Drop-tested case materials",
        "• Certified charging standards",
        "• Scratch-resistant glass protection",
        "• Reusable & recyclable packaging",
      ],
    },
    materialsImage: { type: ImageSchema, default: null },
    ctaTitle: { type: String, default: "Visit Our Store in Berlin" },
    ctaSubtitle: {
      type: String,
      default:
        "Try cases, grips, and chargers in person and let our team help you find the right fit for your device.",
    },
    ctas: {
      type: [CtaSchema],
      default: [
        { text: "Explore Accessories", to: "/shop", variant: "primary" },
        { text: "Contact Us", to: "/contact", variant: "secondary" },
      ],
    },
    translations: {
      type: new mongoose.Schema(
        {
          tr: { type: AboutTranslationSchema, default: () => ({}) },
          en: { type: AboutTranslationSchema, default: () => ({}) },
          de: { type: AboutTranslationSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      default: () => ({ tr: {} }),
    },
  },
  { timestamps: true }
);

export default mongoose.models["About"] || mongoose.model("About", AboutSchema);
