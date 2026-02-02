"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function RouteMemory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = useMemo(
    () => (searchParams ? searchParams.toString() : ""),
    [searchParams]
  );

  useEffect(() => {
    if (!pathname) return;
    const href = query ? `${pathname}?${query}` : pathname;
    if (href.startsWith("/admin")) return;
    try {
      window.sessionStorage.setItem("lastPublicPath", href);
    } catch {
      /* ignore */
    }
  }, [pathname, query]);

  return null;
}
