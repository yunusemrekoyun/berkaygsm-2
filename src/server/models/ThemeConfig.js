import mongoose from "mongoose";

const KVSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // ör: "--color-primary"
    value: { type: String, required: true }, // hex
  },
  { _id: false }
);

const ThemeConfigSchema = new mongoose.Schema(
  {
    singleton: {
      type: String,
      required: true,
      unique: true,
      default: "theme_config",
    },

    // aktif preset anahtarı (opsiyonel)
    activeKey: { type: String, default: "rosewood" },

    // store/admin değişkenleri key-value olarak saklanır
    storeVars: { type: [KVSchema], default: [] },
    adminVars: { type: [KVSchema], default: [] },

    // (opsiyonel) taslak/preset listesi saklamak istersen:
    presets: {
      type: [
        new mongoose.Schema(
          {
            key: String,
            name: String,
            store: { type: Map, of: String, default: {} },
            admin: { type: Map, of: String, default: {} },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.models["ThemeConfig"] || mongoose.model("ThemeConfig", ThemeConfigSchema);
