// src/components/footer/Footer.jsx
import { Link } from "react-router-dom";
import { Mail, Phone } from "lucide-react";
import { useStaticTranslation } from "../../i18n/staticContent.js";

export default function Footer() {
  const t = useStaticTranslation();
  const links = t("footer.links") || {};
  const year = new Date().getFullYear();
  const copy =
    t("footer.copyright", { year }) ||
    `© ${year} Berkay GSM.`;

  return (
    <footer className="glass-surface glass-surface-soft border-t border-border">
      <div className="app-section app-section--tight">
        {/* Üst mini ikonlar */}
        <div className="flex flex-wrap items-center justify-center gap-4 pb-6 text-sm text-secondary">
          <span className="glass-chip flex min-w-[140px] items-center justify-center gap-2 rounded-full bg-surface-light px-4 py-2 text-accent">
            <Mail className="h-4 w-4" />
            <span className="font-medium">{links.email || "hello@berkaygsm.com"}</span>
          </span>
          <span className="glass-chip flex min-w-[140px] items-center justify-center gap-2 rounded-full bg-surface-light px-4 py-2 text-accent">
            <Phone className="h-4 w-4" />
            <span className="font-medium">{links.phone || "+90 212 000 00 00"}</span>
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
        </nav>

        {/* Copyright */}
        <p className="pt-6 text-center text-sm text-secondary/70">
          {copy}
        </p>
      </div>
    </footer>
  );
}
