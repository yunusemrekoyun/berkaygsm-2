// backend/models/UserDetails.js
import mongoose from "mongoose";

const AvatarSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: Number,
    height: Number,
    format: String,
  },
  { _id: false }
);

const AddressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "" }, // Ev, İş, vb.
    fullName: { type: String, default: "" },
    phone: { type: String, default: "" },
    country: { type: String, default: "" },
    city: { type: String, default: "" },
    district: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    addressLine: { type: String, default: "" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true }
);

const UserDetailsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
      index: true,
    },

    // profil resmi
    avatar: { type: AvatarSchema, default: null },

    // temel demografik
    gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
    birthDate: { type: Date, default: null },

    // adresler
    addresses: { type: [AddressSchema], default: [] },

    // favoriler
    favoriteProducts: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    favoriteSets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Set" }],
  },
  { timestamps: true }
);

export default mongoose.model("UserDetails", UserDetailsSchema);