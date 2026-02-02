import streamifier from "streamifier";
import cloudinary, { configureCloudinary } from "../config/cloudinary.js";

configureCloudinary();

export function uploadBufferToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const instance = configureCloudinary();
    const folder = options.folder || instance.uploadFolder || "uploads";

    const uploadOptions = {
      folder,
      resource_type: options.resource_type || "image",
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      ...options,
    };

    const stream = instance.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

export function deleteFromCloudinary(publicId, resourceType = "image") {
  if (!publicId) return Promise.resolve();
  const instance = configureCloudinary();
  return instance.uploader.destroy(publicId, { resource_type: resourceType });
}
