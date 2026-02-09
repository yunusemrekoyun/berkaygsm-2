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
    lines: { type: [String], default: [] }, // iletişim satırları
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
    heroTitle: { type: String, default: "Yardım için buradayız" },
    heroSubtitle: {
      type: String,
      default:
        "Bize ulaşın, sorularınızı yanıtlayalım ve ihtiyaçlarınıza uygun çözümler sunalım. Çalışma saatlerimiz pazar günü hariç her gün 09:00-18:00 arasındadır.",
    },
    heroImage: { type: ImageSchema, default: () => ({}) },

    // Sağdaki 4 blok
    addressBlock: {
      type: BlockSchema,
      default: () => ({ title: "Mağazamızı ziyaret edin", lines: [] }),
    },
    hoursBlock: {
      type: BlockSchema,
      default: () => ({ title: "Çalışma saatleri", lines: [] }),
    },
    emailBlock: {
      type: BlockSchema,
      default: () => ({ title: "Müşteri hizmetleri", lines: [] }),
    },
    phoneBlock: {
      type: BlockSchema,
      default: () => ({ title: "Telefon", lines: [] }),
    },

    // Form davranışı
    formEnabled: { type: Boolean, default: true },
    successMessage: {
      type: String,
      default:
        "Mesajınız için teşekkür ederiz. Talebinizi aldık ve kısa süre içinde yanıt vereceğiz. Acil yardım ihtiyacınız varsa, aşağıdaki numaradan bize ulaşabilirsiniz.",
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
