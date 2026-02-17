import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { extractErrorMessage } from "../helpers.js";
import AlertBanner from "../../../components/ui/AlertBanner.jsx";
import LoadingOverlay from "../../../components/ui/LoadingOverlay.jsx";
import {
  formatTrPhoneForInput,
  formatTrPhoneForSubmit,
} from "../../../utils/phoneMask.js";

function emptyAddress() {
  return {
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    isDefault: false,
  };
}

function cleanAddress(address) {
  return {
    fullName: String(address.fullName || "").trim(),
    phone: formatTrPhoneForSubmit(address.phone),
    addressLine: String(
      [address.addressLine1, address.addressLine2]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .join(" ")
    ),
    city: String(address.city || "").trim(),
    district: String(address.state || "").trim(),
    postalCode: String(address.postalCode || "").trim(),
    country: String(address.country || "").trim(),
    isDefault: !!address.isDefault,
  };
}

function AddressField({
  label,
  value,
  onChange,
  required,
  wide,
  type = "text",
  inputMode,
  autoComplete,
}) {
  return (
    <label className={wide ? "sm:col-span-2 block" : "block"}>
      <span className="mb-1 block text-sm font-medium text-primary">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      <input
        className="w-full rounded-lg border border-border bg-contact-bg px-3 py-2 text-sm outline-none"
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}

export default function AddressesSection({ addresses, onCreate, onUpdate, onDelete, copy = {} }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyAddress());
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);
  const fieldCopy = copy.fields || {};
  const buttonsCopy = copy.buttons || {};
  const bannersCopy = copy.banners || {};

  const startNew = () => {
    setForm(emptyAddress());
    setEditingId("new");
  };

  const startEdit = (address) => {
    setForm({
      ...address,
      phone: formatTrPhoneForInput(address.phone || ""),
      addressLine1: address.addressLine || address.addressLine1 || "",
      addressLine2: address.addressLine2 || "",
      state: address.district || address.state || "",
    });
    setEditingId(address.id);
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyAddress());
  };

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    setSaving(true);
    try {
      if (editingId === "new") {
        await onCreate(cleanAddress(form));
        setBanner({ variant: "success", message: bannersCopy.added || "Adres eklendi" });
      } else if (editingId) {
        await onUpdate(editingId, cleanAddress(form));
        setBanner({ variant: "success", message: bannersCopy.updated || "Adres güncellendi" });
      }
      cancel();
    } catch (error) {
      setBanner({
        variant: "danger",
        message: extractErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await onDelete(id);
      setBanner({ variant: "warning", message: bannersCopy.removed || "Adres silindi" });
    } catch (error) {
      setBanner({ variant: "danger", message: extractErrorMessage(error) });
    }
  };

  return (
    <div>
      {banner && (
        <div className="mb-4">
          <AlertBanner
            variant={banner.variant}
            message={banner.message}
            onClose={() => setBanner(null)}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-primary">
          {copy.heading || "Adresler"}
        </h2>
        <button
          onClick={startNew}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-primary hover:bg-surface-hover"
        >
          <Plus className="h-4 w-4" />
          {copy.addNew || "Yeni adres ekle"}
        </button>
      </div>

      {addresses.length === 0 && !editingId && (
        <p className="mt-2 text-secondary">{copy.empty || "Kayıtlı adres yok."}</p>
      )}

      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {addresses.map((address) => (
          <li
            key={address.id}
            className="rounded-xl border border-border bg-contact-bg p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-primary">{address.fullName}</div>
                <div className="mt-1 text-sm text-secondary whitespace-pre-line">
                  {address.addressLine || address.addressLine1}
                </div>
                <div className="mt-1 text-sm text-secondary">
                  {address.city}, {address.district || address.state || "-"}{" "}
                  {address.postalCode}
                </div>
                <div className="text-sm text-secondary">{address.country}</div>
                {address.phone && (
                  <div className="text-sm text-secondary">
                    📞 {formatTrPhoneForInput(address.phone) || address.phone}
                  </div>
                )}
                {address.isDefault && (
                  <div className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                    {copy.badgeDefault || "Varsayılan"}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(address)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-hover"
                  title={copy.edit || "Düzenle"}
                >
                  <Pencil className="h-4 w-4 text-secondary" />
                </button>
                <button
                  onClick={() => handleDelete(address.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-hover"
                  title={copy.delete || "Sil"}
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {editingId && (
        <form
          onSubmit={handleSubmit}
          className="relative mt-6 rounded-2xl border border-border bg-white p-4"
        >
          <LoadingOverlay show={saving} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AddressField
              label={fieldCopy.fullName || "Ad Soyad"}
              value={form.fullName}
              onChange={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
              required
            />
            <AddressField
              label={fieldCopy.phone || "Telefon"}
              value={form.phone}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  phone: formatTrPhoneForInput(value),
                }))
              }
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
            />
            <AddressField
              label={fieldCopy.address1 || "Adres Satırı 1"}
              value={form.addressLine1}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, addressLine1: value }))
              }
              required
              wide
            />
            <AddressField
              label={fieldCopy.address2 || "Adres Satırı 2"}
              value={form.addressLine2}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, addressLine2: value }))
              }
              wide
            />
            <AddressField
              label={fieldCopy.city || "Şehir"}
              value={form.city}
              onChange={(value) => setForm((prev) => ({ ...prev, city: value }))}
              required
            />
            <AddressField
              label={fieldCopy.state || "İl/İlçe"}
              value={form.state}
              onChange={(value) => setForm((prev) => ({ ...prev, state: value }))}
            />
            <AddressField
              label={fieldCopy.postalCode || "Posta Kodu"}
              value={form.postalCode}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, postalCode: value }))
              }
            />
            <AddressField
              label={fieldCopy.country || "Ülke"}
              value={form.country}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, country: value }))
              }
              required
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={cancel}
              className="rounded-full border border-border px-4 py-2 text-sm text-secondary hover:bg-surface-hover"
            >
              {buttonsCopy.cancel || "Vazgeç"}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {saving
                ? buttonsCopy.saving || "Kaydediliyor..."
                : buttonsCopy.save || "Adresi kaydet"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
