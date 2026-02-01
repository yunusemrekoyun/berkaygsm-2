import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("⚠️  MONGODB_URI bulunamadı. DB bağlantısı atlanıyor.");
    return;
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  logger.info("✅ Mongo connected");
}
