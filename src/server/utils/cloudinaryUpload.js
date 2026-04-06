import { deleteMediaAsset, uploadBufferToMedia } from "../media/provider.js";

export function uploadBufferToCloudinary(buffer, options = {}) {
  return uploadBufferToMedia(buffer, {
    ...options,
    resourceType: options.resourceType || options.resource_type || "image",
  });
}

export function deleteFromCloudinary(publicId, resourceType = "image") {
  if (!publicId) return Promise.resolve();
  return deleteMediaAsset(publicId, resourceType);
}
