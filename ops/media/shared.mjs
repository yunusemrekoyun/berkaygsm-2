import { existsSync } from "fs";
import { promises as fs } from "fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { connectDB } from "../../src/server/config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, "../..");

function stripWrappingQuotes(value) {
  const trimmed = String(value ?? "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) return null;

  const key = trimmed.slice(0, separatorIndex).trim();
  const rawValue = trimmed.slice(separatorIndex + 1);

  if (!key) return null;

  return {
    key,
    value: stripWrappingQuotes(rawValue),
  };
}

function resolveCandidatePath(value) {
  if (!value) return null;
  if (path.isAbsolute(value)) return value;
  return path.resolve(process.cwd(), value);
}

export function resolveEnvFile(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.APP_ENV_FILE,
    "/srv/ceplife/shared/.env",
    path.resolve(REPO_ROOT, ".env"),
  ]
    .map(resolveCandidatePath)
    .filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) || null;
}

export async function loadEnvFile(explicitPath) {
  const envFile = resolveEnvFile(explicitPath);
  if (!envFile) return null;

  const raw = await fs.readFile(envFile, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const parsed = parseEnvLine(line);
    if (!parsed) return;
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  });

  return envFile;
}

export async function bootstrapRuntime({ envFile } = {}) {
  const loadedEnvFile = await loadEnvFile(envFile);
  await connectDB();
  return { envFile: loadedEnvFile };
}

export function parseCliArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      args._.push(current);
      continue;
    }

    const withoutPrefix = current.slice(2);
    const equalsIndex = withoutPrefix.indexOf("=");

    if (equalsIndex >= 0) {
      const key = withoutPrefix.slice(0, equalsIndex);
      const value = withoutPrefix.slice(equalsIndex + 1);
      args[key] = value;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[withoutPrefix] = next;
      index += 1;
      continue;
    }

    args[withoutPrefix] = true;
  }

  return args;
}

export function parseBooleanArg(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

export function parsePositiveInt(value, fallback = null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function parseListArg(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function resolveManifestPath(filePath, fallbackName) {
  const explicit = filePath || process.env.MEDIA_MIGRATION_MANIFEST;
  if (explicit) return resolveCandidatePath(explicit);
  return path.resolve(process.cwd(), "storage", fallbackName);
}

export async function loadManifest(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      version: 1,
      updatedAt: parsed.updatedAt || null,
      items: parsed.items && typeof parsed.items === "object" ? parsed.items : {},
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        version: 1,
        updatedAt: null,
        items: {},
      };
    }
    throw error;
  }
}

export async function saveManifest(filePath, manifest) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    items: manifest.items || {},
  };
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

export function getManifestItem(manifest, key) {
  return manifest?.items?.[key] || null;
}

export function setManifestItem(manifest, key, payload) {
  manifest.items = manifest.items || {};
  manifest.items[key] = {
    ...(manifest.items[key] || {}),
    ...payload,
    updatedAt: new Date().toISOString(),
  };
  return manifest.items[key];
}

export function getMediaHostname() {
  const raw =
    process.env.MEDIA_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
    "https://media.ceplife.com";

  try {
    return new URL(raw).hostname;
  } catch {
    return "media.ceplife.com";
  }
}

export function isManagedMediaUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    return new URL(url).hostname === getMediaHostname();
  } catch {
    return false;
  }
}

export function guessOriginalName(url, fallbackName = "asset.bin") {
  if (!url || typeof url !== "string") return fallbackName;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    return last ? decodeURIComponent(last) : fallbackName;
  } catch {
    return fallbackName;
  }
}

export async function downloadAsset(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get("content-type")?.split(";")[0] || "";

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType,
    originalName: guessOriginalName(url),
  };
}

export function toStoredMedia(
  asset,
  {
    includeDuration = false,
    includePoster = false,
    includeBytes = false,
    includeResourceType = false,
  } = {}
) {
  const output = {
    url: asset.url,
    publicId: asset.publicId,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
    format: asset.format ?? undefined,
  };

  if (includePoster && asset.posterUrl) {
    output.posterUrl = asset.posterUrl;
  }
  if (includeDuration && asset.duration != null) {
    output.duration = asset.duration;
  }
  if (includeBytes && asset.bytes != null) {
    output.bytes = asset.bytes;
  }
  if (includeResourceType && asset.resourceType) {
    output.resourceType = asset.resourceType;
  }

  return output;
}

export function printScriptHeader(title, details = {}) {
  console.log(`\n== ${title} ==`);
  Object.entries(details).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
  console.log("");
}
