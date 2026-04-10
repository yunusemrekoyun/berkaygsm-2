import { useState } from "react";
import TurnstileWidget from "../ui/TurnstileWidget.jsx";

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export default function LoginForm({
  onSubmit,
  loadingText = "Yükleniyor...",
  showForgotPassword = true,
}) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const [captchaResetCounter, setCaptchaResetCounter] = useState(0);
  const captchaEnabled = Boolean(TURNSTILE_SITE_KEY);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !pass) return;
    if (captchaEnabled && !captchaToken) {
      setCaptchaError("Lütfen doğrulama adımını tamamlayın.");
      return;
    }
    setLoading(true);
    try {
      await onSubmit?.({ email, pass, turnstileToken: captchaToken });
    } finally {
      setLoading(false);
      if (captchaEnabled) {
        setCaptchaToken("");
        setCaptchaResetCounter((prev) => prev + 1);
      }
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-primary">
          E-posta
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-primary outline-none placeholder:text-secondary/60"
          placeholder="ornek@eposta.com"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-primary">
          Şifre
        </label>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-primary outline-none placeholder:text-secondary/60"
          placeholder="••••••••"
          required
        />
      </div>

      {captchaEnabled ? (
        <TurnstileWidget
          siteKey={TURNSTILE_SITE_KEY}
          resetSignal={captchaResetCounter}
          onTokenChange={(token) => {
            setCaptchaToken(token);
            if (captchaError) setCaptchaError("");
          }}
          onError={(message) => {
            setCaptchaToken("");
            setCaptchaError(message);
          }}
        />
      ) : null}

      {captchaError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {captchaError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {loading ? loadingText : "Giriş yap"}
      </button>

      {showForgotPassword ? (
        <div className="text-right text-sm">
          <button type="button" className="text-secondary hover:text-accent">
            Şifreni mi unuttun?
          </button>
        </div>
      ) : null}
    </form>
  );
}
