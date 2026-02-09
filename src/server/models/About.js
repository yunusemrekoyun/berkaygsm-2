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
    heroTitle: { type: String, default: "Berkay GSM Hakkında" },
    heroSubtitle: {
      type: String,
      default:
        "Günlük kullanım için koruma, şarj ve kullanım kolaylığı sunan telefon aksesuarlarını kalite odaklı yaklaşımımızla sizlere ulaştırıyoruz.",
    },
    heroImage: { type: ImageSchema, default: null },
    leftImage: { type: ImageSchema, default: null },
    dotBlocks: {
      type: [DotBlockSchema],
      default: [
        {
          title: "Hikayemiz",
          text: "Berkay GSM, güvenilir ve şık telefon aksesuarlarını ulaşılabilir hale getirme fikriyle yola çıktı. İlk günden beri ürün kalitesi, uyumluluk ve müşteri memnuniyetine odaklanıyoruz.",
        },
        {
          title: "Vizyonumuz",
          text: "Dayanıklı malzeme, güncel tasarım ve doğru fiyat dengesini bir araya getirerek mobil aksesuar alanında en güvenilir mağaza olmak.",
        },
        {
          title: "Değerlerimiz",
          text: "Güvenlik standartlarına uygun şarj ürünleri, cihaz odaklı uyum ve uzun ömürlü malzeme. İş ortaklarımızı performans ve güvenilirlik kriterleriyle seçiyoruz.",
        },
      ],
    },
    stats: {
      type: [StatSchema],
      default: [
        { value: "10K+", label: "Korunan Cihaz" },
        { value: "45K+", label: "Memnun Müşteri" },
        { value: "5", label: "Hizmet Noktası" },
        { value: "98%", label: "Uyumluluk Başarısı" },
      ],
    },
    materialsTitle: {
      type: String,
      default: "Malzeme ve Güvenlik",
    },
    materialsText: {
      type: String,
      default:
        "Darbe dayanımlı polimerler, temperli cam ve sertifikalı şarj bileşenleri kullanıyoruz. Tedarik sürecinde kalite kontrol ve güvenlik standartlarını önceliklendiriyoruz.",
    },
    materialsBullets: {
      type: [String],
      default: [
        "• Düşme testlerinden geçen kılıf malzemeleri",
        "• Sertifikalı şarj standartları",
        "• Çizilmeye dayanıklı ekran koruma çözümleri",
        "• Geri dönüştürülebilir ve sade ambalaj",
      ],
    },
    materialsImage: { type: ImageSchema, default: null },
    ctaTitle: { type: String, default: "Mağazamızı Ziyaret Edin" },
    ctaSubtitle: {
      type: String,
      default:
        "Kılıf, şarj cihazı ve diğer aksesuarları mağazamızda deneyin. Ekibimiz cihazınıza en uygun ürünü seçmenizde yardımcı olur.",
    },
    ctas: {
      type: [CtaSchema],
      default: [
        { text: "Aksesuarları Keşfet", to: "/shop", variant: "primary" },
        { text: "İletişime Geç", to: "/contact", variant: "secondary" },
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
