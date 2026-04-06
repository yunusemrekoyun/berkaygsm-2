import { http } from "./client.js";

const isFileLike = (value) =>
  typeof File !== "undefined" &&
  (value instanceof File || value instanceof Blob);

const extractFile = (value) => {
  if (!value) return null;
  if (isFileLike(value)) return value;
  if (value.originalFile && isFileLike(value.originalFile)) return value.originalFile;
  if (value.file && isFileLike(value.file)) return value.file;
  return null;
};

const normalizeAsset = (value) => {
  if (!value || typeof value !== "object") return null;
  const url = value.url || value.secure_url || value.secureUrl;
  const publicId = value.publicId || value.public_id || value.publicID;
  if (!url || !publicId) return null;
  return {
    url,
    publicId,
    width: value.width,
    height: value.height,
    format: value.format,
    resourceType: value.resourceType || value.resource_type,
    bytes: value.bytes,
    duration: value.duration,
  };
};

const resolveResourceType = (file) => {
  const type = file?.type || "";
  return type.startsWith("video/") ? "video" : "image";
};

async function uploadWithApi(file, { scope, resourceType }) {
  const form = new FormData();
  form.append("file", file);
  if (scope) form.append("scope", scope);
  if (resourceType) form.append("resourceType", resourceType);
  const result = await http("/media/upload", {
    method: "POST",
    auth: true,
    body: form,
  });
  return normalizeAsset(result?.asset || result);
}

export async function uploadAsset(value, { scope } = {}) {
  const existing = normalizeAsset(value);
  if (existing) return existing;
  const file = extractFile(value);
  if (!file) return null;
  return uploadWithApi(file, {
    scope,
    resourceType: resolveResourceType(file),
  });
}

export async function uploadAssets(values = [], { scope } = {}) {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  const existing = [];
  const filesByType = new Map();

  list.forEach((value) => {
    const normalized = normalizeAsset(value);
    if (normalized) {
      existing.push(normalized);
      return;
    }
    const file = extractFile(value);
    if (file) {
      const resourceType = resolveResourceType(file);
      if (!filesByType.has(resourceType)) {
        filesByType.set(resourceType, []);
      }
      filesByType.get(resourceType).push(file);
    }
  });

  const uploaded = [];
  for (const [resourceType, files] of filesByType.entries()) {
    const results = await Promise.all(
      files.map((file) => uploadWithApi(file, { scope, resourceType }))
    );
    uploaded.push(...results);
  }

  return [...existing, ...uploaded];
}

export function appendAsset(form, field, asset) {
  if (!asset) return;
  form.append(field, JSON.stringify(asset));
}

export function appendAssetList(form, field, assets = []) {
  (assets || []).forEach((asset) => {
    if (!asset) return;
    form.append(field, JSON.stringify(asset));
  });
}
