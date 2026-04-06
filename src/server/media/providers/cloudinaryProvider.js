import streamifier from "streamifier";
import cloudinary, { configureCloudinary } from "../../config/cloudinary.js";

function extractFolder(publicId = "") {
  const segments = String(publicId).split("/").filter(Boolean);
  segments.pop();
  return segments.join("/");
}

function normalizeCloudinaryResource(item = {}) {
  const secureUrl = item.secure_url || item.secureUrl || item.url || "";
  const publicId = item.public_id || item.publicId || "";
  const resourceType = item.resource_type || item.resourceType || "image";
  return {
    url: secureUrl,
    secureUrl,
    secure_url: secureUrl,
    publicId,
    public_id: publicId,
    width: item.width,
    height: item.height,
    format: item.format,
    bytes: item.bytes,
    duration: item.duration,
    resourceType,
    resource_type: resourceType,
    type: item.type || "upload",
    createdAt: item.created_at || item.createdAt || new Date().toISOString(),
    folder: item.folder || extractFolder(publicId),
  };
}

async function uploadBuffer(buffer, options = {}) {
  const instance = configureCloudinary();
  const folder = options.folder || instance.uploadFolder || "uploads";
  const uploadOptions = {
    folder,
    resource_type: options.resourceType || options.resource_type || "image",
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    ...options,
  };

  return new Promise((resolve, reject) => {
    const stream = instance.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(normalizeCloudinaryResource(result));
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

async function deleteAsset(publicId, resourceType = "image") {
  if (!publicId) return { result: "not_found" };
  const instance = configureCloudinary();
  return instance.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
}

async function getUsage() {
  const usage = await cloudinary.api.usage();
  const storage = usage.storage || {};
  const bandwidth = usage.bandwidth || {};

  return {
    driver: "cloudinary",
    plan: usage.plan,
    lastUpdated: usage.last_updated,
    storage: {
      usedBytes: storage.usage || storage.used || 0,
      limitBytes: storage.limit || storage.limit_usage || null,
      usedPercent:
        storage.used_percent != null
          ? storage.used_percent * 100
          : storage.usage && storage.limit
          ? (storage.usage / storage.limit) * 100
          : null,
    },
    bandwidth: {
      usedBytes: bandwidth.usage || bandwidth.used || 0,
      limitBytes: bandwidth.limit || bandwidth.limit_usage || null,
      usedPercent:
        bandwidth.used_percent != null
          ? bandwidth.used_percent * 100
          : bandwidth.usage && bandwidth.limit
          ? (bandwidth.usage / bandwidth.limit) * 100
          : null,
    },
    requests: usage.requests || null,
    resourcesCount: usage.resources || usage.objects || null,
  };
}

async function listResources({
  nextCursor,
  prefix,
  maxResults = 50,
  resourceType = "image",
  type = "upload",
} = {}) {
  const response = await cloudinary.api.resources({
    resource_type: resourceType,
    type,
    prefix: prefix || undefined,
    max_results: Math.min(Number(maxResults) || 50, 500),
    next_cursor: nextCursor || undefined,
    direction: "desc",
    sort_by: "created_at",
  });

  return {
    resources: (response.resources || []).map(normalizeCloudinaryResource),
    nextCursor: response.next_cursor || null,
  };
}

async function deleteResource(publicId, { resourceType = "image", invalidate = false } = {}) {
  if (!publicId) return { result: "not_found" };
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate,
  });
}

export const cloudinaryProvider = {
  name: "cloudinary",
  uploadBuffer,
  deleteAsset,
  getUsage,
  listResources,
  deleteResource,
};
