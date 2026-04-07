import { createHash, randomUUID } from "crypto";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { IMAGE_VARIANTS } from "../constants.js";
import {
  getMediaPublicBaseUrl,
  getMediaRootDir,
  getMediaStorageLimitBytes,
  getMediaTmpDir,
} from "../config.js";

const META_FILE = "meta.json";
const VIDEO_FILENAME = "video.mp4";
const VIDEO_POSTER_FILENAME = "poster.webp";
const VIDEO_MAX_WIDTH = 1280;

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

function resolveExtension({
  originalName = "",
  mimeType = "",
  resourceType = "image",
} = {}) {
  const fromMime = MIME_EXTENSION_MAP[String(mimeType || "").toLowerCase()];
  if (fromMime) return fromMime;
  const parsed = path.extname(String(originalName || "")).toLowerCase();
  if (parsed) return parsed;
  return resourceType === "video" ? ".mp4" : ".jpg";
}

function buildAssetDirectory(publicId) {
  return path.join(
    getMediaRootDir(),
    ...String(publicId).split("/").filter(Boolean),
  );
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

function resolveAssetTarget(buffer, options = {}) {
  const rawExplicitPublicId = options.publicId || options.public_id || "";
  const explicitPublicId = rawExplicitPublicId
    ? normalizeFolder(rawExplicitPublicId)
    : "";

  if (explicitPublicId) {
    return {
      publicId: explicitPublicId,
      folder: extractFolder(explicitPublicId) || "media",
    };
  }

  const folder = normalizeFolder(options.folder || "media");
  const assetId = buildAssetId(buffer, folder, options.originalName);

  return {
    publicId: `${folder}/${assetId}`,
    folder,
  };
}

function normalizeResource(resource = {}) {
  const secureUrl =
    resource.secureUrl || resource.secure_url || resource.url || "";
  const publicId = resource.publicId || resource.public_id || "";
  const resourceType =
    resource.resourceType || resource.resource_type || "image";
  return {
    url: secureUrl,
    secureUrl,
    secure_url: secureUrl,
    posterUrl: resource.posterUrl || resource.poster_url || null,
    poster_url: resource.poster_url || resource.posterUrl || null,
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
    createdAt:
      resource.createdAt || resource.created_at || new Date().toISOString(),
    type: "upload",
  };
}

async function ensureDirectory(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function prepareAssetDirectory(publicId) {
  const assetDir = buildAssetDirectory(publicId);
  await fs.rm(assetDir, { recursive: true, force: true });
  await ensureDirectory(assetDir);
  return assetDir;
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function runBinary(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${command} exited with code ${code}${
            stderr ? `: ${stderr.trim()}` : ""
          }`,
        ),
      );
    });
  });
}

async function ensureTmpDirectory() {
  const root = path.join(getMediaTmpDir(), "local-provider");
  await ensureDirectory(root);
  return root;
}

async function createTempWorkspace() {
  const root = await ensureTmpDirectory();
  return fs.mkdtemp(path.join(root, `${randomUUID()}-`));
}

async function probeVideoFile(filePath) {
  const { stdout } = await runBinary("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_entries",
    "format=duration:stream=codec_type,width,height",
    filePath,
  ]);

  const parsed = JSON.parse(stdout || "{}");
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const videoStream = streams.find(
    (stream) => String(stream?.codec_type || "").toLowerCase() === "video",
  );

  return {
    width: Number(videoStream?.width || 0) || null,
    height: Number(videoStream?.height || 0) || null,
    duration: Number(parsed?.format?.duration || 0) || null,
  };
}

function buildVideoScaleFilter(maxWidth = VIDEO_MAX_WIDTH) {
  return `scale=w='min(${maxWidth},iw)':h=-2:force_original_aspect_ratio=decrease`;
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
  const { publicId, folder } = resolveAssetTarget(buffer, options);
  const assetDir = await prepareAssetDirectory(publicId);
  const originalExtension = resolveExtension({
    originalName: options.originalName,
    mimeType: options.mimeType,
    resourceType: "image",
  });
  const originalFilename = `original${originalExtension}`;

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
    }),
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
  const { publicId, folder } = resolveAssetTarget(buffer, options);
  const assetDir = await prepareAssetDirectory(publicId);
  const extension = resolveExtension({
    originalName: options.originalName,
    mimeType: options.mimeType,
    resourceType: "video",
  });
  const originalFilename = `original${extension}`;
  const originalPath = path.join(assetDir, originalFilename);
  const optimizedPath = path.join(assetDir, VIDEO_FILENAME);
  const posterPath = path.join(assetDir, VIDEO_POSTER_FILENAME);
  const workspace = await createTempWorkspace();
  const inputPath = path.join(workspace, `source${extension}`);
  const posterSourcePath = path.join(workspace, "poster.jpg");

  await fs.writeFile(originalPath, buffer);
  await fs.writeFile(inputPath, buffer);

  let posterUrl = null;

  try {
    await runBinary("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-vf",
      buildVideoScaleFilter(),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "24",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ac",
      "2",
      optimizedPath,
    ]);

    try {
      await runBinary("ffmpeg", [
        "-y",
        "-ss",
        "0",
        "-i",
        optimizedPath,
        "-frames:v",
        "1",
        "-vf",
        buildVideoScaleFilter(960),
        posterSourcePath,
      ]);

      await sharp(posterSourcePath).webp({ quality: 82 }).toFile(posterPath);

      posterUrl = buildPublicUrl(publicId, VIDEO_POSTER_FILENAME);
    } catch {
      posterUrl = null;
    }

    const [videoStats, videoMeta] = await Promise.all([
      fs.stat(optimizedPath),
      probeVideoFile(optimizedPath),
    ]);

    const asset = normalizeResource({
      url: buildPublicUrl(publicId, VIDEO_FILENAME),
      posterUrl,
      publicId,
      width: videoMeta.width,
      height: videoMeta.height,
      duration: videoMeta.duration,
      format: "mp4",
      bytes: videoStats.size,
      resourceType: "video",
      folder,
      createdAt: new Date().toISOString(),
    });

    await writeJson(path.join(assetDir, META_FILE), {
      ...asset,
      originalFilename,
      optimizedFilename: VIDEO_FILENAME,
      posterFilename: posterUrl ? VIDEO_POSTER_FILENAME : null,
      originalUrl: buildPublicUrl(publicId, originalFilename),
    });

    return asset;
  } finally {
    await fs.rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
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
    }),
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
  const normalizedPrefix = String(prefix || "")
    .trim()
    .toLowerCase();
  const normalizedType = String(resourceType || "image")
    .trim()
    .toLowerCase();
  const resources = await collectResources();
  const filtered = resources.filter((resource) => {
    const matchesType =
      normalizedType === "all"
        ? true
        : resource.resourceType === normalizedType;
    if (!matchesType) return false;
    if (!normalizedPrefix) return true;
    return (
      String(resource.publicId || "")
        .toLowerCase()
        .includes(normalizedPrefix) ||
      String(resource.folder || "")
        .toLowerCase()
        .includes(normalizedPrefix)
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
