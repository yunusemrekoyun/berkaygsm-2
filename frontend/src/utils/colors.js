import {
  COLOR_PALETTE,
  COLOR_NAME_LOOKUP,
  COLOR_VALUE_LOOKUP,
} from "../constants/colorPalette.js";
import {
  DEFAULT_LANG,
  normalizeLang,
} from "../constants/lang.js";

const HEX_REGEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value) {
  if (typeof value !== "string") return false;
  return HEX_REGEX.test(value.trim());
}

function expandHex(hex) {
  if (!hex) return null;
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length === 3) {
    return cleaned
      .split("")
      .map((char) => char + char)
      .join("")
      .toUpperCase();
  }
  if (cleaned.length === 6) {
    return cleaned.toUpperCase();
  }
  return null;
}

export function normalizeColorValue(input) {
  if (input === undefined || input === null) return null;
  const value = String(input).trim();
  if (!value) return null;

  const paletteByName = COLOR_NAME_LOOKUP.get(value.toLowerCase());
  if (paletteByName) return paletteByName.value.toUpperCase();

  const paletteByValue = COLOR_VALUE_LOOKUP.get(value.toUpperCase());
  if (paletteByValue) return paletteByValue.value.toUpperCase();

  if (isHexColor(value)) {
    const expanded = expandHex(value);
    return expanded ? `#${expanded}` : null;
  }

  return value;
}

export function dedupeColors(list = []) {
  const seen = new Set();
  const result = [];
  list.forEach((item) => {
    const normalized = normalizeColorValue(item);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });
  return result;
}

function resolveColorLabel(entry, lang) {
  if (!entry) return "";
  const labels = entry.labels || {};
  return (
    labels[lang] ||
    labels[DEFAULT_LANG] ||
    labels.en ||
    entry.name ||
    ""
  );
}

export function getColorInfo(rawValue, lang = DEFAULT_LANG) {
  const normalizedLang = normalizeLang(lang);
  const normalized = normalizeColorValue(rawValue);
  if (!normalized) {
    const fallbackValue = rawValue ?? "";
    return {
      value: fallbackValue || null,
      label: String(fallbackValue || ""),
      swatch: String(fallbackValue || ""),
      isHex: isHexColor(fallbackValue),
    };
  }

  const paletteMatch = COLOR_VALUE_LOOKUP.get(normalized.toUpperCase());
  const label = paletteMatch
    ? resolveColorLabel(paletteMatch, normalizedLang)
    : String(rawValue || normalized);
  const swatch = paletteMatch?.value || (isHexColor(normalized) ? normalized : "");

  return {
    value: paletteMatch?.value || normalized,
    label,
    swatch,
    isHex: isHexColor(swatch),
  };
}

export function colorListToInfo(list = [], lang = DEFAULT_LANG) {
  return dedupeColors(list).map((value) => getColorInfo(value, lang));
}

export function formatColorLabel(value, lang = DEFAULT_LANG) {
  const info = getColorInfo(value, lang);
  return info.label;
}

export { COLOR_PALETTE };
