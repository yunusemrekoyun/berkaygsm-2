export const VISIT_SOURCE_KEYS = [
  "direct",
  "organic",
  "social",
  "referral",
  "paid",
  "email",
  "internal",
  "other",
];

const SOCIAL_HOST_FRAGMENTS = [
  "facebook.",
  "instagram.",
  "tiktok.",
  "twitter.",
  "x.com",
  "youtube.",
  "linkedin.",
  "pinterest.",
  "t.me",
  "telegram.",
  "whatsapp.",
];

const SEARCH_HOST_FRAGMENTS = [
  "google.",
  "bing.",
  "duckduckgo.",
  "yahoo.",
  "yandex.",
];

const PAID_HOST_FRAGMENTS = ["doubleclick.", "adservice.", "ads."];
const PAID_MEDIUM_FRAGMENTS = [
  "cpc",
  "ppc",
  "paid",
  "paid_social",
  "display",
  "banner",
  "affiliate",
  "retargeting",
  "remarketing",
  "sponsored",
  "cpm",
];
const SOCIAL_MEDIUM_FRAGMENTS = ["social", "social_media", "social-media", "socialnetwork"];
const EMAIL_MEDIUM_FRAGMENTS = ["email", "e-mail", "newsletter"];
const CLICK_ID_KEYS = [
  "gclid",
  "fbclid",
  "ttclid",
  "msclkid",
  "twclid",
  "li_fat_id",
];

function includesAny(value, fragments = []) {
  const normalized = String(value || "").toLowerCase();
  if (!normalized) return false;
  return fragments.some((fragment) => normalized.includes(fragment));
}

export function normalizeComparableHost(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/^www\./, "");
}

export function isLoopbackHost(value = "") {
  const host = normalizeComparableHost(value);
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".local")
  );
}

export function parseReferrerMeta(referrerRaw = "") {
  const referrer = String(referrerRaw || "").trim();
  if (!referrer) {
    return {
      referrer: "",
      host: "",
      pathname: "",
      comparableHost: "",
      isValid: false,
    };
  }

  try {
    const url = new URL(referrer);
    return {
      referrer,
      host: url.host || "",
      pathname: url.pathname || "",
      comparableHost: normalizeComparableHost(url.host || ""),
      isValid: true,
    };
  } catch {
    return {
      referrer,
      host: "",
      pathname: "",
      comparableHost: "",
      isValid: false,
    };
  }
}

export function extractCampaignParams(search = "") {
  const params =
    search instanceof URLSearchParams
      ? search
      : new URLSearchParams(String(search || "").replace(/^\?/, ""));

  let clickId = "";
  let clickIdType = "";
  for (const key of CLICK_ID_KEYS) {
    const value = String(params.get(key) || "").trim();
    if (value) {
      clickId = value;
      clickIdType = key;
      break;
    }
  }

  return {
    utmSource: String(params.get("utm_source") || "").trim(),
    utmMedium: String(params.get("utm_medium") || "").trim(),
    utmCampaign: String(params.get("utm_campaign") || "").trim(),
    utmTerm: String(params.get("utm_term") || "").trim(),
    utmContent: String(params.get("utm_content") || "").trim(),
    clickId,
    clickIdType,
  };
}

export function classifyTrafficSource({
  rawSource = "",
  referrer = "",
  currentHost = "",
  utmSource = "",
  utmMedium = "",
  clickIdType = "",
} = {}) {
  const normalizedSource = String(rawSource || "")
    .trim()
    .toLowerCase();
  if (VISIT_SOURCE_KEYS.includes(normalizedSource)) return normalizedSource;

  const normalizedMedium = String(utmMedium || "")
    .trim()
    .toLowerCase();
  const normalizedUtmSource = String(utmSource || "")
    .trim()
    .toLowerCase();
  const referrerMeta = parseReferrerMeta(referrer);
  const currentComparableHost = normalizeComparableHost(currentHost);

  if (
    includesAny(normalizedMedium, EMAIL_MEDIUM_FRAGMENTS) ||
    normalizedUtmSource === "email"
  ) {
    return "email";
  }

  if (
    clickIdType ||
    includesAny(normalizedMedium, PAID_MEDIUM_FRAGMENTS) ||
    normalizedMedium === "cpc" ||
    normalizedMedium === "ppc"
  ) {
    return "paid";
  }

  if (
    includesAny(normalizedMedium, SOCIAL_MEDIUM_FRAGMENTS) ||
    includesAny(normalizedUtmSource, SOCIAL_HOST_FRAGMENTS) ||
    includesAny(referrerMeta.comparableHost, SOCIAL_HOST_FRAGMENTS)
  ) {
    return "social";
  }

  if (
    normalizedMedium === "organic" ||
    includesAny(normalizedUtmSource, SEARCH_HOST_FRAGMENTS) ||
    includesAny(normalizedUtmSource, ["google", "bing", "duckduckgo", "yahoo", "yandex"])
  ) {
    return "organic";
  }

  if (
    referrerMeta.comparableHost &&
    currentComparableHost &&
    referrerMeta.comparableHost === currentComparableHost
  ) {
    return "internal";
  }

  if (includesAny(referrerMeta.comparableHost, PAID_HOST_FRAGMENTS)) {
    return "paid";
  }

  if (includesAny(referrerMeta.comparableHost, SOCIAL_HOST_FRAGMENTS)) {
    return "social";
  }

  if (includesAny(referrerMeta.comparableHost, SEARCH_HOST_FRAGMENTS)) {
    return "organic";
  }

  if (!referrerMeta.referrer) return "direct";
  if (!referrerMeta.isValid) return "other";
  return "referral";
}
