import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { IMAGE_VARIANTS } from "../constants.js";
import {
  getMediaPublicBaseUrl,
  getMediaRootDir,
  getMediaStorageLimitBytes,
} from "../config.js";

const META_FILE = "meta.json";

const MIME_EXTENSION_MAP = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-m4v": ".m4v",
};

function sanitizeSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeFolder(folder = "media") {
  const segments = String(folder || "media")
    .replace(/\\/g, "/")
    .split("/")
    .map(sanitizeSegment)
    .filter(Boolean);
  return segments.length ? segments.join("/") : "media";
}

function buildAssetId(buffer, folder, originalName = "") {
  return createHash("sha1")
    .update(folder)
    .update(String(originalName || "file"))
    .update(buffer)
    .update(String(Date.now()))
    .digest("hex")
    .slice(0, 24);
}

function resolveExtension({ originalName = "", mimeType = "", resourceType = "image" } = {}) {
  const fromMime = MIME_EXTENSION_MAP[String(mimeType || "").toLowerCase()];
  if (fromMime) return fromMime;
  const parsed = path.extname(String(originalName || "")).toLowerCase();
  if (parsed) return parsed;
  return resourceType === "video" ? ".mp4" : ".jpg";
}

function buildAssetDirectory(publicId) {
  return path.join(getMediaRootDir(), ...String(publicId).split("/").filter(Boolean));
}

function encodeSegments(value) {
  return String(value)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildPublicUrl(publicId, filename) {
  const encodedPublicId = encodeSegments(publicId);
  const encodedFilename = encodeURIComponent(filename);
  return `${getMediaPublicBaseUrl()}/${encodedPublicId}/${encodedFilename}`;
}

function extractFolder(publicId = "") {
  const segments = String(publicId).split("/").filter(Boolean);
  segments.pop();
  return segments.join("/");
}

function normalizeResource(resource = {}) {
  const secureUrl = resource.secureUrl || resource.secure_url || resource.url || "";
  const publicId = resource.publicId || resource.public_id || "";
  const resourceType = resource.resourceType || resource.resource_type || "image";
  return {
    url: secureUrl,
    secureUrl,
    secure_url: secureUrl,
    publicId,
    public_id: publicId,
    width: resource.width,
    height: resource.height,
    format: resource.format,
    bytes: resource.bytes,
    duration: resource.duration,
    resourceType,
    resource_type: resourceType,
    folder: resource.folder || extractFolder(publicId),
    createdAt: resource.createdAt || resource.created_at || new Date().toISOString(),
    type: "upload",
  };
}

async function ensureDirectory(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function walkMetaFiles(dirPath) {
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMetaFiles(entryPath)));
      continue;
    }
    if (entry.isFile() && entry.name === META_FILE) {
      files.push(entryPath);
    }
  }
  return files;
}

async function sumDirectoryBytes(dirPath) {
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }

  let total = 0;
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await sumDirectoryBytes(entryPath);
      continue;
    }
    if (entry.isFile()) {
      const stat = await fs.stat(entryPath);
      total += stat.size;
    }
  }
  return total;
}

async function buildImageAsset(buffer, options = {}) {
  const folder = normalizeFolder(options.folder);
  const assetId = buildAssetId(buffer, folder, options.originalName);
  const publicId = `${folder}/${assetId}`;
  const assetDir = buildAssetDirectory(publicId);
  const originalExtension = resolveExtension({
    originalName: options.originalName,
    mimeType: options.mimeType,
    resourceType: "image",
  });
  const originalFilename = `original${originalExtension}`;

  await ensureDirectory(assetDir);
  await fs.writeFile(path.join(assetDir, originalFilename), buffer);

  const source = sharp(buffer, { failOn: "none", animated: false }).rotate();
  const metadata = await source.metadata();

  const variants = {};
  await Promise.all(
    IMAGE_VARIANTS.map(async ({ name, width, quality }) => {
      const filename = `${name}.webp`;
      await sharp(buffer, { failOn: "none", animated: false })
        .rotate()
        .resize({
          width,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toFile(path.join(assetDir, filename));
      variants[name] = buildPublicUrl(publicId, filename);
    })
  );

  variants.original = buildPublicUrl(publicId, originalFilename);

  const asset = normalizeResource({
    url: variants.original,
    publicId,
    width: metadata.width,
    height: metadata.height,
    format: metadata.format || originalExtension.replace(/^\./, ""),
    bytes: buffer.length,
    resourceType: "image",
    folder,
    createdAt: new Date().toISOString(),
  });

  await writeJson(path.join(assetDir, META_FILE), {
    ...asset,
    originalFilename,
    variants,
  });

  return asset;
}

async function buildVideoAsset(buffer, options = {}) {
  const folder = normalizeFolder(options.folder);
  const assetId = buildAssetId(buffer, folder, options.originalName);
  const publicId = `${folder}/${assetId}`;
  const assetDir = buildAssetDirectory(publicId);
  const extension = resolveExtension({
    originalName: options.originalName,
    mimeType: options.mimeType,
    resourceType: "video",
  });
  const originalFilename = `original${extension}`;

  await ensureDirectory(assetDir);
  await fs.writeFile(path.join(assetDir, originalFilename), buffer);

  const asset = normalizeResource({
    url: buildPublicUrl(publicId, originalFilename),
    publicId,
    format: extension.replace(/^\./, ""),
    bytes: buffer.length,
    resourceType: "video",
    folder,
    createdAt: new Date().toISOString(),
  });

  await writeJson(path.join(assetDir, META_FILE), {
    ...asset,
    originalFilename,
  });

  return asset;
}

async function uploadBuffer(buffer, options = {}) {
  const resourceType = options.resourceType || options.resource_type || "image";
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Geçersiz medya buffer'ı");
  }

  if (resourceType === "video") {
    return buildVideoAsset(buffer, options);
  }
  return buildImageAsset(buffer, options);
}

async function deleteAsset(publicId) {
  if (!publicId) return { result: "not_found" };
  const assetDir = buildAssetDirectory(publicId);
  await fs.rm(assetDir, { recursive: true, force: true });
  return { result: "ok" };
}

async function collectResources() {
  const metaFiles = await walkMetaFiles(getMediaRootDir());
  const records = await Promise.all(
    metaFiles.map(async (filePath) => {
      const meta = await loadJson(filePath);
      return normalizeResource(meta);
    })
  );

  return records.sort((left, right) => {
    const leftTime = new Date(left.createdAt || 0).getTime();
    const rightTime = new Date(right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

async function getUsage() {
  const [resources, usedBytes] = await Promise.all([
    collectResources(),
    sumDirectoryBytes(getMediaRootDir()),
  ]);
  const limitBytes = getMediaStorageLimitBytes();

  return {
    driver: "local",
    plan: "Local Storage",
    lastUpdated: new Date().toISOString(),
    storage: {
      usedBytes,
      limitBytes,
      usedPercent: limitBytes ? (usedBytes / limitBytes) * 100 : null,
    },
    bandwidth: {
      usedBytes: null,
      limitBytes: null,
      usedPercent: null,
    },
    requests: null,
    resourcesCount: resources.length,
  };
}

async function listResources({
  nextCursor,
  prefix,
  maxResults = 50,
  resourceType = "image",
} = {}) {
  const normalizedPrefix = String(prefix || "").trim().toLowerCase();
  const normalizedType = String(resourceType || "image").trim().toLowerCase();
  const resources = await collectResources();
  const filtered = resources.filter((resource) => {
    const matchesType =
      normalizedType === "all"
        ? true
        : resource.resourceType === normalizedType;
    if (!matchesType) return false;
    if (!normalizedPrefix) return true;
    return (
      String(resource.publicId || "").toLowerCase().includes(normalizedPrefix) ||
      String(resource.folder || "").toLowerCase().includes(normalizedPrefix)
    );
  });

  const start = Math.max(0, Number.parseInt(nextCursor, 10) || 0);
  const limit = Math.min(Math.max(Number(maxResults) || 50, 1), 500);
  const page = filtered.slice(start, start + limit);

  return {
    resources: page,
    nextCursor: start + limit < filtered.length ? String(start + limit) : null,
  };
}

async function deleteResource(publicId) {
  return deleteAsset(publicId);
}

export const localProvider = {
  name: "local",
  uploadBuffer,
  deleteAsset,
  getUsage,
  listResources,
  deleteResource,
};
