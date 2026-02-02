// src/components/auth/AuthSelector.jsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import UserAccountPage from "../../screens/UserAccountPage";
import AuthPage from "../../screens/AuthPage";
import { authApi } from "../../api/auth";
import { getAccessToken, refreshAccessToken, getUser } from "../../api/client";

export default function AuthSelector() {
  const [ready, setReady] = useState(false);
  const [isLogged, setIsLogged] = useState(() =>
    Boolean(getAccessToken() || getUser())
  );
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const paramsKey = useMemo(() => params.toString(), [params]);

  const hasCachedAuth = () => Boolean(getAccessToken() || getUser());

  // logout query
  useEffect(() => {
    (async () => {
      if (params.get("view") === "logout") {
        await authApi.logout();
        navigate("/account?view=login", { replace: true });
        setIsLogged(false);
      }
    })();
  }, [paramsKey, navigate]);

  // açılışta doğrula
  useEffect(() => {
    let mounted = true;

    const setLogged = (value) => {
      if (mounted) setIsLogged(value);
    };

    (async () => {
      const cachedUser = getUser();
      const cachedToken = getAccessToken();
      if (cachedUser || cachedToken) setLogged(true);
      try {
        if (!cachedToken) {
          const ok = await refreshAccessToken();
          if (!ok) {
            if (!hasCachedAuth()) setLogged(false);
            return;
          }
        }
        const me = await authApi.me();
        if (me) {
          setLogged(true);
        } else if (!hasCachedAuth()) {
          setLogged(false);
        }
        // 🔴 burada admin'e zorunlu yönlendirme YOK
        // sadece guard redirect paramı olsaydı orada yakalayabilirdik
      } catch {
        if (!hasCachedAuth()) setLogged(false);
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
