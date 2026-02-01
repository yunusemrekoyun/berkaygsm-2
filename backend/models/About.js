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
    heroTitle: { type: String, default: "About Evim & Stil" },
    heroSubtitle: {
      type: String,
      default:
        "Discover the story behind our passion for bringing elegant lingerie and home textiles to the heart of the community—crafted with care, rooted in quality, and designed to feel like home.",
    },
    heroImage: { type: ImageSchema, default: null },
    leftImage: { type: ImageSchema, default: null },
    dotBlocks: {
      type: [DotBlockSchema],
      default: [
        {
          title: "Our Story",
          text: "Evim & Stil was founded with a simple idea: elevate everyday life with beautifully-made essentials. From a tiny studio to a multi-location boutique, our journey has always been guided by craftsmanship, comfort and kindness.",
        },
        {
          title: "Our Vision",
          text: "To be the most trusted destination for premium lingerie and home textiles—blending European finesse with Turkish craftsmanship, and shaping serene, elegant spaces for modern living.",
        },
        {
          title: "Our Values",
          text: "Quality without compromise, timeless design over fast trends, and an experience that feels personal. We work with responsible mills and long-term partners to ensure durability, touch, and fit you can rely on.",
        },
      ],
    },
    stats: {
      type: [StatSchema],
      default: [
        { value: "14+", label: "Years of Craft" },
        { value: "120K+", label: "Happy Customers" },
        { value: "6", label: "Stores & Studios" },
        { value: "80%", label: "Eco Fabrics" },
      ],
    },
    materialsTitle: {
      type: String,
      default: "Materials & Responsibility",
    },
    materialsText: {
      type: String,
      default:
        "We select breathable cottons, silky satins and durable blends from audited suppliers. Over 80% of our fabric range is OEKO-TEX® or equivalent certified. Packaging is plastic-light, and most of our suppliers are within regional logistics corridors to reduce transport.",
    },
    materialsBullets: {
      type: [String],
      default: [
        "• OEKO-TEX® certified dye houses",
        "• Responsible water & energy use",
        "• Long-lasting stitch & finish checks",
        "• Reusable & recyclable packaging",
      ],
    },
    materialsImage: { type: ImageSchema, default: null },
    ctaTitle: { type: String, default: "Visit Our Boutique in Berlin" },
    ctaSubtitle: {
      type: String,
      default:
        "Experience the textures in person and let our stylists help you build the perfect trousseau—bridal sets, bedding packages and more.",
    },
    ctas: {
      type: [CtaSchema],
      default: [
        { text: "Explore Packages", to: "/sets", variant: "primary" },
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

export default mongoose.model("About", AboutSchema);
