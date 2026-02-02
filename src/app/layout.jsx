import "./globals.css";
import Providers from "./providers.jsx";

const DEFAULT_THEME_VARS = {
  "--color-primary": "#0c4a6e",
  "--color-secondary": "#0369a1",
  "--color-accent": "#38bdf8",
  "--color-accent-hover": "#0ea5e9",
  "--color-surface": "#f0f9ff",
  "--color-surface-light": "#f5fbff",
  "--color-surface-hover": "#ffffff",
  "--color-border": "#bae6fd",
  "--color-contact-bg": "#f5fbff",
  "--color-bg-admin": "#f7fbff",
  "--color-text-admin": "#0b2a45",
  "--color-bg-card": "#ffffff",
  "--color-bg-hover": "#e0f2fe",
  "--color-bg-sidebar": "#0ea5e9",
  "--color-text-sidebar": "#ffffff",
  "--color-text-admin-muted": "#64748b",
  "--color-border-admin": "#bae6fd",
};

export const metadata = {
  title: "Berkay GSM",
  description: "Berkay GSM storefront and admin",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" style={DEFAULT_THEME_VARS}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
