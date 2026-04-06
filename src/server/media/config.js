import path from "path";

const DRIVER_RE = /^(cloudinary|local)$/i;

function normalizeDriver(value) {
  if (!value) return "";
  const normalized = String(value).trim().toLowerCase();
  return DRIVER_RE.test(normalized) ? normalized : "";
}

export function hasCloudinaryCredentials() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export function getMediaDriver() {
  const explicit = normalizeDriver(process.env.MEDIA_DRIVER);
  if (explicit) return explicit;
  return hasCloudinaryCredentials() ? "cloudinary" : "local";
}

export function getMediaBaseFolder() {
  return String(process.env.CLOUDINARY_UPLOAD_FOLDER || "berkaygsm")
    .trim()
    .replace(/\/+$/, "");
}

export function resolveScopedFolder(folder = "") {
  const base = getMediaBaseFolder();
  const normalized = String(folder || "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
  return normalized ? `${base}/${normalized}` : base;
}

export function getMediaRootDir() {
  return path.resolve(process.env.MEDIA_ROOT_DIR || "storage/media");
}

export function getMediaTmpDir() {
  return path.resolve(process.env.MEDIA_TMP_DIR || "storage/tmp");
}

export function getMediaPublicBaseUrl() {
  const fallbackSite =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `http://localhost:${process.env.PORT || "3000"}`;
  return String(
    process.env.MEDIA_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
      fallbackSite
  ).replace(/\/+$/, "");
}

export function getMediaStorageLimitBytes() {
  const raw = process.env.MEDIA_STORAGE_LIMIT_BYTES;
  if (raw === undefined || raw === null || raw === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}
