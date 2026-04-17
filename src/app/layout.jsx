import { Plus_Jakarta_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import Providers from "./providers.jsx";
import { Analytics } from "@vercel/analytics/next";

const brandSans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-brand-sans",
  display: "swap",
});

const brandSerif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  variable: "--font-brand-serif",
  display: "swap",
});

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.ceplife.com";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CepLife — Telefon Aksesuarları",
    template: "%s | CepLife",
  },
  description:
    "Telefonunuz için en kaliteli kılıf, ekran koruyucu, şarj aleti ve aksesuar. Hızlı kargo, güvenli ödeme, uygun fiyat.",
  keywords: ["telefon kılıfı", "ekran koruyucu", "telefon aksesuarı", "kılıf", "cep telefonu aksesuarı"],
  openGraph: {
    siteName: "CepLife",
    type: "website",
    locale: "tr_TR",
    url: SITE_URL,
    title: "CepLife — Telefon Aksesuarları",
    description:
      "Telefonunuz için en kaliteli kılıf, ekran koruyucu, şarj aleti ve aksesuar. Hızlı kargo, güvenli ödeme, uygun fiyat.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CepLife — Telefon Aksesuarları",
    description:
      "Telefonunuz için en kaliteli kılıf, ekran koruyucu, şarj aleti ve aksesuar.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CepLife",
  url: SITE_URL,
  logo: `${SITE_URL}/ceplife-logo-cropped.png`,
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+905522174343",
    contactType: "customer service",
    availableLanguage: "Turkish",
  },
  sameAs: [],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "CepLife",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/shop?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({ children }) {
  const enableVercelInsights = process.env.VERCEL === "1";

  return (
    <html
      lang="tr"
      style={DEFAULT_THEME_VARS}
      className={`${brandSans.variable} ${brandSerif.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="font-sans">
        <Providers enableVercelInsights={enableVercelInsights}>
          {children}
        </Providers>
        {enableVercelInsights ? <Analytics /> : null}
      </body>
    </html>
  );
}
