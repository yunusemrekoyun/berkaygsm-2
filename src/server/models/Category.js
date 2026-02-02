import mongoose from "mongoose";
import slugify from "slugify";

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

const CategoryTranslationSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
  },
  { _id: false }
);

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    level: { type: Number, default: 0, min: 0, max: 2 },
    ancestors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    image: { type: ImageSchema, default: null },
    translations: {
      type: new mongoose.Schema(
        {
          tr: { type: CategoryTranslationSchema, default: () => ({}) },
          en: { type: CategoryTranslationSchema, default: () => ({}) },
          de: { type: CategoryTranslationSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      default: () => ({ tr: {} }),
    },
  },
  { timestamps: true }
);

CategorySchema.index({ name: 1, parent: 1 }, { unique: true });

CategorySchema.pre("validate", async function (next) {
  if (this.isModified("name") || !this.slug) {
    const baseSlug = slugify(this.name, { lower: true, strict: true });
    let slugCandidate = baseSlug;
    let counter = 1;

    while (
      await mongoose.models.Category.exists({
        slug: slugCandidate,
        _id: { $ne: this._id },
      })
    ) {
      slugCandidate = `${baseSlug}-${counter++}`;
    }
    this.slug = slugCandidate;
  }

  if (!this.parent) {
    this.level = 0;
    this.ancestors = [];
    return next();
  }

  const parent = await mongoose.models.Category.findById(this.parent);
  if (!parent) {
    return next(new Error("Parent category not found"));
  }
  if (parent.level >= 2) {
    return next(new Error("Category tree cannot be deeper than 3 levels"));
  }

  this.level = parent.level + 1;
  this.ancestors = [...(parent.ancestors || []), parent._id];
  next();
});

CategorySchema.virtual("isLeaf").get(function () {
  return this.level === 2;
});

export default mongoose.models["Category"] || mongoose.model("Category", CategorySchema);
