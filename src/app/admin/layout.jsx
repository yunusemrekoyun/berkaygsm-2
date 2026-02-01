"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "../../components/layout/AdminLayout.jsx";
import { authApi } from "../../api/auth.js";
import {
  getUser as getUserCache,
  setUser as setUserCache,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from "../../api/client.js";

export default function AdminRootLayout({ children }) {
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
          setAccessToken(null);
          setUserCache(null);
          finish(null);
          return;
        }
        token = getAccessToken();
      }

      if (!token) {
        finish(null);
        return;
      }

      const me = await authApi.me().catch(() => null);
      if (me) {
        setUserCache(me);
        finish(me);
      } else {
        setAccessToken(null);
        setUserCache(null);
        finish(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [pathname, paramsKey]);

  useEffect(() => {
    if (initializing) return;

    if (!user) {
      const redirect = encodeURIComponent(
        pathname + (paramsKey ? `?${paramsKey}` : "")
      );
      router.replace(`/account?view=login&redirect=${redirect}`);
      return;
    }

    const role = (user?.role || "user").toLowerCase();
    if (role !== "admin") {
      router.replace("/");
    }
  }, [initializing, user, pathname, paramsKey, router]);

  if (initializing) return null;
  if (!user) return null;
  if ((user?.role || "user").toLowerCase() !== "admin") return null;

  return <AdminLayout>{children}</AdminLayout>;
}
