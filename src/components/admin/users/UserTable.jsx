import {
  Eye,
  Mail,
  Phone,
  ShieldCheck,
  ShieldOff,
  UserX,
  Undo2,
} from "lucide-react";
import { formatDate, formatRelative, roleBadge } from "./helpers.js";

export default function UserTable({
  users = [],
  loading = false,
  onSelect,
  onChangeRole,
  onSoftDelete,
  onRestore,
  currentUserId,
  pendingUserId,
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-2xl bg-[var(--color-bg-hover)]"
          />
        ))}
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-6 py-14 text-center">
        <div className="max-w-md space-y-2">
          <p className="text-base font-medium text-[var(--color-text-admin)]">
            Henüz kullanıcı yok
          </p>
          <p className="text-sm text-[var(--color-text-admin-muted)]">
            Topluluğunuzu oluşturmak için kullanıcı davet edin veya müşteri
            listelerini içe aktarın.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-table-container overflow-x-auto rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-sm">
      <table className="admin-table w-full md:min-w-[820px] md:table-fixed divide-y divide-[var(--color-border-admin)]/70 text-sm">
        <thead className="bg-[var(--color-bg-hover)]/60 text-[var(--color-text-admin-muted)]">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Kullanıcı</th>
            <th className="px-4 py-3 text-left font-medium">İletişim</th>
            <th className="px-4 py-3 text-left font-medium">Rol</th>
            <th className="px-4 py-3 text-left font-medium">Katılma Tarihi</th>
            <th className="px-4 py-3 text-right font-medium">İşlemler</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-admin)]/60 text-[var(--color-text-admin)]">
          {users.map((user) => {
            const roleMeta = roleBadge(user.role);
            const isSelf = currentUserId && currentUserId === user.id;
            const nextRole = user.role === "admin" ? "user" : "admin";
            const isPending = pendingUserId && pendingUserId === user.id;
            const isDeleted = Boolean(user.isDeleted);
            const disableRoleChange =
              (isSelf && user.role === "admin") || isPending || isDeleted;

            return (
              <tr
                key={user.id}
                className={`transition-colors ${
                  isDeleted
                    ? "bg-[var(--color-bg-hover)]/30"
                    : "hover:bg-[var(--color-bg-hover)]/50"
                }`}
              >
                <td className="px-4 py-3" data-label="Kullanıcı">
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid h-12 w-12 place-items-center rounded-full text-base font-semibold ${
                        isDeleted
                          ? "bg-[var(--color-border-admin)]/40 text-[var(--color-text-admin-muted)]"
                          : "bg-[var(--color-bg-hover)]"
                      }`}
                    >
                      {user.initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-semibold ${
                            isDeleted ? "line-through opacity-70" : ""
                          }`}
                        >
                          {user.fullName || "—"}
                        </p>
                        {isDeleted && user.deletedAlias ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                            olarak{" "}
                            <span className="italic">{user.deletedAlias}</span>
                          </span>
                        ) : null}
                        {isDeleted ? (
                          <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                            <UserX className="h-3 w-3" /> Silindi
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-[var(--color-text-admin-muted)]">
                        ID #{user.id.slice(-6)}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3" data-label="İletişim">
                  <div className="flex flex-col gap-1">
                    <a
                      href={`mailto:${user.email}`}
                      className="inline-flex items-center gap-2 text-sm text-[var(--color-text-admin)] hover:text-[var(--color-accent)]"
                    >
                      <Mail className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
                      {user.email}
                    </a>
                    <div className="inline-flex items-center gap-2 text-xs text-[var(--color-text-admin-muted)]">
                      <Phone className="h-4 w-4" />
                      {user.phone || "—"}
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3" data-label="Rol">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                      roleMeta.className
                    } ${isDeleted ? "opacity-60" : ""}`}
                  >
                    {user.role === "admin" ? (
                      <ShieldCheck className="h-4 w-4" />
                    ) : null}
                    {roleMeta.label}
                  </span>
                </td>

                <td className="px-4 py-3" data-label="Katılma">
                  <div className="text-sm">{formatDate(user.createdAt)}</div>
                  <div className="text-xs text-[var(--color-text-admin-muted)]">
                    {formatRelative(user.createdAt)}
                  </div>
                </td>

                <td className="px-4 py-3 text-left md:text-right" data-label="İşlemler">
                  <div className="mobile-full flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                    <button
                      onClick={() => onSelect?.(user)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] md:w-auto"
                    >
                      <Eye className="h-4 w-4" /> Görüntüle
                    </button>

                    <button
                      onClick={() => onChangeRole?.(user, nextRole)}
                      disabled={disableRoleChange || !onChangeRole}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors md:w-auto ${
                        user.role === "admin"
                          ? "border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-60 disabled:hover:bg-transparent"
                          : "border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
                      }`}
                      title={
                        isDeleted
                          ? "Silinmiş hesaplarda rol değiştirilemez"
                          : isSelf && user.role === "admin"
                          ? "Kendi yönetici yetkini kaldıramazsın"
                          : user.role === "admin"
                          ? "Yönetici yetkisini kaldır"
                          : "Yönetici yap"
                      }
                    >
                      {isPending ? (
                        <span className="text-[var(--color-text-admin-muted)]">
                          Güncelleniyor...
                        </span>
                      ) : user.role === "admin" ? (
                        <>
                          <ShieldOff className="h-4 w-4" /> Yönetici Kaldır
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" /> Yönetici Yap
                        </>
                      )}
                    </button>

                    {!isDeleted ? (
                      <button
                        onClick={() => onSoftDelete?.(user)}
                        disabled={isSelf || isPending}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60 md:w-auto"
                        title={
                          isSelf
                            ? "Kendi hesabını silemezsin"
                            : "Pasif et (yumuşak silme)"
                        }
                      >
                        {isPending ? (
                          "İşleniyor..."
                        ) : (
                          <>
                            <UserX className="h-4 w-4" /> Sil
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => onRestore?.(user)}
                        disabled={isPending}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 disabled:opacity-60 md:w-auto"
                        title="Hesabı geri yükle"
                      >
                        {isPending ? (
                          "İşleniyor..."
                        ) : (
                          <>
                            <Undo2 className="h-4 w-4" /> Geri Yükle
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
