"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "../../components/layout/AdminLayout.jsx";
import { authApi } from "../../api/auth.js";
import {
  getUser as getUserCache,
  setUser as setUserCache,
  getAccessToken,
  refreshAccessToken,
  clearAuthState,
} from "../../api/client.js";

function AdminGate({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(() => getUserCache());
  const paramsKey = useMemo(
    () => (searchParams ? searchParams.toString() : ""),
    [searchParams]
  );

  useEffect(() => {
    let mounted = true;

    const finish = (nextUser) => {
      if (!mounted) return;
      setUser(nextUser || null);
      setInitializing(false);
    };

    (async () => {
      const cachedUser = getUserCache();
      let token = getAccessToken();

      if (!token && !cachedUser) {
        finish(null);
        return;
      }

      if (!token) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          clearAuthState();
          finish(null);
          return;
        }
        token = getAccessToken();
      }

      if (token) {
        const me = await authApi.me().catch(() => null);
        if (me) {
          setUserCache(me);
          finish(me);
          return;
        }
      }

      const nextCachedUser = getUserCache();
      const nextToken = getAccessToken();
      if (nextToken && nextCachedUser) {
        finish(nextCachedUser);
        return;
      }

      clearAuthState();
      finish(null);
    })();

    return () => {
      mounted = false;
    };
  }, [pathname, paramsKey]);

  const resolveFallbackPath = () => {
    if (typeof window === "undefined") return "/";
    try {
      const stored = window.sessionStorage.getItem("lastPublicPath");
      if (
        stored &&
        stored.startsWith("/") &&
        !stored.startsWith("/admin")
      ) {
        return stored;
      }
    } catch {
      /* ignore */
    }
    return "/";
  };

  useEffect(() => {
    if (initializing) return;

    if (!user) {
      const redirectTarget = pathname + (paramsKey ? `?${paramsKey}` : "");
      const redirect = encodeURIComponent(redirectTarget);
      router.replace(`/account?view=login&redirect=${redirect}`);
      return;
    }

    const role = (user?.role || "user").toLowerCase();
    if (role !== "admin") {
      const fallback = resolveFallbackPath();
      router.replace(fallback);
    }
  }, [initializing, user, pathname, paramsKey, router]);

  if (initializing) return null;
  if (!user) return null;
  if ((user?.role || "user").toLowerCase() !== "admin") return null;

  return <AdminLayout>{children}</AdminLayout>;
}

export default function AdminRootLayout({ children }) {
  return (
    <Suspense fallback={null}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
