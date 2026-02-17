import { useEffect, useState } from "react";
import { User as UserIcon, Mail, Phone, X } from "lucide-react";
import { extractErrorMessage } from "../helpers.js";
import Avatar from "../../../components/ui/Avatar.jsx";
import {
  formatTrPhoneForInput,
  formatTrPhoneForSubmit,
} from "../../../utils/phoneMask.js";

function Field({
  label,
  value,
  onChange,
  icon,
  help,
  type = "text",
  inputMode,
  autoComplete,
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-primary">
        {label}
      </span>
      <div className="flex items-center rounded-lg border border-border bg-contact-bg px-3 py-2">
        {icon && <span className="mr-2 text-secondary">{icon}</span>}
        <input
          className="w-full border-none bg-transparent text-sm outline-none"
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {help && (
        <span className="mt-1 block text-xs text-secondary">{help}</span>
      )}
    </label>
  );
}

export default function OverviewSection({ user, profile, avatarSrc, onSave, copy = {} }) {
  const [form, setForm] = useState({
    firstName: profile?.firstName ?? user?.firstName ?? "",
    lastName: profile?.lastName ?? user?.lastName ?? "",
    email: profile?.email ?? user?.email ?? "",
    phone: formatTrPhoneForInput(profile?.phone ?? user?.phone ?? ""),
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const fieldsCopy = copy.fields || {};
  const avatarCopy = copy.avatar || {};
  const buttonsCopy = copy.buttons || {};

  useEffect(() => {
    setForm({
      firstName: profile?.firstName ?? user?.firstName ?? "",
      lastName: profile?.lastName ?? user?.lastName ?? "",
      email: profile?.email ?? user?.email ?? "",
      phone: formatTrPhoneForInput(profile?.phone ?? user?.phone ?? ""),
    });
  }, [profile, user]);

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    setSaving(true);
    setMessage(null);
    try {
      await onSave({
        ...form,
        phone: formatTrPhoneForSubmit(form.phone),
        avatarFile,
        removeAvatar,
      });
      setAvatarFile(null);
      setRemoveAvatar(false);
      setMessage({ type: "success", text: copy.success || "Profil güncellendi" });
    } catch (error) {
      setMessage({ type: "error", text: extractErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const currentAvatarPreview = avatarFile
    ? URL.createObjectURL(avatarFile)
    : avatarSrc;

  const avatarName =
    profile?.firstName || user?.firstName
      ? `${profile?.firstName ?? user?.firstName ?? ""} ${
          profile?.lastName ?? user?.lastName ?? ""
        }`.trim()
      : user?.name || profile?.email || user?.email || (fieldsCopy.customerFallback || "Müşteri");

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-primary">
        {copy.heading || "Hesap Özeti"}
      </h2>
      <p className="mt-2 text-secondary">
        {copy.description || "Kişisel bilgilerinizi ve profil fotoğrafınızı güncelleyin."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {message && (
          <div
            className={[
              "rounded-lg px-3 py-2 text-sm",
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200",
            ].join(" ")}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={fieldsCopy.firstName || "Ad"}
            value={form.firstName}
            onChange={(v) => onChange("firstName", v)}
            icon={<UserIcon className="h-4 w-4" />}
          />
          <Field
            label={fieldsCopy.lastName || "Soyad"}
            value={form.lastName}
            onChange={(v) => onChange("lastName", v)}
            icon={<UserIcon className="h-4 w-4" />}
          />
        </div>

        <Field
          label={fieldsCopy.email || "E-posta"}
          value={form.email}
          onChange={(v) => onChange("email", v)}
          icon={<Mail className="h-4 w-4" />}
          help={fieldsCopy.emailHelp || "E-posta değişikliği sonrasında doğrulama gerekebilir."}
        />

        <Field
          label={fieldsCopy.phone || "Telefon"}
          value={form.phone}
          onChange={(v) => onChange("phone", formatTrPhoneForInput(v))}
          icon={<Phone className="h-4 w-4" />}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
        />

        <div className="rounded-xl border border-border bg-contact-bg p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar
                src={currentAvatarPreview}
                name={avatarName}
                alt={avatarName}
                className="h-12 w-12 border border-border bg-white text-base"
              />
              <div>
                <div className="text-sm font-medium text-primary">
                  {avatarCopy.title || "Profil fotoğrafı"}
                </div>
                <div className="text-xs text-secondary">
                  {avatarCopy.helper || "Sadece JPG/PNG. Yüklemeler otomatik sıkıştırılır."}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(avatarSrc || currentAvatarPreview) && (
                <button
                  type="button"
                  onClick={() => setRemoveAvatar((state) => !state)}
                  className={[
                    "rounded-full px-3 py-1.5 text-sm border",
                    removeAvatar
                      ? "border-rose-300 text-rose-700 bg-rose-50"
                      : "border-border text-primary hover:bg-surface-hover",
                  ].join(" ")}
                >
                  {removeAvatar
                    ? avatarCopy.removeActive || "Kaldırılacak"
                    : avatarCopy.remove || "Kaldır"}
                </button>
              )}

              <label className="inline-flex cursor-pointer items-center rounded-full border border-border bg-white px-3 py-1.5 text-sm hover:bg-surface-hover">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                />
                {avatarCopy.upload || "Yükle"}
              </label>
            </div>
          </div>

          {avatarFile && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-white p-2">
              <div className="truncate text-sm text-primary">{avatarFile.name}</div>
              <button
                type="button"
                onClick={() => setAvatarFile(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface-hover"
                title={avatarCopy.removeFile || "Dosyayı kaldır"}
              >
                <X className="h-4 w-4 text-secondary" />
              </button>
            </div>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {buttonsCopy.save || "Değişiklikleri kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
