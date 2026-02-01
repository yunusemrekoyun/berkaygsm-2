import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop:
 * Route değiştiğinde sayfayı en üste kaydırır.
 * Global olarak main.jsx’te App’in hemen üstüne yerleştirilmelidir.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  return null;
}
