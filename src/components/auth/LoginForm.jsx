import { useState } from "react";

export default function LoginForm({
  onSubmit,
  loadingText = "Yükleniyor...",
  showForgotPassword = true,
}) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !pass) return;
    setLoading(true);
    try {
      await onSubmit?.({ email, pass });
    } finally {
      setLoading(false);
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
