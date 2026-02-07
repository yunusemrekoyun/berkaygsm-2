import { useState } from "react";

export default function RegisterForm({ onSubmit, loadingText = "Yükleniyor..." }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [phone, setPhone] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!agree || !name || !email || !pass) return;
    setLoading(true);
    try {
      await onSubmit?.({ name, email, pass, phone });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-primary">
          Ad Soyad
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-primary outline-none placeholder:text-secondary/60"
          placeholder="Ayla Yılmaz"
          required
        />
      </div>

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
          Telefon
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-primary outline-none placeholder:text-secondary/60"
          placeholder="+90 5xx xxx xx xx"
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
          placeholder="En az 8 karakter"
          required
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-secondary">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-1"
        />
        Kullanım Koşulları ve Gizlilik Politikası’nı kabul ediyorum.
      </label>

      <button
        type="submit"
        disabled={!agree || loading}
        className="mt-2 w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {loading ? loadingText : "Hesap oluştur"}
      </button>
    </form>
  );
}
