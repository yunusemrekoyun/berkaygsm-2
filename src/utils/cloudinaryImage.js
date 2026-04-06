const CLOUDINARY_HOST_RE = /^https?:\/\/res\.cloudinary\.com\//i;
const CLOUDINARY_UPLOAD_SEGMENT = "/upload/";
const MANAGED_MEDIA_FILENAME_RE =
  /(\/)(thumb\.webp|card\.webp|large\.webp|original\.[^/?#]+)(?=([?#].*)?$)/i;

function getManagedMediaHostname() {
  const raw =
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
    process.env.MEDIA_PUBLIC_BASE_URL ||
    "https://media.ceplife.com";
  try {
    return new URL(raw).hostname;
  } catch {
    return "media.ceplife.com";
  }
}

function normalizePositiveInt(value, fallback = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

function splitUrl(url) {
  const [withoutHash, hash = ""] = String(url).split("#");
  const [pathname, search = ""] = withoutHash.split("?");
  return {
    pathname,
    search: search ? `?${search}` : "",
    hash: hash ? `#${hash}` : "",
  };
}

export function isCloudinaryImageUrl(url) {
  return (
    typeof url === "string" &&
    CLOUDINARY_HOST_RE.test(url) &&
    url.includes(CLOUDINARY_UPLOAD_SEGMENT)
  );
}

export function isManagedMediaUrl(url) {
  if (typeof url !== "string" || !/^https?:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === getManagedMediaHostname() &&
      MANAGED_MEDIA_FILENAME_RE.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function resolveManagedVariant(width) {
  const safeWidth = normalizePositiveInt(width);
  if (!safeWidth) return "large.webp";
  if (safeWidth <= 220) return "thumb.webp";
  if (safeWidth <= 900) return "card.webp";
  if (safeWidth <= 1800) return "large.webp";
  return null;
}

function optimizeManagedMediaUrl(url, { width } = {}) {
  if (!isManagedMediaUrl(url)) return url;
  const variant = resolveManagedVariant(width);
  if (!variant) return url;
  return String(url).replace(MANAGED_MEDIA_FILENAME_RE, `/${variant}`);
}

export function optimizeCloudinaryImageUrl(
  url,
  { width, quality = 82 } = {}
) {
  if (!isCloudinaryImageUrl(url)) return url;

  const safeWidth = normalizePositiveInt(width);
  const safeQuality = Math.min(
    100,
    Math.max(30, normalizePositiveInt(quality, 82))
  );
  const transformParts = ["f_auto", `q_auto:${safeQuality >= 80 ? "good" : "eco"}`];
  if (safeWidth) {
    transformParts.push("c_limit", `w_${safeWidth}`);
  }

  const { pathname, search, hash } = splitUrl(url);
  const [prefix, suffix] = pathname.split(CLOUDINARY_UPLOAD_SEGMENT);
  if (!suffix) return url;

  const optimizedPath = `${prefix}${CLOUDINARY_UPLOAD_SEGMENT}${transformParts.join(
    ","
  )}/${suffix.replace(/^\/+/, "")}`;

  return `${optimizedPath}${search}${hash}`;
}

export function optimizeManagedImageUrl(url, options = {}) {
  if (isCloudinaryImageUrl(url)) {
    return optimizeCloudinaryImageUrl(url, options);
  }
  if (isManagedMediaUrl(url)) {
    return optimizeManagedMediaUrl(url, options);
  }
  return url;
}

export function cloudinaryImageLoader({ src, width, quality }) {
  return optimizeCloudinaryImageUrl(src, {
    width,
    quality,
  });
}
