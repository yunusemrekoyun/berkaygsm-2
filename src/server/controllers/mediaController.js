import cloudinary, { configureCloudinary } from "../config/cloudinary.js";
import { DEFAULT_ALLOWED_FORMATS, resolveScopeConfig } from "../media/constants.js";
import { resolveScopedFolder } from "../media/config.js";
import {
  deleteMediaResource,
  getMediaProviderName,
  getMediaUsage,
  listMediaResources,
} from "../media/provider.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

configureCloudinary();

function resolveFolder(scopeConfig) {
  return resolveScopedFolder(scopeConfig?.folder || "");
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
    if (getMediaProviderName() !== "cloudinary") {
      return res.status(410).json({
        message: "Aktif medya sürücüsü istemci imzalı yüklemeyi desteklemiyor",
      });
    }

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
      return res.status(500).json({ message: "Cloudinary yapılandırılmamış" });
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
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);

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
    const usage = await getMediaUsage();
    res.json({ usage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function listCloudinaryResources(req, res) {
  try {
    const response = await listMediaResources({
      nextCursor: req.query.nextCursor,
      prefix: req.query.prefix,
      maxResults: req.query.maxResults,
      resourceType: req.query.resourceType || "image",
      type: req.query.type || "upload",
    });

    res.json(response);
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

    const result = await deleteMediaResource(publicId, {
      resourceType,
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

    const scopeConfig = resolveScopeConfig(req.body?.scope);
    if (!scopeConfig) {
      return res.status(400).json({ message: "Geçersiz yükleme kapsamı" });
    }
    if (scopeConfig.adminOnly && req.userRole !== "admin") {
      return res.status(403).json({ message: "Erişim reddedildi" });
    }

    const resourceType =
      req.body?.resourceType ||
      (req.file.mimetype?.startsWith("video/") ? "video" : "image");
    if (!(scopeConfig.resourceTypes || []).includes(resourceType)) {
      return res.status(400).json({ message: "Bu kapsam için medya türü desteklenmiyor" });
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: resolveFolder(scopeConfig),
      resource_type: resourceType,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    res.status(201).json({
      asset: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        duration: result.duration,
        resourceType: result.resource_type,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Upload failed" });
  }
}
