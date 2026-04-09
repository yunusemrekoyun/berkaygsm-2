import mongoose from "mongoose";

const RefreshSessionSchema = new mongoose.Schema(
  {
    sid: { type: String, required: true, trim: true },
    tokenHash: { type: String, required: true, trim: true },
    expiresAt: { type: Date, default: null },
    createdAt: { type: Date, default: () => new Date() },
    lastUsedAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true },
    maintenanceAnnouncementsEnabled: {
      type: Boolean,
      default: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    refreshToken: { type: String, default: null },
    refreshSessions: { type: [RefreshSessionSchema], default: [] },

    // 🔽 Soft delete alanları
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedAlias: { type: String, default: "" }, // "Deleted account" gibi gösterim adı
  },
  { timestamps: true }
);

UserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

export default mongoose.models["User"] || mongoose.model("User", UserSchema);
