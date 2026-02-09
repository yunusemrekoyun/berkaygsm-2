import { useEffect, useRef, useState } from "react";
import LoadingOverlay from "./LoadingOverlay.jsx";

export default function GlobalLoadingOverlay({
  label = "Yükleniyor...",
  delayMs = 220,
  minVisibleMs = 320,
}) {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const activeIdsRef = useRef(new Set());
  const showTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const visibleAtRef = useRef(0);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    const activeIds = activeIdsRef.current;

    const clearTimers = () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const shouldIgnore = (detail) => {
      const method = String(detail?.method || "").toUpperCase();
      if (method && method !== "GET") return false;
      const rawPath = String(detail?.path || "");
      const path = rawPath.split("?")[0];
      if (!path) return false;
      if (path === "/campaigns") return true;
      return [
        /^\/categories\/tree$/i,
        /^\/auth\/me$/i,
        /^\/theme$/i,
        /^\/heroes$/i,
        /^\/reviews\/home$/i,
      ].some((re) => re.test(path));
    };

    const handleEvent = (event) => {
      const detail = event?.detail || {};
      if (shouldIgnore(detail)) return;
      const { type, id } = detail;
      if (!id) return;

      if (type === "start") {
        activeIds.add(id);
        if (!visibleRef.current && !showTimerRef.current) {
          showTimerRef.current = setTimeout(() => {
            visibleAtRef.current = Date.now();
            setVisible(true);
            showTimerRef.current = null;
          }, delayMs);
        }
        return;
      }

      if (type === "end") {
        activeIds.delete(id);
        if (activeIds.size > 0) return;

        if (showTimerRef.current) {
          clearTimeout(showTimerRef.current);
          showTimerRef.current = null;
        }

        if (!visibleRef.current) return;

        const elapsed = Date.now() - visibleAtRef.current;
        const remaining = Math.max(0, minVisibleMs - elapsed);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          setVisible(false);
          hideTimerRef.current = null;
        }, remaining);
      }
    };

    window.addEventListener("ui-loading", handleEvent);
    return () => {
      window.removeEventListener("ui-loading", handleEvent);
      clearTimers();
      activeIds.clear();
    };
  }, [delayMs, minVisibleMs]);

  return <LoadingOverlay show={visible} label={label} fullscreen />;
}
