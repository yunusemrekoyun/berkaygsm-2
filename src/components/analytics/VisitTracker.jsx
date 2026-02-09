"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { analyticsApi } from "../../api/analytics.js";

const SESSION_KEY = "visitSessionId";
const LAST_EVENT_KEY = "visitLastEvent";
const DEDUPE_MS = 2500;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function createSessionId() {
  if (typeof window === "undefined") return "";
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `sid-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getSessionId() {
  if (!canUseStorage()) return "";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = createSessionId();
    if (!next) return "";
    window.localStorage.setItem(SESSION_KEY, next);
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

export default function VisitTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams?.toString() || "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldTrackPath(pathname)) return;

    const sessionId = getSessionId();
    if (!sessionId) return;

    const key = `${pathname}?${query}`;
    const now = Date.now();
    try {
      const raw = window.sessionStorage.getItem(LAST_EVENT_KEY);
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
        LAST_EVENT_KEY,
        JSON.stringify({ key, ts: now })
      );
    } catch {
      // ignore storage parse errors
    }

    analyticsApi
      .trackVisit({
        sessionId,
        path: pathname,
        query,
        referrer: typeof document !== "undefined" ? document.referrer || "" : "",
      })
      .catch(() => {});
  }, [pathname, query]);

  return null;
}
