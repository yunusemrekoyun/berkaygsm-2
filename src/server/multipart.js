import { Buffer } from "buffer";

const isFileLike = (value) =>
  value && typeof value === "object" && typeof value.arrayBuffer === "function";

function coerceFieldValue(fields, key, value) {
  if (fields[key] === undefined) {
    fields[key] = value;
    return;
  }
  if (Array.isArray(fields[key])) {
    fields[key].push(value);
    return;
  }
  fields[key] = [fields[key], value];
}

export async function parseMultipart(request) {
  const formData = await request.formData();
  const fields = {};
  const filesByField = {};

  for (const [key, value] of formData.entries()) {
    if (isFileLike(value)) {
      const buffer = Buffer.from(await value.arrayBuffer());
      const file = {
        fieldname: key,
        originalname: value.name || "file",
        mimetype: value.type || "application/octet-stream",
        size: value.size || buffer.length,
        buffer,
      };
      if (!filesByField[key]) filesByField[key] = [];
      filesByField[key].push(file);
    } else {
      coerceFieldValue(fields, key, String(value));
    }
  }

  return { fields, filesByField };
}

export function flattenFiles(filesByField = {}) {
  return Object.values(filesByField).flat();
}

export function assertUploadLimits(filesByField = {}, options = {}) {
  const {
    maxFiles = null,
    maxFileSizeMb = null,
    allowedMime = null,
  } = options;

  const files = flattenFiles(filesByField);

  if (maxFiles != null && files.length > maxFiles) {
    const error = new Error("Too many files uploaded");
    error.status = 413;
    throw error;
  }

  if (maxFileSizeMb != null) {
    const maxBytes = maxFileSizeMb * 1024 * 1024;
    for (const file of files) {
      if (file.size > maxBytes) {
        const error = new Error(
          `File too large. Max ${maxFileSizeMb}MB allowed.`
        );
        error.status = 413;
        throw error;
      }
    }
  }

  if (allowedMime) {
    const checker =
      typeof allowedMime === "function"
        ? allowedMime
        : (mime) => allowedMime.includes(mime);
    for (const file of files) {
      if (!checker(file.mimetype)) {
        const error = new Error("Unsupported file type");
        error.status = 415;
        throw error;
      }
    }
  }
}

export function applyUploadMode(targetReq, filesByField = {}, upload = {}) {
  const { type, field } = upload || {};

  if (type === "single") {
    targetReq.file = filesByField[field]?.[0] || null;
    return;
  }

  if (type === "array") {
    targetReq.files = filesByField[field] || [];
    return;
  }

  if (type === "fields") {
    const result = {};
    (upload.fields || []).forEach((entry) => {
      if (!entry?.name) return;
      result[entry.name] = filesByField[entry.name] || [];
    });
    targetReq.files = result;
    return;
  }

  // default: attach raw map and flat array
  targetReq.files = filesByField;
}
