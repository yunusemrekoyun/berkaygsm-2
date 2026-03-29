import mongoose from "mongoose";

const SOURCE_ENUM = [
  "direct",
  "organic",
  "social",
  "referral",
  "paid",
  "email",
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
    visitorId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
      index: true,
    },
    isEntry: { type: Boolean, default: false, index: true },
    path: {
      type: String,
      required: true,
      trim: true,
      maxlength: 260,
      index: true,
    },
    query: { type: String, default: "", trim: true, maxlength: 400 },
    referrer: { type: String, default: "", trim: true, maxlength: 600 },
    utmSource: { type: String, default: "", trim: true, maxlength: 160 },
    utmMedium: { type: String, default: "", trim: true, maxlength: 160 },
    utmCampaign: { type: String, default: "", trim: true, maxlength: 220 },
    utmTerm: { type: String, default: "", trim: true, maxlength: 220 },
    utmContent: { type: String, default: "", trim: true, maxlength: 220 },
    clickId: { type: String, default: "", trim: true, maxlength: 220 },
    clickIdType: { type: String, default: "", trim: true, maxlength: 64 },
    firstTouchSource: { type: String, default: "", trim: true, maxlength: 64 },
    firstTouchMedium: { type: String, default: "", trim: true, maxlength: 160 },
    firstTouchCampaign: { type: String, default: "", trim: true, maxlength: 220 },
    lastTouchSource: { type: String, default: "", trim: true, maxlength: 64 },
    lastTouchMedium: { type: String, default: "", trim: true, maxlength: 160 },
    lastTouchCampaign: { type: String, default: "", trim: true, maxlength: 220 },
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
VisitEventSchema.index({ visitorId: 1, createdAt: -1 });
VisitEventSchema.index({ isEntry: 1, source: 1, createdAt: -1 });

export default mongoose.models["VisitEvent"] ||
  mongoose.model("VisitEvent", VisitEventSchema);
