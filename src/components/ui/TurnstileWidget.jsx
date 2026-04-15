"use client";

import { useEffect, useId, useRef, useState } from "react";

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileScriptPromise = null;

function ensureTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-turnstile-script="true"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(window.turnstile), {
        once: true,
      });
      existing.addEventListener(
        "error",
        () => reject(new Error("Turnstile script load failed")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = "true";
    script.onload = () => resolve(window.turnstile);
    script.onerror = () =>
      reject(new Error("Turnstile script load failed"));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export default function TurnstileWidget({
  siteKey,
  onTokenChange,
  onError,
  resetSignal = 0,
  theme = "auto",
}) {
  const autoId = useId().replace(/:/g, "");
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const onErrorRef = useRef(onError);
  const [loading, setLoading] = useState(Boolean(siteKey));

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;
    let mounted = true;
    setLoading(true);

    ensureTurnstileScript()
      .then((turnstile) => {
        if (!mounted || !turnstile || !containerRef.current) return;

        if (widgetIdRef.current != null) {
          try {
            turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore cleanup issues
          }
          widgetIdRef.current = null;
        }

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          callback: (token) => {
            onTokenChangeRef.current?.(String(token || ""));
          },
          "expired-callback": () => {
            onTokenChangeRef.current?.("");
          },
          "error-callback": () => {
            onTokenChangeRef.current?.("");
            onErrorRef.current?.("Doğrulama yüklenemedi. Lütfen tekrar deneyin.");
          },
        });
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoading(false);
        onTokenChangeRef.current?.("");
        onErrorRef.current?.("Doğrulama servisi yüklenemedi. Lütfen tekrar deneyin.");
      });

    return () => {
      mounted = false;
      const turnstile = window.turnstile;
      if (turnstile && widgetIdRef.current != null) {
        try {
          turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore cleanup issues
        }
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, theme]);

  useEffect(() => {
    if (!siteKey || resetSignal === 0) return;
    const turnstile = window.turnstile;
    if (!turnstile || widgetIdRef.current == null) return;
    try {
      turnstile.reset(widgetIdRef.current);
      onTokenChangeRef.current?.("");
    } catch {
      // ignore reset failures
    }
  }, [resetSignal, siteKey]);

  // Safari restores pages from bfcache (back/forward navigation) with the old
  // React state intact — including an already-used or expired Turnstile token.
  // Reset the widget whenever the page is brought back from bfcache.
  useEffect(() => {
    if (!siteKey) return;
    const handlePageShow = (e) => {
      if (!e.persisted) return;
      onTokenChangeRef.current?.("");
      const turnstile = window.turnstile;
      if (turnstile && widgetIdRef.current != null) {
        try {
          turnstile.reset(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <div className="space-y-2">
      <div
        id={`turnstile-${autoId}`}
        ref={containerRef}
        className="min-h-[66px] rounded-2xl border border-border bg-white/80 p-2"
      />
      {loading ? (
        <p className="text-xs text-secondary/80">Doğrulama yükleniyor…</p>
      ) : null}
    </div>
  );
}
