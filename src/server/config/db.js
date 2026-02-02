import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

let connectionPromise = null;

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("⚠️  MONGODB_URI bulunamadı. DB bağlantısı atlanıyor.");
    return;
  }

  if (mongoose.connection.readyState === 1) return;

  if (!connectionPromise) {
    mongoose.set("strictQuery", true);
    connectionPromise = mongoose.connect(uri).then(() => {
      logger.info("✅ Mongo connected");
    });
  }

  await connectionPromise;
}
