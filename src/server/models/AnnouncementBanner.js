import mongoose from "mongoose";

const AnnouncementBannerSchema = new mongoose.Schema(
  {
    isEnabled: { type: Boolean, default: false },
    text: { type: String, default: "" },
    bgColor: { type: String, default: "#0c4a6e" },
    textColor: { type: String, default: "#ffffff" },
  },
  { timestamps: true }
);

AnnouncementBannerSchema.statics.getSingleton = async function () {
  const existing = await this.findOne();
  if (existing) return existing;
  return this.create({});
};

export default mongoose.models["AnnouncementBanner"] ||
  mongoose.model("AnnouncementBanner", AnnouncementBannerSchema);
