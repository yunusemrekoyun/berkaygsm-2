function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function normalizeAssetPayload(value) {
  if (!value || typeof value !== "object") return null;
  const url = value.url || value.secure_url || value.secureUrl || "";
  const publicId =
    value.publicId || value.public_id || value.publicID || "";
  if (!url || !publicId) return null;
  return {
    url,
    publicId,
    width: value.width ?? value.w,
    height: value.height ?? value.h,
    format: value.format,
    posterUrl: value.posterUrl ?? value.poster_url,
    resourceType: value.resourceType || value.resource_type,
    bytes: value.bytes,
    duration: value.duration,
  };
}

export function extractAssetList(input) {
  if (!input) return [];
  const items = Array.isArray(input) ? input : [input];
  const results = [];
  items.forEach((item) => {
    const parsed = parseMaybeJson(item);
    if (Array.isArray(parsed)) {
      parsed.forEach((entry) => {
        const normalized = normalizeAssetPayload(entry);
        if (normalized) results.push(normalized);
      });
    } else {
      const normalized = normalizeAssetPayload(parsed);
      if (normalized) results.push(normalized);
    }
  });
  return results;
}

export function extractSingleAsset(input) {
  const list = extractAssetList(input);
  return list[0] || null;
}
