import { getMediaDriver } from "./config.js";
import { cloudinaryProvider } from "./providers/cloudinaryProvider.js";
import { localProvider } from "./providers/localProvider.js";

const PROVIDERS = {
  cloudinary: cloudinaryProvider,
  local: localProvider,
};

export function getMediaProvider() {
  const driver = getMediaDriver();
  return PROVIDERS[driver] || cloudinaryProvider;
}

export function getMediaProviderName() {
  return getMediaProvider().name;
}

export async function uploadBufferToMedia(buffer, options = {}) {
  return getMediaProvider().uploadBuffer(buffer, options);
}

export async function deleteMediaAsset(publicId, resourceType = "image") {
  return getMediaProvider().deleteAsset(publicId, resourceType);
}

export async function getMediaUsage() {
  return getMediaProvider().getUsage();
}

export async function listMediaResources(options = {}) {
  return getMediaProvider().listResources(options);
}

export async function deleteMediaResource(publicId, options = {}) {
  return getMediaProvider().deleteResource(publicId, options);
}
