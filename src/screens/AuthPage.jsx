// src/pages/AuthPage.jsx
import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import LoginForm from "../components/auth/LoginForm";
import RegisterForm from "../components/auth/RegisterForm";
import { authApi } from "../api/auth";

export default function AuthPage({ initialView = "register", onAuthSuccess }) {
  const [view, setView] = useState(initialView);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // /account?view=login&redirect=/admin/xyz gibi geldiğinde
  const redirectTarget = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const r = sp.get("redirect");
    return r && r.startsWith("/") ? r : null;
  }, [location.search]);

  const handleRegister = async (vals) => {
    setError("");
    try {
      const [firstName, ...rest] = (vals.name || "").trim().split(" ");
      const lastName = rest.join(" ") || "-";

      await authApi.register({
        firstName,
        lastName,
        email: vals.email,
        phone: vals.phone || "",
        password: vals.pass,
        role: "user",
      });

      // Guard'tan geldiyse oraya dön; değilse standart akış
      if (redirectTarget) {
        navigate(redirectTarget, { replace: true });
      } else {
        onAuthSuccess?.();
      }
    } catch (e) {
      setError(parseErr(e));
    }
  };

  const handleLogin = async (vals) => {
    setError("");
    try {
      await authApi.login({
        email: vals.email,
        password: vals.pass,
      });

      // Guard'tan geldiyse oraya dön; değilse standart akış
      if (redirectTarget) {
        navigate(redirectTarget, { replace: true });
      } else {
        onAuthSuccess?.();
      }
    } catch (e) {
      setError(parseErr(e));
    }
  };

  return (
    <section className="bg-surface-light/60">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h1 className="text-center font-serif text-3xl font-extrabold text-primary">
            {view === "login" ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="mt-2 text-center text-secondary">
            {view === "login"
              ? "Log in to manage your orders and wishlist."
              : "Join us to enjoy a faster checkout and curated picks."}
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-surface-light p-3 text-sm text-accent">
              {error}
            </div>
          )}

          <div className="mt-6">
            {view === "login" ? (
              <LoginForm onSubmit={handleLogin} loadingText="Signing in..." />
            ) : (
              <RegisterForm
                onSubmit={handleRegister}
                loadingText="Creating account..."
              />
            )}
          </div>

          <div className="mt-6 text-center text-sm">
            {view === "login" ? (
              <span className="text-secondary">
                Not a member?{" "}
                <button
                  className="text-accent hover:text-accent-hover underline"
                  onClick={() => setView("register")}
                >
                  Create an account
                </button>
              </span>
            ) : (
              <span className="text-secondary">
                Already have an account?{" "}
                <button
                  className="text-accent hover:text-accent-hover underline"
                  onClick={() => setView("login")}
                >
                  Log in
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function parseErr(e) {
  try {
    const msg = JSON.parse(e.message)?.message;
    if (msg) return msg;
  } catch {
    // ignore
  }
  return e.message?.replace(/^Error:\s?/, "") || "Something went wrong";
}
