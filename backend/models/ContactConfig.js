import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    width: Number,
    height: Number,
    format: String,
  },
  { _id: false }
);

const BlockSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    lines: { type: [String], default: [] }, // “Kurfürstendamm 45 ...” vb.
  },
  { _id: false }
);

const BlockTranslationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    lines: { type: [String], default: undefined },
  },
  { _id: false }
);

const ContactTranslationSchema = new mongoose.Schema(
  {
    heroTitle: { type: String, trim: true },
    heroSubtitle: { type: String, trim: true },
    addressBlock: { type: BlockTranslationSchema, default: undefined },
    hoursBlock: { type: BlockTranslationSchema, default: undefined },
    emailBlock: { type: BlockTranslationSchema, default: undefined },
    phoneBlock: { type: BlockTranslationSchema, default: undefined },
    successMessage: { type: String, trim: true },
  },
  { _id: false }
);

const ContactConfigSchema = new mongoose.Schema(
  {
    // Singleton’ı sabitlemek için key
    key: { type: String, unique: true, default: "default", index: true },

    // Hero
    heroTitle: { type: String, default: "We're here to help" },
    heroSubtitle: {
      type: String,
      default:
        "Our customer care team is available Monday to Friday, 09:00–18:00 CET. Send us a note and we'll respond within one business day.",
    },
    heroImage: { type: ImageSchema, default: () => ({}) },

    // Sağdaki 4 blok
    addressBlock: {
      type: BlockSchema,
      default: () => ({ title: "Visit our European studio", lines: [] }),
    },
    hoursBlock: {
      type: BlockSchema,
      default: () => ({ title: "Opening hours (CET)", lines: [] }),
    },
    emailBlock: {
      type: BlockSchema,
      default: () => ({ title: "Customer service", lines: [] }),
    },
    phoneBlock: {
      type: BlockSchema,
      default: () => ({ title: "Phone", lines: [] }),
    },

    // Form davranışı
    formEnabled: { type: Boolean, default: true },
    successMessage: {
      type: String,
      default:
        "Thank you for your message. We have received your enquiry and will reply via e-mail shortly. If you need immediate assistance, call us on the number below.",
    },
    translations: {
      type: new mongoose.Schema(
        {
          tr: { type: ContactTranslationSchema, default: () => ({}) },
          en: { type: ContactTranslationSchema, default: () => ({}) },
          de: { type: ContactTranslationSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      default: () => ({ tr: {} }),
    },
  },
  { timestamps: true }
);

export default mongoose.models["ContactConfig"] || mongoose.model("ContactConfig", ContactConfigSchema);
