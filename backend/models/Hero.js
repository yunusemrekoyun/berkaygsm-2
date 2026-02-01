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

const VideoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: Number,
    height: Number,
    duration: Number,
    format: String,
  },
  { _id: false }
);

const HeroTranslationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    buttonText: { type: String, trim: true },
  },
  { _id: false }
);

/**
 * Hero slide:
 * - Medya zorunlu: image XOR video
 * - title / subtitle zorunlu; buttonText opsiyonel
 * - target:
 *    type: "SHOP" | "CATEGORIES"
 *    categories: [Category._id] (type=CATEGORIES iken zorunlu, 1..N)
 */
const HeroSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, required: true, trim: true },
    buttonText: { type: String, default: "" },

    image: { type: ImageSchema, default: null },
    video: { type: VideoSchema, default: null },

    target: {
      type: {
        type: String,
        enum: ["SHOP", "CATEGORIES"],
        required: true,
        default: "SHOP",
      },
      categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    },

    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    translations: {
      type: new mongoose.Schema(
        {
          tr: { type: HeroTranslationSchema, default: () => ({}) },
          en: { type: HeroTranslationSchema, default: () => ({}) },
          de: { type: HeroTranslationSchema, default: () => ({}) },
        },
        { _id: false }
      ),
      default: () => ({ tr: {} }),
    },
  },
  { timestamps: true }
);

HeroSchema.pre("validate", function (next) {
  const hasImage = !!this.image;
  const hasVideo = !!this.video;
  if (hasImage && hasVideo)
    return next(new Error("Hero can have either image OR video, not both."));
  if (!hasImage && !hasVideo)
    return next(new Error("Hero requires one media: image OR video."));

  if (this.target?.type === "CATEGORIES") {
    const arr = Array.isArray(this.target?.categories)
      ? this.target.categories
      : [];
    if (arr.length === 0) {
      return next(
        new Error("Target type CATEGORIES requires at least one category.")
      );
    }
  }
  next();
});

export default mongoose.model("Hero", HeroSchema);
