// src/components/layout/RootLayout.jsx
"use client";
import { Suspense, useEffect, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import GsapScrollProvider from "../animations/GsapScrollProvider.jsx";
import GlobalLoadingOverlay from "../ui/GlobalLoadingOverlay.jsx";

export default function RootLayout({ children, initialCategoryTree = null }) {
  const [enableAnimations, setEnableAnimations] = useState(false);

  useEffect(() => {
    let timer = null;
    const enable = () => {
      // Give streamed sections enough time to hydrate before GSAP mutates DOM.
      timer = window.setTimeout(() => setEnableAnimations(true), 1600);
    };

    if (document.readyState === "complete") {
      enable();
      return () => {
        if (timer) window.clearTimeout(timer);
      };
    }

    window.addEventListener("load", enable, { once: true });
    return () => {
      window.removeEventListener("load", enable);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="app-shell store-glass">
      <div className="app-card">
        {enableAnimations ? (
          <Suspense fallback={null}>
            <GsapScrollProvider />
          </Suspense>
        ) : null}
        <GlobalLoadingOverlay />
        <Header initialCategoryTree={initialCategoryTree} />
        <main className="pb-20 pt-[112px] md:pb-0 md:pt-[136px]">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
