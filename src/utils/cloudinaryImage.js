const CLOUDINARY_HOST_RE = /^https?:\/\/res\.cloudinary\.com\//i;
const CLOUDINARY_UPLOAD_SEGMENT = "/upload/";

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
