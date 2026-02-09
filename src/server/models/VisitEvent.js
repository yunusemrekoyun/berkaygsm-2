import mongoose from "mongoose";

const SOURCE_ENUM = [
  "direct",
  "organic",
  "social",
  "referral",
  "paid",
  "internal",
  "other",
];

const DEVICE_ENUM = ["mobile", "tablet", "desktop"];

const VisitEventSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      index: true,
    },
    path: {
      type: String,
      required: true,
      trim: true,
      maxlength: 260,
      index: true,
    },
    query: { type: String, default: "", trim: true, maxlength: 400 },
    referrer: { type: String, default: "", trim: true, maxlength: 600 },
    source: {
      type: String,
      enum: SOURCE_ENUM,
      default: "direct",
      index: true,
    },
    device: {
      type: String,
      enum: DEVICE_ENUM,
      default: "desktop",
      index: true,
    },
    country: { type: String, default: "", trim: true, maxlength: 80, index: true },
    ip: { type: String, default: "", trim: true, maxlength: 80 },
    userAgent: { type: String, default: "", trim: true, maxlength: 600 },
    host: { type: String, default: "", trim: true, maxlength: 160 },
  },
  { timestamps: true }
);

VisitEventSchema.index({ createdAt: -1 });
VisitEventSchema.index({ sessionId: 1, path: 1, createdAt: -1 });

export default mongoose.models["VisitEvent"] ||
  mongoose.model("VisitEvent", VisitEventSchema);
