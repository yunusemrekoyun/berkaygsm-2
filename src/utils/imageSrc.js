const HTTP_RE = /^https?:\/\//i;
const BLOB_RE = /^blob:/i;
const DATA_RE = /^data:/i;
const ROOT_RE = /^\//;
const DEFAULT_MANAGED_MEDIA_HOST = "media.ceplife.com";

function sanitizeString(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "[object Object]") return "";
  return trimmed;
}

function getManagedMediaBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
    process.env.MEDIA_PUBLIC_BASE_URL ||
    `https://${DEFAULT_MANAGED_MEDIA_HOST}`;

  try {
    return new URL(raw).origin;
  } catch {
    return `https://${DEFAULT_MANAGED_MEDIA_HOST}`;
  }
}

function rewriteManagedMediaOrigin(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== DEFAULT_MANAGED_MEDIA_HOST) {
      return url;
    }

    const target = new URL(getManagedMediaBaseUrl());
    parsed.protocol = target.protocol;
    parsed.host = target.host;
    return parsed.toString();
  } catch {
    return url;
  }
}

export function resolveImageSrc(value) {
  if (!value) return null;

  if (typeof value === "object") {
    const nested =
      value.url ??
      value.src ??
      value.secureUrl ??
      value.secure_url ??
      null;
    return resolveImageSrc(nested);
  }

  const candidate = sanitizeString(value);
  if (!candidate) return null;

  if (
    HTTP_RE.test(candidate) ||
    BLOB_RE.test(candidate) ||
    DATA_RE.test(candidate) ||
    ROOT_RE.test(candidate)
  ) {
    return HTTP_RE.test(candidate)
      ? rewriteManagedMediaOrigin(candidate)
      : candidate;
  }

  return null;
}
