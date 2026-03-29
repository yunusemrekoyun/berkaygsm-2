// src/components/layout/LayoutSelector.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Outlet,
  useLocation,
  Navigate,
  useSearchParams,
} from "react-router-dom";
import RootLayout from "./RootLayout";
import AdminLayout from "./AdminLayout";
import { authApi } from "../../api/auth";
import {
  clearAuthState,
  getUser as getUserCache,
  setUser as setUserCache,
  getAccessToken,
  hasAttemptedSessionRestore,
  markSessionRestoreAttempted,
  refreshAccessToken,
} from "../../api/client";

export default function LayoutSelector() {
  const location = useLocation();
  const [params] = useSearchParams();
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(() => getUserCache());

  const isAdminSection = /^\/admin(\/|$)/.test(location.pathname);
  const paramsKey = useMemo(() => params.toString(), [params]);

  useEffect(() => {
    let mounted = true;

    const finish = (nextUser) => {
      if (!mounted) return;
      setUser(nextUser);
      setInitializing(false);
    };

    (async () => {
      const cachedUser = getUserCache();
      let token = getAccessToken();

      if (!token && !cachedUser) {
        if (hasAttemptedSessionRestore()) {
          finish(null);
          return;
        }
        markSessionRestoreAttempted();
        const refreshed = await refreshAccessToken();
        token = refreshed ? getAccessToken() : null;
        if (!token) {
          clearAuthState();
          finish(null);
          return;
        }
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

      if (!token) {
        finish(null);
        return;
      }

      const me = await authApi.me().catch(() => null);
      if (me) {
        setUserCache(me);
        finish(me);
      } else {
        clearAuthState();
        finish(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [location.pathname, paramsKey, initializing]);

  if (initializing) return null;

  const role = (user?.role || "user").toLowerCase();

  // --- ADMIN GUARD ---
  if (isAdminSection) {
    // login değil → login sayfasına yönlendir (redirect ile geri döner)
    if (!user) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      return (
        <Navigate to={`/account?view=login&redirect=${redirect}`} replace />
      );
    }
    // login ama admin değil → ana sayfaya
    if (role !== "admin") {
      return <Navigate to="/" replace />;
    }
    // admin → AdminLayout
    return (
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    );
  }

  // --- PUBLIC (Root) LAYOUT ---
  return (
    <RootLayout>
      <Outlet />
    </RootLayout>
  );
}
