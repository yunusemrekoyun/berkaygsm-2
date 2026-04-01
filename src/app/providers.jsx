"use client";

import { Toaster } from "react-hot-toast";
import { SpeedInsights } from "@vercel/speed-insights/next";
import CartProvider from "../context/CartProvider.jsx";
import { LangProvider } from "../context/LangContext.jsx";
import { ConfirmProvider } from "../components/ui/ConfirmDialog.jsx";
import { useThemeInit } from "../utils/theme.js";

function filterInternalRoutes(event) {
  try {
    const { hostname, pathname } = new URL(event.url);
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".vercel.app")
    ) {
      return null;
    }

    if (pathname.startsWith("/admin")) {
      return null;
    }
  } catch {
    return event;
  }

  return event;
}

export default function Providers({ children }) {
  useThemeInit();

  return (
    <LangProvider>
      <CartProvider>
        <ConfirmProvider>
          <Toaster position="top-right" toastOptions={{ duration: 2500 }} />
          {children}
          <SpeedInsights sampleRate={0.5} beforeSend={filterInternalRoutes} />
        </ConfirmProvider>
      </CartProvider>
    </LangProvider>
  );
}
