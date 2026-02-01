import { useEffect, useState } from "react";
import AdminModal from "../common/AdminModal";
import AlertBanner from "../../ui/AlertBanner.jsx";

export default function CouponForm({
  open,
  onClose,
  onSubmit,
  submitting = false,
  initialCoupon = null,
}) {
  const isEditing = Boolean(initialCoupon?.id);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [percentage, setPercentage] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCode(initialCoupon?.code ?? "");
    setDescription(initialCoupon?.description ?? "");
    setPercentage(
      initialCoupon?.percentage != null ? String(initialCoupon.percentage) : ""
    );
    setMinSubtotal(
      initialCoupon?.minSubtotal != null
        ? String(initialCoupon.minSubtotal)
        : ""
    );
    setActive(initialCoupon?.active ?? true);
    setError("");
  }, [open, initialCoupon]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting) return;

    if (!code.trim()) {
      setError("Kupon kodu zorunludur");
      return;
    }
    const perc = Number(percentage);
    if (!Number.isFinite(perc) || perc <= 0 || perc > 100) {
      setError("Yüzde değeri 1 ile 100 arasında olmalıdır");
      return;
    }
    const min = Number(minSubtotal || 0);
    if (!Number.isFinite(min) || min < 0) {
      setError("Minimum sepet tutarı sıfır veya daha büyük olmalıdır");
      return;
    }

    setError("");
    onSubmit?.({
      code: code.trim().toUpperCase(),
      description: description.trim(),
      percentage: perc,
      minSubtotal: min,
      active,
    });
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={isEditing ? "Kuponu Düzenle" : "Kupon Oluştur"}
      description="Ödeme sırasında yüzde indirimi uygulayan benzersiz kodlar oluşturun."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
            disabled={submitting}
          >
            İptal
          </button>
          <button
            type="submit"
            form="coupon-form"
            className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            disabled={submitting}
          >
            {isEditing ? "Değişiklikleri Kaydet" : "Kupon Oluştur"}
          </button>
        </>
      }
    >
      <form id="coupon-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <AlertBanner
            variant="danger"
            message={error}
            onClose={() => setError("")}
          />
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
            Kod
          </span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={32}
            className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
            placeholder="SUMMER20"
            disabled={submitting || isEditing}
          />
          <p className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
            Kodlar büyük harflerle saklanır ve benzersiz olmalıdır.
          </p>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              İndirim Yüzdesi
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2">
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={percentage}
                onChange={(event) => setPercentage(event.target.value)}
                className="w-full border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none"
                placeholder="10"
                disabled={submitting}
              />
              <span className="text-sm text-[var(--color-text-admin-muted)]">
                %
              </span>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
              Minimum Sepet Tutarı (isteğe bağlı)
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={minSubtotal}
              onChange={(event) => setMinSubtotal(event.target.value)}
              className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="0"
              disabled={submitting}
            />
            <p className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
              Herhangi bir sepet tutarında kullanım için boş bırakın.
            </p>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
            Açıklama
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
            placeholder="İç notlar"
            disabled={submitting}
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-admin)]">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border-admin)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            disabled={submitting}
          />
          Hemen aktif et
        </label>
      </form>
    </AdminModal>
  );
}
