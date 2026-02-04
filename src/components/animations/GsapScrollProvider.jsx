"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

const ensureRegistered = () => {
  if (registered) return;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  registered = true;
};

const prefersReducedMotion = () => {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const collectTargets = () => {
  const elements = new Set();
  document.querySelectorAll("[data-animate]").forEach((el) => elements.add(el));
  document.querySelectorAll(".app-section").forEach((el) => {
    if (!el.dataset.animate) elements.add(el);
  });
  return Array.from(elements);
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

    const schedule = (fn) => {
      if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(fn, { timeout: 1200 });
        return () => window.cancelIdleCallback(id);
      }
      const id = window.setTimeout(fn, 120);
      return () => window.clearTimeout(id);
    };

    const waitForLoad = (fn) => {
      if (document.readyState === "complete") {
        fn();
        return () => {};
      }
      const handler = () => fn();
      window.addEventListener("load", handler, { once: true });
      return () => window.removeEventListener("load", handler);
    };

    let cleanupIdle = () => {};
    let cleanupLoad = () => {};
    let ctx = null;
    cleanupLoad = waitForLoad(() => {
      cleanupIdle = schedule(() => {
        ensureRegistered();

        ctx = gsap.context(() => {
          const elements = collectTargets();

          elements.forEach((el) => {
            if (!el || el.dataset.animate === "none") return;

            const type = el.dataset.animate || "fade-up";
            const distance = Number(el.dataset.distance || 28);
            const duration = Number(el.dataset.duration || 0.8);
            const delay = Number(el.dataset.delay || 0);
          const ease = el.dataset.ease || "power2.out";
          const stagger = Number(el.dataset.stagger || 0.12);
          const start = el.dataset.animateStart || "top 85%";
          const end = el.dataset.animateEnd || "bottom 15%";
          const childrenSelector =
            el.dataset.animateChildren || "[data-animate-child]";

            const isStagger = type === "stagger";
            let targets = el;
            if (isStagger) {
              targets = resolveStaggerTargets(el, childrenSelector);
              if (!targets || targets.length === 0) return;
            }

            const fromVars = {
              opacity: 0,
            };

            if (type === "fade-up") {
              fromVars.y = distance;
            } else if (type === "fade-left") {
              fromVars.x = -distance;
            } else if (type === "fade-right") {
              fromVars.x = distance;
            } else if (type === "zoom") {
              fromVars.scale = 0.96;
            } else if (type === "clip") {
              fromVars.clipPath = "inset(0 0 100% 0)";
              fromVars.opacity = 1;
            }

            gsap.fromTo(
              targets,
              fromVars,
              {
                opacity: 1,
                x: 0,
                y: 0,
                scale: 1,
                clipPath: "inset(0 0 0% 0)",
                duration,
                delay,
                ease,
                stagger: isStagger ? stagger : 0,
              immediateRender: false,
              scrollTrigger: {
                trigger: el,
                start,
                end,
                toggleActions: "restart none restart none",
              },
                onStart: () => {
                  gsap.set(targets, { willChange: "transform, opacity" });
                },
                onComplete: () => {
                  gsap.set(targets, { clearProps: "willChange" });
                },
              }
            );
          });
        });

        ScrollTrigger.refresh(true);
      });
    });

    return () => {
      cleanupLoad();
      cleanupIdle();
      if (ctx) ctx.revert();
    };
  }, [pathname, searchKey]);

  return null;
}
