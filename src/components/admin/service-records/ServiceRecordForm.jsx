import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import AdminModal from "../common/AdminModal.jsx";
import AlertBanner from "../../ui/AlertBanner.jsx";
import {
  formatTrPhoneForInput,
  formatTrPhoneForSubmit,
} from "../../../utils/phoneMask.js";

const WORKFLOW_OPTIONS = [
  { value: "new", label: "Yeni Kayıt" },
  { value: "in_progress", label: "İşlemde" },
  { value: "completed", label: "Tamamlandı" },
  { value: "delivered", label: "Teslim Edildi" },
  { value: "cancelled", label: "İptal" },
];

const OUTCOME_OPTIONS = [
  { value: "ongoing", label: "Tamir devam ediyor" },
  { value: "repaired", label: "Tamir tamamlandı" },
  { value: "returned_unrepaired", label: "Tamir yapılamadı / iade edildi" },
];

const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function revokeObjectUrl(item) {
  if (item?.type === "file" && item.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

export default function ServiceRecordForm({
  open,
  onClose,
  onSubmit,
  submitting = false,
  initialRecord = null,
}) {
  const fileInputRef = useRef(null);
  const imageItemsRef = useRef([]);

  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [operationDetails, setOperationDetails] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState("6");
  const [intakeDate, setIntakeDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [workflowStatus, setWorkflowStatus] = useState("new");
  const [repairOutcome, setRepairOutcome] = useState("ongoing");
  const [imageItems, setImageItems] = useState([]);
  const [removeImagePublicIds, setRemoveImagePublicIds] = useState([]);
  const [error, setError] = useState("");

  const isEditing = Boolean(initialRecord?.id);
  const maxFiles = 4;
  const remainingSlots = Math.max(0, maxFiles - imageItems.length);

  useEffect(() => {
    if (!open) return;

    setCustomerFirstName(initialRecord?.customerFirstName || "");
    setCustomerLastName(initialRecord?.customerLastName || "");
    setCustomerPhone(formatTrPhoneForInput(initialRecord?.customerPhone || ""));
    setOperationDetails(initialRecord?.operationDetails || "");
    setWarrantyMonths(String(initialRecord?.warrantyMonths ?? 6));
    setIntakeDate(toDateInput(initialRecord?.intakeDate));
    setCompletionDate(toDateInput(initialRecord?.completionDate));
    setWorkflowStatus(initialRecord?.workflowStatus || "new");
    setRepairOutcome(initialRecord?.repairOutcome || "ongoing");
    setRemoveImagePublicIds([]);

    const nextItems = (initialRecord?.images || []).map((asset) => ({
      id: createId(),
      type: "existing",
      asset,
    }));
    setImageItems((prev) => {
      prev.forEach(revokeObjectUrl);
      return nextItems;
    });
    setError("");
  }, [open, initialRecord]);

  useEffect(() => {
    imageItemsRef.current = imageItems;
  }, [imageItems]);

  useEffect(
    () => () => {
      imageItemsRef.current.forEach(revokeObjectUrl);
    },
    []
  );

  const imagePayload = useMemo(
    () =>
      imageItems.map((item) => {
        if (item.type === "existing") return item.asset;
        return item.file;
      }),
    [imageItems]
  );

  const handleAddFiles = (event) => {
    const incoming = Array.from(event.target.files || []);
    if (!incoming.length) return;
    if (remainingSlots <= 0) {
      setError("En fazla 4 görsel yükleyebilirsiniz.");
      event.target.value = "";
      return;
    }

    const accepted = incoming
      .filter((file) => file.type?.startsWith("image/"))
      .slice(0, remainingSlots)
      .map((file) => ({
        id: createId(),
        type: "file",
        file,
        previewUrl: URL.createObjectURL(file),
      }));

    setImageItems((prev) => [...prev, ...accepted]);
    setError("");
    event.target.value = "";
  };

  const handleRemoveImage = (itemId) => {
    setImageItems((prev) => {
      const target = prev.find((item) => item.id === itemId);
      if (target?.type === "existing" && target.asset?.publicId) {
        setRemoveImagePublicIds((old) =>
          Array.from(new Set([...old, target.asset.publicId]))
        );
      }
      if (target?.type === "file") {
        revokeObjectUrl(target);
      }
      return prev.filter((item) => item.id !== itemId);
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting) return;

    const normalizedPhone = formatTrPhoneForSubmit(customerPhone);
    if (!customerFirstName.trim() || !customerLastName.trim() || !normalizedPhone) {
      setError("Müşteri adı, soyadı ve telefon zorunludur.");
      return;
    }
    if (!operationDetails.trim()) {
      setError("İşlem detayı zorunludur.");
      return;
    }
    if (!intakeDate) {
      setError("Tamire alma tarihi zorunludur.");
      return;
    }
    if (completionDate && new Date(completionDate) < new Date(intakeDate)) {
      setError("Tamamlama tarihi, tamire alma tarihinden önce olamaz.");
      return;
    }

    const warranty = Number(warrantyMonths);
    if (!Number.isFinite(warranty) || warranty < 0 || warranty > 120) {
      setError("Garanti ayı 0-120 aralığında olmalıdır.");
      return;
    }

    setError("");
    onSubmit?.({
      customerFirstName: customerFirstName.trim(),
      customerLastName: customerLastName.trim(),
      customerPhone: normalizedPhone,
      operationDetails: operationDetails.trim(),
      warrantyMonths: Math.floor(warranty),
      intakeDate,
      completionDate: completionDate || null,
      workflowStatus,
      repairOutcome,
      images: imagePayload,
      removeImagePublicIds,
    });
  };

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title={isEditing ? "Servis Kaydını Düzenle" : "Servis Kaydı Oluştur"}
      description="Cihaz servis sürecini takip etmek için müşteri, işlem ve garanti bilgilerini kaydedin."
      widthClass="max-w-4xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
            disabled={submitting}
          >
            İptal
          </button>
          <button
            type="submit"
            form="service-record-form"
            className="rounded-full bg-[var(--color-text-admin)] px-5 py-2 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Kaydediliyor..." : isEditing ? "Kaydet" : "Kaydı Oluştur"}
          </button>
        </>
      }
    >
      <form id="service-record-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <AlertBanner
            variant="danger"
            message={error}
            onClose={() => setError("")}
          />
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-[var(--color-text-admin)]">Müşteri adı</span>
            <input
              value={customerFirstName}
              onChange={(event) => setCustomerFirstName(event.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-text-admin)]"
              placeholder="Örn. Ahmet"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-[var(--color-text-admin)]">Müşteri soyadı</span>
            <input
              value={customerLastName}
              onChange={(event) => setCustomerLastName(event.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-text-admin)]"
              placeholder="Örn. Yılmaz"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-[var(--color-text-admin)]">Telefon</span>
            <input
              value={customerPhone}
              onChange={(event) =>
                setCustomerPhone(formatTrPhoneForInput(event.target.value))
              }
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-text-admin)]"
              placeholder="+90 5xx xxx xx xx"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-[var(--color-text-admin)]">Garanti (ay)</span>
            <input
              type="number"
              min="0"
              max="120"
              value={warrantyMonths}
              onChange={(event) => setWarrantyMonths(event.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-text-admin)]"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-[var(--color-text-admin)]">Tamire alma tarihi</span>
            <input
              type="date"
              value={intakeDate}
              onChange={(event) => setIntakeDate(event.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-text-admin)]"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-[var(--color-text-admin)]">Tamamlama tarihi</span>
            <input
              type="date"
              value={completionDate}
              onChange={(event) => setCompletionDate(event.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-text-admin)]"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-[var(--color-text-admin)]">Durum</span>
            <select
              value={workflowStatus}
              onChange={(event) => setWorkflowStatus(event.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-text-admin)]"
            >
              {WORKFLOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-[var(--color-text-admin)]">Sonuç</span>
            <select
              value={repairOutcome}
              onChange={(event) => setRepairOutcome(event.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-text-admin)]"
            >
              {OUTCOME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[var(--color-text-admin)]">İşlem detayı</span>
          <textarea
            value={operationDetails}
            onChange={(event) => setOperationDetails(event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-text-admin)]"
            placeholder="Örn. Ekran değişimi, batarya kontrolü, soket temizliği..."
          />
        </label>

        <section className="space-y-3 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-admin)]">
                Servis görselleri
              </h3>
              <p className="text-xs text-[var(--color-text-admin-muted)]">
                En fazla 4 görsel. Görseller sıkıştırılarak kaydedilir.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={remainingSlots <= 0}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" />
              Görsel ekle ({remainingSlots})
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleAddFiles}
            />
          </div>

          {imageItems.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--color-border-admin)] px-3 py-6 text-center text-xs text-[var(--color-text-admin-muted)]">
              Henüz görsel eklenmedi.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {imageItems.map((item) => {
                const previewSrc =
                  item.type === "existing" ? item.asset?.url : item.previewUrl;
                return (
                  <article
                    key={item.id}
                    className="group relative overflow-hidden rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewSrc}
                      alt="Servis görseli"
                      className="h-28 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(item.id)}
                      className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                      title="Görseli kaldır"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </form>
    </AdminModal>
  );
}
