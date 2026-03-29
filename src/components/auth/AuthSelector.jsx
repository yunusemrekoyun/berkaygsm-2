// src/components/auth/AuthSelector.jsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import UserAccountPage from "../../screens/UserAccountPage";
import AuthPage from "../../screens/AuthPage";
import { authApi } from "../../api/auth";
import {
  clearAuthState,
  getAccessToken,
  hasAttemptedSessionRestore,
  markSessionRestoreAttempted,
  refreshAccessToken,
  getUser,
} from "../../api/client";

export default function AuthSelector() {
  const [ready, setReady] = useState(false);
  const [isLogged, setIsLogged] = useState(() =>
    Boolean(getAccessToken() || getUser())
  );
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const paramsKey = useMemo(() => params.toString(), [params]);
  const currentView = useMemo(() => params.get("view") || "", [params]);

  // logout query
  useEffect(() => {
    (async () => {
      if (currentView === "logout") {
        await authApi.logout();
        navigate("/account?view=login", { replace: true });
        setIsLogged(false);
      }
    })();
  }, [currentView, navigate]);

  // açılışta doğrula
  useEffect(() => {
    let mounted = true;

    const setLogged = (value) => {
      if (mounted) setIsLogged(value);
    };

    (async () => {
      const cachedToken = getAccessToken();
      if (cachedToken || getUser()) setLogged(true);
      try {
        if (!cachedToken) {
          if (!getUser() && hasAttemptedSessionRestore()) {
            clearAuthState();
            setLogged(false);
            return;
          }
          markSessionRestoreAttempted();
          const ok = await refreshAccessToken();
          if (!ok) {
            clearAuthState();
            setLogged(false);
            return;
          }
        }
        const me = await authApi.me();
        if (me) {
          setLogged(true);
        } else {
          if (getAccessToken() || getUser()) {
            setLogged(true);
          } else {
            clearAuthState();
            setLogged(false);
          }
        }
      } catch {
        if (getAccessToken() || getUser()) {
          setLogged(true);
        } else {
          clearAuthState();
          setLogged(false);
        }
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [paramsKey]);

  if (!ready) return null;

  if (isLogged)
    return (
      <UserAccountPage
        onLogout={async () => {
          await authApi.logout();
          navigate("/account?view=login", { replace: true });
          setIsLogged(false);
        }}
      />
    );

  const initialView = params.get("view") === "login" ? "login" : "register";
  return (
    <AuthPage
      initialView={initialView}
      onAuthSuccess={() => {
        setIsLogged(true);
        navigate("/account", { replace: true });
      }}
    />
  );
}
