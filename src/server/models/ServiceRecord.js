import mongoose from "mongoose";

const SERVICE_WORKFLOW_STATUSES = [
  "new",
  "in_progress",
  "completed",
  "delivered",
  "cancelled",
];

const SERVICE_OUTCOMES = ["ongoing", "repaired", "returned_unrepaired"];

const ServiceImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    format: { type: String, default: null },
    bytes: { type: Number, default: null },
    resourceType: { type: String, default: "image" },
  },
  { _id: false }
);

const ServiceRecordSchema = new mongoose.Schema(
  {
    trackingNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customerFirstName: { type: String, required: true, trim: true },
    customerLastName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true, index: true },
    operationDetails: { type: String, required: true, trim: true },
    price: { type: Number, default: 0, min: 0 },
    warrantyMonths: { type: Number, default: 0, min: 0, max: 120 },
    intakeDate: { type: Date, required: true, index: true },
    completionDate: { type: Date, default: null, index: true },
    workflowStatus: {
      type: String,
      enum: SERVICE_WORKFLOW_STATUSES,
      default: "new",
      index: true,
    },
    repairOutcome: {
      type: String,
      enum: SERVICE_OUTCOMES,
      default: "ongoing",
      index: true,
    },
    images: { type: [ServiceImageSchema], default: [] },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

ServiceRecordSchema.index({ isDeleted: 1, createdAt: -1 });
ServiceRecordSchema.index({ workflowStatus: 1, isDeleted: 1, intakeDate: -1 });
ServiceRecordSchema.index({ repairOutcome: 1, isDeleted: 1, intakeDate: -1 });

export { SERVICE_WORKFLOW_STATUSES, SERVICE_OUTCOMES };

export default mongoose.models["ServiceRecord"] ||
  mongoose.model("ServiceRecord", ServiceRecordSchema);
