// src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import CartProvider from "./context/CartProvider.jsx";
import { LangProvider } from "./context/LangContext.jsx";
import { ConfirmProvider } from "./components/ui/ConfirmDialog.jsx";
import { initSentry } from "./sentry.js";

initSentry();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LangProvider>
      <CartProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </CartProvider>
    </LangProvider>
  </StrictMode>
);
