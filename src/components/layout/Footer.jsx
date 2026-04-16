"use client";

// src/components/footer/Footer.jsx
import { Link } from "react-router-dom";
import { Mail, Phone } from "lucide-react";
import AppImage from "../ui/AppImage.jsx";
import { useStaticTranslation } from "../../i18n/staticContent.js";
import { useCookieConsent } from "../../context/CookieConsentContext.jsx";
import {
  OFFICIAL_PHONE,
  OFFICIAL_SUPPORT_EMAIL,
} from "../../config/siteContact.js";

const BRAND_NAME = "CepLife";
const BRAND_LOGO_SRC = "/ceplife-logo-cropped.png";

export default function Footer() {
  const t = useStaticTranslation();
  const { openPreferences } = useCookieConsent();
  const links = t("footer.links") || {};
  const year = new Date().getFullYear();
  const copy =
    t("footer.copyright", { year }) ||
    `© ${year} ${BRAND_NAME}.`;

  return (
    <footer className="glass-surface glass-surface-soft border-t border-border">
      <div className="app-section app-section--tight">
        <div className="flex justify-center pb-5">
          <Link
            to="/"
            aria-label={BRAND_NAME}
            className="inline-flex items-center justify-center"
          >
            <AppImage
              src={BRAND_LOGO_SRC}
              alt={BRAND_NAME}
              width={520}
              height={250}
              sizes="220px"
              className="h-10 w-auto max-w-[190px] object-contain sm:h-12 sm:max-w-[220px]"
            />
          </Link>
        </div>

        {/* Üst mini ikonlar */}
        <div className="flex flex-wrap items-center justify-center gap-3 pb-6 text-sm text-secondary sm:gap-4">
          <span className="glass-chip flex min-w-[120px] items-center justify-center gap-2 rounded-full bg-surface-light px-4 py-2 text-accent sm:min-w-[140px]">
            <Mail className="h-4 w-4" />
            <span className="font-medium">
              {links.email || OFFICIAL_SUPPORT_EMAIL}
            </span>
          </span>
          <span className="glass-chip flex min-w-[120px] items-center justify-center gap-2 rounded-full bg-surface-light px-4 py-2 text-accent sm:min-w-[140px]">
            <Phone className="h-4 w-4" />
            <span className="font-medium">{links.phone || OFFICIAL_PHONE}</span>
          </span>
        </div>

        {/* Linkler */}
        <nav className="grid grid-cols-2 gap-3 text-center text-[15px] font-medium text-primary sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-10">
          <Link to="/about" className="hover:text-accent">
            {links.about}
          </Link>
          <Link to="/contact" className="hover:text-accent">
            {links.contact}
          </Link>
          <Link to="/faq" className="hover:text-accent">
            {links.faq}
          </Link>
          <Link to="/shipping-returns" className="hover:text-accent">
            {links.shippingReturns}
          </Link>
          <Link to="/privacy" className="hover:text-accent">
            {links.privacy}
          </Link>
          <Link to="/terms" className="hover:text-accent">
            {links.terms}
          </Link>
          <button
            type="button"
            onClick={openPreferences}
            className="cursor-pointer hover:text-accent"
          >
            {links.cookiePreferences || "Çerez Tercihleri"}
          </button>
        </nav>

        {/* Copyright */}
        <p className="pt-6 text-center text-sm text-secondary/70">
          {copy}
        </p>
      </div>
    </footer>
  );
}
