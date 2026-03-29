import mongoose from "mongoose";

const RateLimitBucketSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export default mongoose.models.RateLimitBucket ||
  mongoose.model("RateLimitBucket", RateLimitBucketSchema);
