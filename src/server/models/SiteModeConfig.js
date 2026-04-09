import mongoose from "mongoose";

const SiteModeConfigSchema = new mongoose.Schema(
  {
    maintenanceModeEnabled: { type: Boolean, default: false },
    maintenanceModeUpdatedAt: { type: Date, default: null },
    maintenanceModeUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastAnnouncementState: {
      type: String,
      enum: ["", "enabled", "disabled"],
      default: "",
    },
    lastAnnouncementQueuedAt: { type: Date, default: null },
    lastAnnouncementCompletedAt: { type: Date, default: null },
    lastAnnouncementRecipientCount: { type: Number, default: 0 },
    lastAnnouncementDeliveredCount: { type: Number, default: 0 },
    lastAnnouncementFailedCount: { type: Number, default: 0 },
    lastAnnouncementError: { type: String, default: "" },
    announcementDispatching: { type: Boolean, default: false },
  },
  { timestamps: true }
);

SiteModeConfigSchema.statics.getSingleton = async function () {
  const existing = await this.findOne();
  if (existing) return existing;
  return this.create({});
};

export default mongoose.models["SiteModeConfig"] ||
  mongoose.model("SiteModeConfig", SiteModeConfigSchema);
