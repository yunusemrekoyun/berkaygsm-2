"use client";

import { Toaster } from "react-hot-toast";
import CartProvider from "../context/CartProvider.jsx";
import { LangProvider } from "../context/LangContext.jsx";
import { ConfirmProvider } from "../components/ui/ConfirmDialog.jsx";
import { useThemeInit } from "../utils/theme.js";

export default function Providers({ children }) {
  useThemeInit();

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
