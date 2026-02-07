import { useEffect, useMemo, useState } from "react";
import { shippingApi } from "../../../api/shipping";
import { useCart } from "../../../hooks/useCart";
import { Coins, Loader2, Truck } from "lucide-react";

export default function ShippingSettingsCard() {
  const { refreshShipping } = useCart() || {};
  const [form, setForm] = useState({
    name: "Standart Kargo",
    fee: "0",
    freeThreshold: "0",
  });
  const [initialConfig, setInitialConfig] = useState({
    name: "Standart Kargo",
    fee: 0,
    freeThreshold: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const config = await shippingApi.getConfig();
        if (!mounted || !config) return;
        setInitialConfig(config);
        setForm({
          name: config.name || "Standart Kargo",
          fee: String(config.fee ?? 0),
          freeThreshold: String(config.freeThreshold ?? 0),
        });
      } catch (err) {
        if (mounted) setError(err?.message || "Kargo ayarları yüklenemedi");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(
    () => ({
      fee: Number(initialConfig.fee || 0).toFixed(2),
      threshold: Number(initialConfig.freeThreshold || 0).toFixed(2),
    }),
    [initialConfig]
  );

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        name: form.name.trim() || "Standart Kargo",
        fee: Math.max(0, Number(form.fee || 0)),
        freeThreshold: Math.max(0, Number(form.freeThreshold || 0)),
      };
      const updated = await shippingApi.updateConfig(payload);
      setInitialConfig(updated || payload);
      setForm({
        name: (updated?.name || payload.name).trim(),
        fee: String(updated?.fee ?? payload.fee),
        freeThreshold: String(updated?.freeThreshold ?? payload.freeThreshold),
      });
      setMessage("Kargo ayarları güncellendi");
      await refreshShipping?.();
    } catch (err) {
      setError(err?.message || "Kargo ayarları güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex h-full flex-col rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]">
      <header className="flex items-center gap-3 border-b border-[var(--color-border-admin)]/60 px-4 py-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-bg-admin)]/10">
          <Truck className="h-5 w-5 text-[var(--color-text-admin)]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-admin)]">
            Kargo & Teslimat
          </h3>
          <p className="text-xs text-[var(--color-text-admin-muted)]">
            Temel kargo ücretini ve ücretsiz teslimat eşiğini yapılandırın.
          </p>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col justify-between"
      >
        <div className="space-y-4 px-4 py-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {message}
            </div>
          )}

          <label className="block text-sm text-[var(--color-text-admin)]">
            <span className="mb-1 block font-medium">Kargo adı</span>
            <input
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              disabled={loading || saving}
            />
          </label>

          <label className="block text-sm text-[var(--color-text-admin)]">
            <span className="mb-1 block font-medium">
              Temel kargo ücreti (₺)
            </span>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                value={form.fee}
                onChange={(e) => handleChange("fee", e.target.value)}
                disabled={loading || saving}
              />
            </div>
          </label>

          <label className="block text-sm text-[var(--color-text-admin)]">
            <span className="mb-1 block font-medium">
              Ücretsiz kargo eşiği (₺)
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              value={form.freeThreshold}
              onChange={(e) => handleChange("freeThreshold", e.target.value)}
              disabled={loading || saving}
            />
            <span className="mt-1 block text-xs text-[var(--color-text-admin-muted)]">
              Müşteriler bu tutara ulaşmadıkları sürece kargo ücreti öderler.
            </span>
          </label>
        </div>

        <footer className="flex flex-col gap-2 border-t border-[var(--color-border-admin)]/60 bg-[var(--color-bg-admin)]/10 px-4 py-3 text-[var(--color-text-admin)] md:flex-row md:items-center md:justify-between">
          <div className="text-xs">
            Mevcut: {initialConfig.name} • Ücret ₺{summary.fee} • Ücretsiz kargo
            eşiği ₺{summary.threshold}
          </div>
          <button
            type="submit"
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-4 py-2 text-xs font-semibold text-[var(--color-bg-admin)] hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Ayarları Kaydet
          </button>
        </footer>
      </form>
    </section>
  );
}
