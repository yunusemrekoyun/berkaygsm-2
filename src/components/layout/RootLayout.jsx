// src/components/layout/RootLayout.jsx
"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Header from "./Header";
import Footer from "./Footer";
import AnnouncementBanner from "./AnnouncementBanner.jsx";
import GlobalLoadingOverlay from "../ui/GlobalLoadingOverlay.jsx";
import CookieConsentBanner from "../privacy/CookieConsentBanner.jsx";
import { CookieConsentProvider } from "../../context/CookieConsentContext.jsx";

const BANNER_HEIGHT = 36; // px — keep in sync with AnnouncementBanner.jsx

const GsapScrollProvider = dynamic(
  () => import("../animations/GsapScrollProvider.jsx"),
  { ssr: false }
);

export default function RootLayout({ children, initialCategoryTree = null, initialBanner = null }) {
  const hasBanner = Boolean(initialBanner?.isEnabled && initialBanner?.text);
  const [enableAnimations, setEnableAnimations] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia("(max-width: 768px)").matches) return undefined;

    let timer = null;
    let disposed = false;
    const enable = () => {
      if (disposed || timer) return;
      // Let the interaction settle before mutating the DOM with GSAP.
      timer = window.setTimeout(() => setEnableAnimations(true), 120);
    };

    const eventOptions = { once: true, passive: true };
    const bind = () => {
      window.addEventListener("pointerdown", enable, eventOptions);
      window.addEventListener("touchstart", enable, eventOptions);
      window.addEventListener("wheel", enable, eventOptions);
      window.addEventListener("keydown", enable, { once: true });
    };

    const unbind = () => {
      window.removeEventListener("pointerdown", enable);
      window.removeEventListener("touchstart", enable);
      window.removeEventListener("wheel", enable);
      window.removeEventListener("keydown", enable);
    };

    if (document.readyState === "complete") {
      bind();
      return () => {
        disposed = true;
        unbind();
        if (timer) window.clearTimeout(timer);
      };
    }

    const handleLoad = () => bind();
    window.addEventListener("load", handleLoad, { once: true });
    return () => {
      disposed = true;
      window.removeEventListener("load", handleLoad);
      unbind();
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return (
    <CookieConsentProvider>
      <div className="app-shell store-glass">
        <div className="app-card">
          {enableAnimations ? (
            <GsapScrollProvider />
          ) : null}
          <GlobalLoadingOverlay />
          <AnnouncementBanner banner={initialBanner} />
          <Header initialCategoryTree={initialCategoryTree} bannerHeight={hasBanner ? BANNER_HEIGHT : 0} />
          <main
            className={`pb-20 md:pb-0 ${hasBanner ? "pt-[148px] md:pt-[172px]" : "pt-[112px] md:pt-[136px]"}`}
          >
            {children}
          </main>
          <Footer />
        </div>
      </div>
      <CookieConsentBanner />
    </CookieConsentProvider>
  );
}
