// src/components/admin/users/UserProfileDetails.jsx
import {
  CalendarClock,
  IdCard,
  Mail,
  Phone,
  ShieldCheck,
  UserX,
  Undo2,
} from "lucide-react";
import {
  formatDate,
  formatDateTime,
  formatRelative,
  roleBadge,
} from "./helpers.js";

export default function UserProfileDetails({ user }) {
  if (!user) return null;
  const role = roleBadge(user.role);
  const isDeleted = Boolean(user.isDeleted);

  return (
    <div className="space-y-8 text-[var(--color-text-admin)]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[var(--color-bg-hover)] text-2xl font-semibold">
            {user.initials}
          </div>
          <div>
            <h3 className="text-xl font-semibold">
              {user.fullName || "İsimsiz müşteri"}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
              Katıldı {formatDate(user.createdAt)} ·{" "}
              {formatRelative(user.createdAt)}
            </p>
            {isDeleted && (
              <p className="mt-1 text-xs text-rose-700">
                Silindi {user.deletedAt ? formatRelative(user.deletedAt) : ""}{" "}
                {user.deletedAlias ? (
                  <>
                    · takma ad:{" "}
                    <span className="italic">{user.deletedAlias}</span>
                  </>
                ) : null}
              </p>
            )}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-2 self-start rounded-full px-4 py-1.5 text-xs font-semibold ${role.className}`}
        >
          {user.role === "admin" ? <ShieldCheck className="h-4 w-4" /> : null}
          {role.label}
        </span>
      </header>

      {isDeleted && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UserX className="h-4 w-4" /> Bu hesap pasif (yumuşak silinmiş).
          </div>
          <p className="mt-1 text-xs">
            Siparişler, yorumlar ve geçmiş yukarıdaki takma ad altında korunur.
          </p>
        </div>
      )}

      <section className="grid gap-4 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-5 md:grid-cols-2">
        <InfoItem
          icon={Mail}
          label="E-posta"
          value={user.email}
          href={`mailto:${user.email}`}
          helper="Birincil iletişim"
        />
        <InfoItem
          icon={Phone}
          label="Telefon"
          value={user.phone || "Belirtilmedi"}
          href={user.phone ? `tel:${user.phone}` : undefined}
          helper={user.phone ? "Aramak için dokunun" : "Telefon numarası yok"}
        />

        <InfoItem
          icon={IdCard}
          label="Müşteri ID"
          value={user.id}
          helper={`Son güncelleme ${
            formatRelative(user.updatedAt) || "az önce"
          }`}
        />
        <InfoItem
          icon={CalendarClock}
          label="Kayıt Tarihi"
          value={formatDateTime(user.createdAt)}
          helper="Sistem zamanı"
        />
      </section>
    </div>
  );
}

function InfoItem({ icon, label, value, helper, href }) {
  const Icon = icon;
  const Wrapper = href ? "a" : "div";
  const wrapperProps = href ? { href } : {};
  return (
    <Wrapper
      {...wrapperProps}
      className={`flex items-start gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors ${
        href ? "hover:border-[var(--color-border-admin)]" : ""
      }`}
    >
      <div className="mt-1 grid h-8 w-8 place-items-center rounded-full bg-[var(--color-bg-hover)] text-[var(--color-text-admin-muted)]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--color-text-admin-muted)]">
          {label}
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--color-text-admin)]">
          {value}
        </p>
        {helper && (
          <p className="mt-0.5 text-xs text-[var(--color-text-admin-muted)]">
            {helper}
          </p>
        )}
      </div>
    </Wrapper>
  );
}
