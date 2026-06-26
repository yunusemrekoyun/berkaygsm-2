import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

const globalMongoState =
  globalThis.__ceplifeMongoState ||
  (globalThis.__ceplifeMongoState = {
    promise: null,
    eventsAttached: false,
  });

function attachConnectionEventHandlers() {
  if (globalMongoState.eventsAttached) return;
  globalMongoState.eventsAttached = true;

  mongoose.connection.on("disconnected", () => {
    globalMongoState.promise = null;
    logger.warn("Mongo disconnected; connection promise reset");
  });

  mongoose.connection.on("error", (error) => {
    if (mongoose.connection.readyState !== 1) {
      globalMongoState.promise = null;
    }
    logger.error(
      { err: error?.message || String(error) },
      "Mongo connection emitted an error"
    );
  });
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("⚠️  MONGODB_URI bulunamadı. DB bağlantısı atlanıyor.");
    return;
  }

  attachConnectionEventHandlers();

  if (mongoose.connection.readyState === 1) return;

  if (mongoose.connection.readyState !== 2) {
    globalMongoState.promise = null;
  }

  if (!globalMongoState.promise) {
    mongoose.set("strictQuery", true);
    globalMongoState.promise = mongoose
      .connect(uri)
      .then(() => {
        logger.info("✅ Mongo connected");
      })
      .catch((error) => {
        globalMongoState.promise = null;
        logger.error(
          { err: error?.message || String(error) },
          "Mongo connection failed"
        );
        throw error;
      });
  }

  await globalMongoState.promise;
}
