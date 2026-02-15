import mongoose from "mongoose";

const ServiceRecordCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    value: { type: Number, default: -1 },
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

export default mongoose.models["ServiceRecordCounter"] ||
  mongoose.model("ServiceRecordCounter", ServiceRecordCounterSchema);
