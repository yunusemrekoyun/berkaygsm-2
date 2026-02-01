import cloudinary, { configureCloudinary } from "../config/cloudinary.js";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

configureCloudinary();

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
      return res.status(400).json({ message: "publicId is required" });
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
      return res.status(400).json({ message: "File is required" });
    }

    const folder =
      req.body?.folder ||
      cloudinary.uploadFolder ||
      "ayyildiz/uploads";
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
