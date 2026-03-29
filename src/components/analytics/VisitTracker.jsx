"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { analyticsApi } from "../../api/analytics.js";
import {
  ANALYTICS_FIRST_TOUCH_KEY,
  ANALYTICS_LAST_EVENT_KEY,
  ANALYTICS_LAST_TOUCH_KEY,
  ANALYTICS_LEGACY_SESSION_KEY,
  ANALYTICS_SESSION_STATE_KEY,
  ANALYTICS_VISITOR_KEY,
} from "../../utils/analyticsTrackingStorage.js";
import {
  classifyTrafficSource,
  extractCampaignParams,
  isLoopbackHost,
  normalizeComparableHost,
  parseReferrerMeta,
} from "../../utils/visitAttribution.js";

const DEDUPE_MS = 2500;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function createId(prefix = "sid") {
  if (typeof window === "undefined") return "";
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function readJson(storage, key) {
  if (!storage) return null;
  try {
    return JSON.parse(storage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeJson(storage, key, value) {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage write errors
  }
}

function getVisitorId() {
  if (!canUseStorage()) return "";
  try {
    const existing = window.localStorage.getItem(ANALYTICS_VISITOR_KEY);
    if (existing) return existing;

    const legacy = window.localStorage.getItem(ANALYTICS_LEGACY_SESSION_KEY);
    if (legacy) {
      window.localStorage.setItem(ANALYTICS_VISITOR_KEY, legacy);
      return legacy;
    }

    const next = createId("vid");
    if (!next) return "";
    window.localStorage.setItem(ANALYTICS_VISITOR_KEY, next);
    return next;
  } catch {
    return "";
  }
}

function shouldTrackPath(pathname) {
  if (!pathname) return false;
  if (!pathname.startsWith("/")) return false;
  if (pathname.startsWith("/admin")) return false;
  if (pathname.startsWith("/api")) return false;
  return true;
}

function shouldSkipTracking(pathname, referrer) {
  if (typeof window === "undefined") return true;
  if (!shouldTrackPath(pathname)) return true;
  if (isLoopbackHost(window.location.hostname)) return true;

  const referrerMeta = parseReferrerMeta(referrer);
  const currentHost = normalizeComparableHost(window.location.host);
  if (
    referrerMeta.comparableHost &&
    currentHost &&
    referrerMeta.comparableHost === currentHost &&
    referrerMeta.pathname.startsWith("/admin")
  ) {
    return true;
  }

  return false;
}

function scheduleVisitTrack(callback) {
  if (typeof window === "undefined") return () => {};

  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: 1500 });
    return () => window.cancelIdleCallback?.(id);
  }

  const timeoutId = window.setTimeout(callback, 900);
  return () => window.clearTimeout(timeoutId);
}

function buildTouchSnapshot({ source, utmMedium = "", utmCampaign = "" } = {}) {
  return {
    source: String(source || "").trim(),
    medium: String(utmMedium || "").trim(),
    campaign: String(utmCampaign || "").trim(),
  };
}

function resolveSessionState({ pathname, query, attribution, now }) {
  const storage = window.localStorage;
  const current = readJson(storage, ANALYTICS_SESSION_STATE_KEY);
  const lastSeenAt = Number(current?.lastSeenAt || 0);
  const expired =
    !current?.id || !Number.isFinite(lastSeenAt) || now - lastSeenAt > SESSION_TIMEOUT_MS;

  const nextState = expired
    ? {
        id: createId("sid"),
        startedAt: now,
        lastSeenAt: now,
        entryPath: pathname,
        entryQuery: query,
        source: attribution.source,
        utmSource: attribution.utmSource,
        utmMedium: attribution.utmMedium,
        utmCampaign: attribution.utmCampaign,
        utmTerm: attribution.utmTerm,
        utmContent: attribution.utmContent,
        clickId: attribution.clickId,
        clickIdType: attribution.clickIdType,
      }
    : {
        ...current,
        lastSeenAt: now,
      };

  writeJson(storage, ANALYTICS_SESSION_STATE_KEY, nextState);
  return { session: nextState, isEntry: expired };
}

export default function VisitTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams?.toString() || "";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const referrer = typeof document !== "undefined" ? document.referrer || "" : "";
    if (shouldSkipTracking(pathname, referrer)) return;

    const visitorId = getVisitorId();
    if (!visitorId) return;

    const key = `${pathname}?${query}`;
    const now = Date.now();
    try {
      const raw = window.sessionStorage.getItem(ANALYTICS_LAST_EVENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed?.key === key &&
          Number.isFinite(parsed?.ts) &&
          now - parsed.ts < DEDUPE_MS
        ) {
          return;
        }
      }
      window.sessionStorage.setItem(
        ANALYTICS_LAST_EVENT_KEY,
        JSON.stringify({ key, ts: now })
      );
    } catch {
      // ignore storage parse errors
    }

    const campaign = extractCampaignParams(query);
    const attribution = {
      ...campaign,
      source: classifyTrafficSource({
        referrer,
        currentHost: window.location.host,
        utmSource: campaign.utmSource,
        utmMedium: campaign.utmMedium,
        clickIdType: campaign.clickIdType,
      }),
    };

    const { session, isEntry } = resolveSessionState({
      pathname,
      query,
      attribution,
      now,
    });
    if (!session?.id) return;

    const storage = window.localStorage;
    const firstTouch = readJson(storage, ANALYTICS_FIRST_TOUCH_KEY);
    if (!firstTouch?.source) {
      writeJson(
        storage,
        ANALYTICS_FIRST_TOUCH_KEY,
        buildTouchSnapshot(attribution)
      );
    }
    if (isEntry) {
      writeJson(
        storage,
        ANALYTICS_LAST_TOUCH_KEY,
        buildTouchSnapshot(attribution)
      );
    }

    const resolvedFirstTouch =
      readJson(storage, ANALYTICS_FIRST_TOUCH_KEY) ||
      buildTouchSnapshot(attribution);
    const resolvedLastTouch =
      readJson(storage, ANALYTICS_LAST_TOUCH_KEY) ||
      buildTouchSnapshot(attribution);

    const cancel = scheduleVisitTrack(() => {
      analyticsApi
        .trackVisit({
          visitorId,
          sessionId: session.id,
          isEntry,
          path: pathname,
          query,
          referrer,
          source: session.source || attribution.source,
          utmSource: session.utmSource || "",
          utmMedium: session.utmMedium || "",
          utmCampaign: session.utmCampaign || "",
          utmTerm: session.utmTerm || "",
          utmContent: session.utmContent || "",
          clickId: session.clickId || "",
          clickIdType: session.clickIdType || "",
          firstTouchSource: resolvedFirstTouch.source || "",
          firstTouchMedium: resolvedFirstTouch.medium || "",
          firstTouchCampaign: resolvedFirstTouch.campaign || "",
          lastTouchSource: resolvedLastTouch.source || "",
          lastTouchMedium: resolvedLastTouch.medium || "",
          lastTouchCampaign: resolvedLastTouch.campaign || "",
        })
        .catch(() => {});
    });

    return cancel;
  }, [pathname, query]);

  return null;
}
