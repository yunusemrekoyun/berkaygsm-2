"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

const ensureRegistered = () => {
  if (registered) return;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true, limitCallbacks: true });
  registered = true;
};

const prefersReducedMotion = () => {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const collectTargets = () => {
  const elements = new Set();
  document.querySelectorAll("[data-animate]").forEach((el) => {
    if (el.dataset.animate === "none") return;
    elements.add(el);
  });
  document.querySelectorAll(".app-section").forEach((el) => {
    if (el.dataset.animate === "none") return;
    elements.add(el);
  });
  return Array.from(elements);
};

const readNumber = (el, keys, fallback) => {
  for (const key of keys) {
    const raw = el.dataset?.[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
};

const readString = (el, keys, fallback) => {
  for (const key of keys) {
    const raw = el.dataset?.[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return fallback;
};

const readBoolean = (el, keys, fallback = false) => {
  for (const key of keys) {
    const raw = el.dataset?.[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const normalized = String(raw).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const resolveStaggerTargets = (el, selector) => {
  if (!el) return [];
  const fallback = el.children || [];
  const raw = typeof selector === "string" ? selector.trim() : "";
  if (!raw) return fallback;
  if (raw === "> *" || raw === ">*") return fallback;
  const scoped = raw.startsWith(">") ? `:scope ${raw}` : raw;
  try {
    const nodes = el.querySelectorAll(scoped);
    return nodes.length ? nodes : fallback;
  } catch {
    return fallback;
  }
};

export default function GsapScrollProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams ? searchParams.toString() : "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prefersReducedMotion()) return;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    let rafA = null;
    let rafB = null;
    let timeoutId = null;
    let idleId = null;
    let observerTimeoutId = null;
    let observer = null;
    let ctx = null;

    const scheduleRun = (fn) => {
      const kickoff = () => {
        if (typeof window.requestIdleCallback === "function") {
          idleId = window.requestIdleCallback(
            () => {
              fn();
            },
            { timeout: 500 }
          );
          return;
        }
        timeoutId = window.setTimeout(fn, 120);
      };

      if (document.readyState === "complete") {
        kickoff();
        return () => {};
      }

      const onLoad = () => kickoff();
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    };

    const hasPendingSkeleton = () =>
      Boolean(document.querySelector(".animate-pulse"));

    const run = () => {
      if (hasPendingSkeleton()) {
        const onMutate = () => {
          if (hasPendingSkeleton()) return;
          if (observer) observer.disconnect();
          if (observerTimeoutId) window.clearTimeout(observerTimeoutId);
          rafA = window.requestAnimationFrame(() => {
            rafB = window.requestAnimationFrame(run);
          });
        };

        observer = new MutationObserver(onMutate);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class"],
        });

        // If skeleton never clears, skip animation instead of causing hydration/style drift.
        observerTimeoutId = window.setTimeout(() => {
          if (observer) observer.disconnect();
          observer = null;
        }, 12000);
        return;
      }

      ensureRegistered();

      ctx = gsap.context(() => {
        const elements = collectTargets();

        elements.forEach((el) => {
          if (!el || el.dataset.animate === "none") return;
          if (!el.getBoundingClientRect) return;

          const isAutoSection = el.classList.contains("app-section") && !el.dataset.animate;
          if (isAutoSection && el.querySelector("[data-animate]")) {
            // Avoid double motion: let nested explicit animations drive this block.
            return;
          }

          const isSection =
            el.classList.contains("app-section") || el.dataset.animate === "section";
          const type = isSection ? "section" : el.dataset.animate || "fade-up";

          const distance = readNumber(
            el,
            ["animateDistance", "distance"],
            type === "section" ? (isMobile ? 20 : 30) : isMobile ? 18 : 26
          );
          const duration = readNumber(
            el,
            ["animateDuration", "duration"],
            type === "section" ? (isMobile ? 0.62 : 0.8) : isMobile ? 0.56 : 0.72
          );
          const delay = readNumber(el, ["animateDelay", "delay"], 0);
          const ease = readString(
            el,
            ["animateEase", "ease"],
            type === "section" ? "power3.out" : "power2.out"
          );
          const stagger = readNumber(el, ["animateStagger", "stagger"], 0.08);
          const start = readString(
            el,
            ["animateStart"],
            type === "section" ? "top 90%" : "top 88%"
          );
          const end = readString(el, ["animateEnd"], "bottom 18%");
          const childrenSelector = readString(
            el,
            ["animateChildren"],
            "[data-animate-child]"
          );
          const blur = readNumber(
            el,
            ["animateBlur", "blur"],
            type === "section" ? (isMobile ? 0 : 6) : isMobile ? 0 : 4
          );
          const scrubRaw = readString(el, ["animateScrub", "scrub"], "");
          const scrubValue =
            scrubRaw === ""
              ? false
              : scrubRaw === "true"
              ? 0.18
              : Number.isFinite(Number(scrubRaw))
              ? Number(scrubRaw)
              : false;
          const repeat = readBoolean(el, ["animateRepeat", "repeat"], false);

          const isStagger = type === "stagger";
          let targets = el;
          if (isStagger) {
            targets = resolveStaggerTargets(el, childrenSelector);
            if (!targets || targets.length === 0) return;
          }

          const fromVars = {
            autoAlpha: 0,
            force3D: true,
          };

          if (type === "fade-up" || type === "section" || type === "stagger") {
            fromVars.y = distance;
            fromVars.scale = type === "section" ? 0.988 : 0.992;
          } else if (type === "fade-left") {
            fromVars.x = -distance;
          } else if (type === "fade-right") {
            fromVars.x = distance;
          } else if (type === "zoom") {
            fromVars.scale = 0.95;
          } else if (type === "clip") {
            fromVars.clipPath = "inset(0 0 100% 0)";
            fromVars.autoAlpha = 1;
          }

          if (blur > 0) {
            fromVars.filter = `blur(${blur}px)`;
          }

          const toVars = {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration,
            delay,
            ease,
            stagger: isStagger ? stagger : 0,
            immediateRender: false,
            overwrite: "auto",
            scrollTrigger: {
              trigger: el,
              start,
              end,
              toggleActions: repeat
                ? "play none none reverse"
                : "play none none none",
              once: !repeat,
              scrub: scrubValue,
              invalidateOnRefresh: true,
              fastScrollEnd: true,
            },
            onStart: () => {
              gsap.set(targets, { willChange: "transform, opacity, filter" });
            },
            onComplete: () => {
              gsap.set(targets, { clearProps: "willChange" });
            },
          };

          if (blur > 0) {
            toVars.filter = "blur(0px)";
          }

          if (type === "clip") {
            toVars.clipPath = "inset(0 0 0% 0)";
          }

          gsap.fromTo(targets, fromVars, toVars);
        });
      });

      ScrollTrigger.refresh(true);
    };

    const cleanupLoadListener = scheduleRun(() => {
      rafA = window.requestAnimationFrame(() => {
        rafB = window.requestAnimationFrame(run);
      });
    });

    return () => {
      cleanupLoadListener?.();
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
      if (observerTimeoutId) window.clearTimeout(observerTimeoutId);
      if (observer) observer.disconnect();
      if (rafA) window.cancelAnimationFrame(rafA);
      if (rafB) window.cancelAnimationFrame(rafB);
      if (ctx) ctx.revert();
    };
  }, [pathname, searchKey]);

  return null;
}
