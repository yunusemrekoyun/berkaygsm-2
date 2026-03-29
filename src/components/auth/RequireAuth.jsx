// src/components/auth/RequireAuth.jsx
"use client";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authApi } from "../../api/auth";
import {
  clearAuthState,
  getAccessToken,
  getUser,
  hasAttemptedSessionRestore,
  markSessionRestoreAttempted,
  refreshAccessToken,
} from "../../api/client";

export default function RequireAuth({ children }) {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(() => getUser());

  useEffect(() => {
    let mounted = true;

    (async () => {
      const cachedUser = getUser();
      const cachedToken = getAccessToken();

      if (cachedUser && cachedToken) {
        if (mounted) {
          setUser(cachedUser);
          setReady(true);
        }
        return;
      }

      if (!cachedToken && hasAttemptedSessionRestore()) {
        if (mounted) {
          setUser(cachedUser);
          setReady(true);
        }
        return;
      }

      if (!cachedToken) {
        markSessionRestoreAttempted();
        const refreshed = await refreshAccessToken();
        if (!mounted) return;

        if (!refreshed) {
          clearAuthState();
          setUser(null);
          setReady(true);
          return;
        }
      }

      const me = await authApi.me().catch(() => null);
      if (!mounted) return;

      if (me) {
        setUser(me);
      } else {
        clearAuthState();
        setUser(null);
      }
      setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return null;

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/account?view=login&redirect=${redirect}`} replace />;
  }
  return children;
}
