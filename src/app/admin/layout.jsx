"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "../../components/layout/AdminLayout.jsx";
import LoginForm from "../../components/auth/LoginForm.jsx";
import { authApi } from "../../api/auth.js";
import {
  getUser as getUserCache,
  setUser as setUserCache,
  getAccessToken,
  hasAttemptedSessionRestore,
  markSessionRestoreAttempted,
  refreshAccessToken,
  clearAuthState,
} from "../../api/client.js";

function parseErr(error) {
  try {
    const msg = JSON.parse(error?.message || "")?.message;
    if (msg) return msg;
  } catch {
    // ignore
  }
  return error?.message?.replace(/^Error:\s?/, "") || "Bir hata oluştu";
}

function AdminLoginScreen({ onLogin }) {
  const [error, setError] = useState("");

  return (
    <section className="min-h-screen bg-[linear-gradient(180deg,#eef7ff_0%,#ffffff_100%)] px-4 py-12 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-md items-center">
        <div className="w-full rounded-3xl border border-sky-200 bg-white p-6 shadow-[0_24px_60px_rgba(12,74,110,0.12)]">
          <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
            CepLife Admin
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">
            Yönetici girişi
          </h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Tatil modu açık olsa bile yalnızca yöneticiler bu alan üzerinden giriş yapabilir.
          </p>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6">
            <LoginForm
              loadingText="Giriş yapılıyor..."
              showForgotPassword={false}
              onSubmit={async (values) => {
                setError("");
                try {
                  const loginResult = await authApi.login({
                    email: values.email,
                    password: values.pass,
                  });
                  if ((loginResult?.user?.role || "").toLowerCase() !== "admin") {
                    await authApi.logout();
                    throw new Error("Bu alan sadece yöneticiler içindir");
                  }
                  await onLogin?.();
                } catch (err) {
                  setError(parseErr(err));
                }
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

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

      if (token) {
        const me = await authApi.me().catch(() => null);
        if (me) {
          setUserCache(me);
          finish(me);
          return;
        }
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

    if (!user) return;
    const role = (user?.role || "user").toLowerCase();
    if (role !== "admin") {
      const fallback = resolveFallbackPath();
      router.replace(fallback);
    }
  }, [initializing, user, pathname, paramsKey, router]);

  if (initializing) return null;
  if (!user)
    return (
      <AdminLoginScreen
        onLogin={async () => {
          const me = await authApi.me().catch(() => null);
          if (!me || (me?.role || "").toLowerCase() !== "admin") {
            await authApi.logout();
            return;
          }
          setUserCache(me);
          setUser(me);
          router.refresh();
        }}
      />
    );
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
