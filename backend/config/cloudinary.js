import { v2 as cloudinary } from "cloudinary";
import { logger } from "../utils/logger.js";

let configured = false;

export function configureCloudinary() {
  if (configured) return cloudinary;

  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_UPLOAD_FOLDER = "ayyildiz/products",
  } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn(
      "⚠️  Cloudinary environment variables missing. Image upload disabled until configured."
    );
    return cloudinary;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  cloudinary.uploadFolder = CLOUDINARY_UPLOAD_FOLDER;
  configured = true;
  logger.info("✅ Cloudinary configured");
  return cloudinary;
}

export default cloudinary;
