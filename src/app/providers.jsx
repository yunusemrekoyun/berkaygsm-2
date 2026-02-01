"use client";

import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import CartProvider from "../context/CartProvider.jsx";
import { LangProvider } from "../context/LangContext.jsx";
import { ConfirmProvider } from "../components/ui/ConfirmDialog.jsx";
import { initSentry } from "../sentry.js";
import { useThemeInit } from "../utils/theme.js";

export default function Providers({ children }) {
  useThemeInit();

  useEffect(() => {
    initSentry();
  }, []);

  return (
    <LangProvider>
      <CartProvider>
        <ConfirmProvider>
          <Toaster position="top-right" toastOptions={{ duration: 2500 }} />
          {children}
        </ConfirmProvider>
      </CartProvider>
    </LangProvider>
  );
}
