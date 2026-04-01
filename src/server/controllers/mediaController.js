import cloudinary, { configureCloudinary } from "../config/cloudinary.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

configureCloudinary();

const DEFAULT_ALLOWED_FORMATS = {
  image: ["jpg", "jpeg", "png", "webp", "avif", "gif"],
  video: ["mp4", "webm", "mov", "m4v"],
};

const UPLOAD_SCOPES = {
  products: { folder: "products", adminOnly: true, resourceTypes: ["image", "video"] },
  sets: { folder: "sets", adminOnly: true, resourceTypes: ["image", "video"] },
  categories: { folder: "categories", adminOnly: true, resourceTypes: ["image"] },
  campaigns: { folder: "campaigns", adminOnly: true, resourceTypes: ["image"] },
  heroes: { folder: "heroes", adminOnly: true, resourceTypes: ["image", "video"] },
  about: { folder: "about", adminOnly: true, resourceTypes: ["image"] },
  contact: { folder: "contact", adminOnly: true, resourceTypes: ["image"] },
  media: { folder: "media", adminOnly: true, resourceTypes: ["image", "video"] },
  avatars: {
    folder: "avatars",
    adminOnly: false,
    resourceTypes: ["image"],
    allowClientSignature: false,
  },
};

function resolveScopeConfig(scope) {
  const normalized = String(scope || "media").toLowerCase();
  return UPLOAD_SCOPES[normalized] || null;
}

function resolveFolder(scopeConfig) {
  const instance = configureCloudinary();
  const base = (instance.uploadFolder || "berkaygsm").replace(/\/+$/, "");
  const suffix = scopeConfig?.folder ? `/${scopeConfig.folder}` : "";
  return `${base}${suffix}`;
}

function resolveAllowedFormats(scopeConfig, resourceType) {
  const scopedFormats = scopeConfig?.allowedFormats?.[resourceType];
  const formats =
    Array.isArray(scopedFormats) && scopedFormats.length
      ? scopedFormats
      : DEFAULT_ALLOWED_FORMATS[resourceType] || [];
  return formats.join(",");
}

function buildSignedUploadParams({ scopeConfig, resourceType, timestamp, folder }) {
  const params = {
    timestamp,
    folder,
    overwrite: "false",
    unique_filename: "true",
    use_filename: "true",
  };
  const allowedFormats = resolveAllowedFormats(scopeConfig, resourceType);
  if (allowedFormats) {
    params.allowed_formats = allowedFormats;
  }
  return params;
}

export async function createUploadSignature(req, res) {
  try {
    const scopeConfig = resolveScopeConfig(req.body?.scope);
    if (!scopeConfig) {
      return res.status(400).json({ message: "Geçersiz yükleme kapsamı" });
    }
    if (scopeConfig.allowClientSignature === false) {
      return res.status(403).json({ message: "Bu kapsam istemci imzasını desteklemiyor" });
    }
    if (scopeConfig.adminOnly && req.userRole !== "admin") {
      return res.status(403).json({ message: "Erişim reddedildi" });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return res
        .status(500)
        .json({ message: "Cloudinary yapılandırılmamış" });
    }

    const requestedType = String(req.body?.resourceType || "image").toLowerCase();
    const allowedTypes = scopeConfig.resourceTypes || ["image"];
    const resourceType = allowedTypes.includes(requestedType)
      ? requestedType
      : allowedTypes[0];

    const folder = resolveFolder(scopeConfig);
    const timestamp = Math.floor(Date.now() / 1000);
    const params = buildSignedUploadParams({
      scopeConfig,
      resourceType,
      timestamp,
      folder,
    });
    const signature = cloudinary.utils.api_sign_request(
      params,
      apiSecret
    );

    res.json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
      resourceType,
      params,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Signature failed" });
  }
}

export async function getCloudinaryUsage(req, res) {
  try {
    const usage = await cloudinary.api.usage();
    const storage = usage.storage || {};
    const bandwidth = usage.bandwidth || {};

    res.json({
      usage: {
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
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function listCloudinaryResources(req, res) {
  try {
    const {
      nextCursor,
      prefix,
      maxResults = 50,
      resourceType = "image",
      type = "upload",
    } = req.query;

    const response = await cloudinary.api.resources({
      resource_type: resourceType,
      type,
      prefix: prefix || undefined,
      max_results: Math.min(Number(maxResults) || 50, 500),
      next_cursor: nextCursor || undefined,
      direction: "desc",
      sort_by: "created_at",
    });

    res.json({
      resources: response.resources.map((item) => ({
        publicId: item.public_id,
        secureUrl: item.secure_url,
        bytes: item.bytes,
        format: item.format,
        resourceType: item.resource_type,
        type: item.type,
        width: item.width,
        height: item.height,
        createdAt: item.created_at,
        folder: item.folder,
      })),
      nextCursor: response.next_cursor || null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function deleteCloudinaryResource(req, res) {
  try {
    const { publicId } = req.params;
    const { resourceType = "image", invalidate = "false" } = req.query;
    if (!publicId) {
      return res.status(400).json({ message: "publicId zorunlu" });
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: ["true", "1", "yes"].includes(String(invalidate).toLowerCase()),
    });

    res.json({ result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function uploadMediaAsset(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "Dosya gerekli" });
    }

    const folder =
      req.body?.folder ||
      cloudinary.uploadFolder ||
      "berkaygsm";
    const resourceType =
      req.body?.resourceType ||
      (req.file.mimetype?.startsWith("video/") ? "video" : "image");

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder,
      resource_type: resourceType,
    });

    res.status(201).json({
      asset: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        resourceType: result.resource_type,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Upload failed" });
  }
}
