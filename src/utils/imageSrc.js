const HTTP_RE = /^https?:\/\//i;
const BLOB_RE = /^blob:/i;
const DATA_RE = /^data:/i;
const ROOT_RE = /^\//;

function sanitizeString(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "[object Object]") return "";
  return trimmed;
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
    return candidate;
  }

  return null;
}
