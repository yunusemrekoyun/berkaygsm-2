export const COOKIE_CONSENT_STORAGE_KEY = "cookieConsentPreferences";
export const COOKIE_CONSENT_VERSION = 1;

function normalizeBoolean(value) {
  return value === true;
}

export function createCookieConsent({
  analytics = false,
  status = "customized",
  updatedAt = Date.now(),
} = {}) {
  return {
    version: COOKIE_CONSENT_VERSION,
    status,
    updatedAt,
    preferences: {
      necessary: true,
      analytics: normalizeBoolean(analytics),
    },
  };
}

export function normalizeCookieConsent(value) {
  if (!value || typeof value !== "object") return null;
  if (Number(value.version) !== COOKIE_CONSENT_VERSION) return null;

  return createCookieConsent({
    analytics: value?.preferences?.analytics,
    status: value?.status || "customized",
    updatedAt:
      Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : Date.now(),
  });
}

export function readStoredCookieConsent(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    return normalizeCookieConsent(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeStoredCookieConsent(consent, storage) {
  if (!storage || !consent) return;
  try {
    storage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // ignore storage failures
  }
}

export function hasAnalyticsConsent(consent) {
  return Boolean(consent?.preferences?.analytics);
}
