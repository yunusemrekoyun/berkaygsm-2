// src/components/layout/RootLayout.jsx
"use client";
import { Suspense } from "react";
import Header from "./Header";
import Footer from "./Footer";
import GsapScrollProvider from "../animations/GsapScrollProvider.jsx";
import GlobalLoadingOverlay from "../ui/GlobalLoadingOverlay.jsx";

export default function RootLayout({ children }) {
  return (
    <div className="app-shell store-glass">
      <div className="app-card">
        <Suspense fallback={null}>
          <GsapScrollProvider />
        </Suspense>
        <GlobalLoadingOverlay />
        <Header />
        <main className="pb-20 md:pb-0">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
