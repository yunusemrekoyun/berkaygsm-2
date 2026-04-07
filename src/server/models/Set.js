import mongoose from "mongoose";
import slugify from "slugify";

function toSlug(text) {
  const tr = String(text || "")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ı/g, "i").replace(/İ/g, "i")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ç/g, "c").replace(/Ç/g, "c");
  return slugify(tr, { lower: true, strict: true });
}

const SetImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: Number,
    height: Number,
    format: String,
  },
  { _id: false }
);

const SetProductSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, min: 1, default: 1 },
  },
  { _id: false }
);

const SetTranslationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 160 },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const SetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    images: { type: [SetImageSchema], default: [] },
    show: { type: Boolean, default: true },
    products: { type: [SetProductSchema], default: [] },
    sku: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },
    translations: {
      type: new mongoose.Schema(
        {
          tr: { type: SetTranslationSchema, default: () => ({}) },
          en: { type: SetTranslationSchema, default: () => ({}) },
          de: { type: SetTranslationSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      default: () => ({ tr: {} }),
    },
  },
  { timestamps: true }
);

SetSchema.index({ name: 1 }, { unique: true });

SetSchema.pre("validate", async function (next) {
  if (this.isModified("name") || !this.slug) {
    const base =
      toSlug(this.name) || "set";
    let s = base;
    let k = 1;
    while (
      await mongoose.models.Set.exists({ slug: s, _id: { $ne: this._id } })
    ) {
      s = `${base}-${k++}`;
    }
    this.slug = s;
  }
  if (this.sku) this.sku = this.sku.trim().toUpperCase() || undefined;
  next();
});

export default mongoose.models["Set"] || mongoose.model("Set", SetSchema);
