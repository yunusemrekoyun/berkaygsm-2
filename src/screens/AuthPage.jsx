// src/pages/AuthPage.jsx
import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
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
    if (!r) return null;
    let decoded = r;
    try {
      decoded = decodeURIComponent(r);
    } catch {
      decoded = r;
    }
    return decoded && decoded.startsWith("/") ? decoded : null;
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

      toast.success("Hesabın oluşturuldu!");

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

      toast.success("Giriş başarılı!");

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
    <section className="store-page bg-surface-light/60">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-12">
        <div className="glass-surface mx-auto max-w-md rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h1 className="text-center font-serif text-3xl font-extrabold text-primary">
            {view === "login" ? "Tekrar hoş geldin" : "Hesap oluştur"}
          </h1>
          <p className="mt-2 text-center text-secondary">
            {view === "login"
              ? "Siparişlerini ve favorilerini yönetmek için giriş yap."
              : "Daha hızlı ödeme ve seçili öneriler için hesabını oluştur."}
          </p>

          {error && (
            <div className="glass-surface-soft mt-4 rounded-lg bg-surface-light p-3 text-sm text-accent">
              {error}
            </div>
          )}

          <div className="mt-6">
            {view === "login" ? (
              <LoginForm onSubmit={handleLogin} loadingText="Giriş yapılıyor..." />
            ) : (
              <RegisterForm
                onSubmit={handleRegister}
                loadingText="Hesap oluşturuluyor..."
              />
            )}
          </div>

          <div className="mt-6 text-center text-sm">
            {view === "login" ? (
              <span className="text-secondary">
                Üye değil misin?{" "}
                <button
                  className="text-accent hover:text-accent-hover underline"
                  onClick={() => setView("register")}
                >
                  Hesap oluştur
                </button>
              </span>
            ) : (
              <span className="text-secondary">
                Zaten hesabın var mı?{" "}
                <button
                  className="text-accent hover:text-accent-hover underline"
                  onClick={() => setView("login")}
                >
                  Giriş yap
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
  return e.message?.replace(/^Error:\s?/, "") || "Bir hata oluştu";
}
