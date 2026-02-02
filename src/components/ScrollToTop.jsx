import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop:
 * Route değiştiğinde sayfayı en üste kaydırır.
 * Global olarak layout seviyesinde kullanılmalıdır.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  return null;
}
