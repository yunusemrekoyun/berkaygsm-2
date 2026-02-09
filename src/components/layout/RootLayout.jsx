// src/components/layout/RootLayout.jsx
"use client";
import { Suspense, useEffect, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import GsapScrollProvider from "../animations/GsapScrollProvider.jsx";
import GlobalLoadingOverlay from "../ui/GlobalLoadingOverlay.jsx";

export default function RootLayout({ children }) {
  const [enableAnimations, setEnableAnimations] = useState(false);

  useEffect(() => {
    // Defer GSAP init to avoid mutating DOM during hydration.
    const timer = window.setTimeout(() => setEnableAnimations(true), 120);
    return () => window.clearTimeout(timer);
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
        <Header />
        <main className="pb-20 md:pb-0">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
