export const ANALYTICS_VISITOR_KEY = "visitVisitorId";
export const ANALYTICS_LEGACY_SESSION_KEY = "visitSessionId";
export const ANALYTICS_SESSION_STATE_KEY = "visitSessionState";
export const ANALYTICS_FIRST_TOUCH_KEY = "visitFirstTouch";
export const ANALYTICS_LAST_TOUCH_KEY = "visitLastTouch";
export const ANALYTICS_LAST_EVENT_KEY = "visitLastEvent";

function removeKey(storage, key) {
  if (!storage || !key) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore storage failures
  }
}

export function clearAnalyticsTrackingStorage() {
  if (typeof window === "undefined") return;

  [
    ANALYTICS_VISITOR_KEY,
    ANALYTICS_LEGACY_SESSION_KEY,
    ANALYTICS_SESSION_STATE_KEY,
    ANALYTICS_FIRST_TOUCH_KEY,
    ANALYTICS_LAST_TOUCH_KEY,
  ].forEach((key) => removeKey(window.localStorage, key));

  removeKey(window.sessionStorage, ANALYTICS_LAST_EVENT_KEY);
}
