// src/components/auth/AuthSelector.jsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import UserAccountPage from "../../pages/UserAccountPage";
import AuthPage from "../../pages/AuthPage";
import { authApi } from "../../api/auth";
import { getAccessToken, refreshAccessToken } from "../../api/client";

export default function AuthSelector() {
  const [ready, setReady] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  // logout query
  useEffect(() => {
    (async () => {
      if (params.get("view") === "logout") {
        await authApi.logout();
        navigate("/account?view=login", { replace: true });
        setIsLogged(false);
      }
    })();
  }, [params, navigate]);

  // açılışta doğrula
  useEffect(() => {
    (async () => {
      try {
        if (!getAccessToken()) {
          const ok = await refreshAccessToken();
          if (!ok) {
            setIsLogged(false);
            setReady(true);
            return;
          }
        }
        const me = await authApi.me();
        setIsLogged(Boolean(me));
        // 🔴 burada admin'e zorunlu yönlendirme YOK
        // sadece guard redirect paramı olsaydı orada yakalayabilirdik
      } catch {
        setIsLogged(false);
      } finally {
        setReady(true);
      }
    })();
  }, [params, navigate]);

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
