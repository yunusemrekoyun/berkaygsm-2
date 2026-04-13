import { useEffect, useMemo, useState } from "react";
import { Eye, Save, Settings2 } from "lucide-react";
import { customerReceiptConfigApi } from "../../../api/customerReceiptConfig.js";
import { buildOrderPrintHtml, buildOrderPrintModel } from "../../orders/orderPrintTemplate.js";
import { DEFAULT_CUSTOMER_RECEIPT_CONFIG } from "../../../shared/customerReceiptConfig.js";

const SAMPLE_ORDER = {
  orderNumber: "AYY-20260413-DXFG",
  createdAt: "2026-04-13T09:45:00.000Z",
  note: "Teslimatta aranmam yeterli.",
  customerEmail: "ornek@ceplife.com",
  address: {
    fullName: "Zeynep Kaya",
    phone: "0555 123 45 67",
    country: "Turkiye",
    city: "Istanbul",
    district: "Kadikoy",
    postalCode: "34710",
    addressLine: "Osmanağa Mah. Moda Cad. No: 18 D: 4",
  },
  shippingName: "Standart Kargo",
  total: 0,
};

function Field({ label, children, helper = "" }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--color-text-admin)]">{label}</span>
      {children}
      {helper ? (
        <span className="text-xs text-[var(--color-text-admin-muted)]">{helper}</span>
      ) : null}
    </label>
  );
}

export default function CustomerReceiptDesigner({ onBanner }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(() => ({
    ...DEFAULT_CUSTOMER_RECEIPT_CONFIG,
    updatedAt: null,
  }));
  const [savedConfig, setSavedConfig] = useState(() => ({
    ...DEFAULT_CUSTOMER_RECEIPT_CONFIG,
    updatedAt: null,
  }));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const nextConfig = await customerReceiptConfigApi.getConfig();
        if (cancelled) return;
        setConfig(nextConfig);
        setSavedConfig(nextConfig);
      } catch (error) {
        if (cancelled) return;
        onBanner?.({
          variant: "danger",
          message: error?.message || "Musteri fisi ayarlari yuklenemedi",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onBanner]);

  const isDirty = useMemo(
    () =>
      ["slogan", "message", "instagramUrl", "tiktokUrl"].some(
        (key) => String(config?.[key] || "") !== String(savedConfig?.[key] || "")
      ),
    [config, savedConfig]
  );

  const previewHtml = useMemo(() => {
    const model = buildOrderPrintModel(SAMPLE_ORDER, {
      customerReceiptConfig: config,
    });
    return buildOrderPrintHtml(model, { autoPrint: false, imageMode: true });
  }, [config]);

  const handleChange = (key, value) => {
    setConfig((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleReset = () => {
    setConfig(savedConfig);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await customerReceiptConfigApi.updateConfig(config);
      setConfig(updated);
      setSavedConfig(updated);
      onBanner?.({
        variant: "success",
        message: "Musteri fisi ayarlari kaydedildi",
      });
    } catch (error) {
      onBanner?.({
        variant: "danger",
        message: error?.message || "Musteri fisi ayarlari kaydedilemedi",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-bg-admin)] px-3 py-1 text-xs font-semibold text-[var(--color-text-admin-muted)]">
            <Settings2 className="h-3.5 w-3.5" />
            Musteri Fisi
          </div>
          <h2 className="mt-2 text-lg font-semibold text-[var(--color-text-admin)]">
            Musteri ve kargo teslim fisi
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
            Solda yazilari guncelleyin, sagda yaziciya gidecek fisin aynisini gorun.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || saving}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Geri Al
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !isDirty}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Kaydediliyor" : "Kaydet"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/45 p-4">
          <Field label="Slogan" helper="Fis ustunde vurgulanacak ana ifade.">
            <input
              type="text"
              value={config.slogan}
              onChange={(event) => handleChange("slogan", event.target.value)}
              className="rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm outline-none ring-0"
              placeholder="Siparisiniz yola cikmaya hazir"
            />
          </Field>

          <Field
            label="Musteriye mesaj"
            helper="Tesekkur ve teslim oncesi yonlendirme metni."
          >
            <textarea
              value={config.message}
              onChange={(event) => handleChange("message", event.target.value)}
              rows={6}
              className="rounded-2xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm outline-none ring-0"
              placeholder="Siparisiniz icin tesekkur ederiz..."
            />
          </Field>

          <Field label="Instagram adresi">
            <input
              type="text"
              value={config.instagramUrl}
              onChange={(event) => handleChange("instagramUrl", event.target.value)}
              className="rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm outline-none ring-0"
              placeholder="instagram.com/ceplife"
            />
          </Field>

          <Field label="TikTok adresi">
            <input
              type="text"
              value={config.tiktokUrl}
              onChange={(event) => handleChange("tiktokUrl", event.target.value)}
              className="rounded-xl border border-[var(--color-border-admin)] bg-white px-3 py-2 text-sm outline-none ring-0"
              placeholder="tiktok.com/@ceplife"
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/35 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--color-text-admin)]">
            <Eye className="h-4 w-4" />
            Canli Onizleme
          </div>
          <div className="overflow-auto rounded-2xl border border-[var(--color-border-admin)] bg-white p-3">
            <iframe
              title="Musteri fisi onizleme"
              srcDoc={previewHtml}
              className="mx-auto h-[570px] w-full max-w-[390px] rounded-lg border border-stone-200 bg-white"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
