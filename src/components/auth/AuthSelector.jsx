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

  if (!ready) {
    return isLogged ? (
      <UserAccountGateSkeleton />
    ) : (
      <AuthGateSkeleton initialView={currentView === "login" ? "login" : "register"} />
    );
  }

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

function AuthGateSkeleton({ initialView = "register" }) {
  const isLogin = initialView === "login";

  return (
    <section className="store-page bg-surface-light/60">
      <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6">
        <div className="glass-surface mx-auto max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="mx-auto h-10 w-52 animate-pulse rounded bg-surface-light" />
          <div className="mx-auto mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-surface-light/80" />
          <div className="mx-auto mt-2 h-4 w-64 max-w-full animate-pulse rounded bg-surface-light/70" />

          <div className="mt-6 space-y-4">
            {Array.from({ length: isLogin ? 2 : 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-surface-light/70" />
                <div className="h-12 w-full animate-pulse rounded-xl bg-surface-light" />
              </div>
            ))}
            <div className="h-12 w-full animate-pulse rounded-full bg-surface-light" />
          </div>

          <div className="mx-auto mt-6 h-4 w-48 animate-pulse rounded bg-surface-light/70" />
        </div>
      </div>
    </section>
  );
}

function UserAccountGateSkeleton() {
  return (
    <section className="store-page bg-surface-light/60">
      <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <aside className="md:col-span-3">
            <div className="glass-surface rounded-2xl border border-border bg-white p-4 space-y-4">
              <div className="glass-surface-soft rounded-xl border border-border bg-contact-bg p-4">
                <div className="mx-auto mb-2 h-16 w-16 animate-pulse rounded-full bg-surface" />
                <div className="mx-auto h-4 w-2/3 animate-pulse rounded bg-surface" />
                <div className="mx-auto mt-2 h-3 w-1/2 animate-pulse rounded bg-surface" />
              </div>
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-9 animate-pulse rounded-lg bg-surface" />
              ))}
              <div className="h-10 rounded-full border border-border" />
            </div>
          </aside>
          <div className="md:col-span-9">
            <div className="glass-surface h-[520px] animate-pulse rounded-2xl border border-border bg-white p-6" />
          </div>
        </div>
      </div>
    </section>
  );
}
