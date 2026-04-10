// src/pages/admin/AdminCustomers.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Filter,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserX,
  Undo2,
} from "lucide-react";
import AdminModal from "../../components/admin/common/AdminModal.jsx";
import UserStats from "../../components/admin/users/UserStats.jsx";
import UserTable from "../../components/admin/users/UserTable.jsx";
import UserProfileDetails from "../../components/admin/users/UserProfileDetails.jsx";
import { userApi } from "../../api/users";
import { getUser as getCachedUser } from "../../api/client";
import AlertBanner from "../../components/ui/AlertBanner.jsx";

const LIMIT_OPTIONS = [10, 20, 50, 100];
const ROLE_OPTIONS = [
  { value: "", label: "Tüm roller" },
  { value: "user", label: "Müşteriler" },
  { value: "admin", label: "Yöneticiler" },
];
const SORT_OPTIONS = [
  { value: "recent", label: "En yeni önce" },
  { value: "oldest", label: "En eski önce" },
  { value: "name", label: "İsim A-Z" },
  { value: "role", label: "Rol" },
];
const STATUS_OPTIONS = [
  { value: "all", label: "Tüm durumlar" },
  { value: "active", label: "Sadece aktif" },
  { value: "deleted", label: "Sadece silinmiş" },
];

export default function AdminCustomers() {
  const [users, setUsers] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [searchValue, setSearchValue] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // NEW
  const [sort, setSort] = useState("recent");
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: 20,
  });
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pendingUserId, setPendingUserId] = useState(null);

  const debouncedSearch = useDebounce(searchValue, 400);
  const me = useMemo(() => getCachedUser(), []);

  const loadUsers = useCallback(
    async (page = 1, overrides = {}) => {
      setLoading(true);
      try {
        const resolvedLimit = overrides.limit ?? limit;
        const resolvedRole =
          overrides.role !== undefined ? overrides.role : roleFilter;
        const resolvedStatus =
          overrides.status !== undefined ? overrides.status : statusFilter;
        const resolvedSort = overrides.sort ?? sort;
        const resolvedSearch =
          overrides.search !== undefined ? overrides.search : debouncedSearch;

        const params = {
          page,
          limit: resolvedLimit,
          sort: resolvedSort,
          status: resolvedStatus,
        };
        if (resolvedRole) params.role = resolvedRole;
        if (resolvedSearch) params.search = resolvedSearch;

        const data = await userApi.list(params);
        setUsers(data.users || []);
        setMetrics(data.metrics || {});
        setPagination({
          page: data.pagination?.page || page,
          pages: data.pagination?.pages || 1,
          total: data.pagination?.total || 0,
          limit: resolvedLimit,
        });
      } catch (error) {
        setBanner({ variant: "danger", message: extractMessage(error) });
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, limit, roleFilter, sort, statusFilter]
  );

  useEffect(() => {
    loadUsers(1);
  }, [loadUsers]);

  const handleChangeRole = async (user, nextRole) => {
    setPendingUserId(user.id);
    try {
      const updated = await userApi.update(user.id, { role: nextRole });
      setUsers((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setBanner({
        variant: "success",
        message:
          updated.role === "admin"
            ? `${updated.fullName || updated.email} artık yönetici`
            : `${updated.fullName || updated.email} müşteri olarak güncellendi`,
      });
      if (selectedUser?.id === updated.id) setSelectedUser(updated);
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    } finally {
      setPendingUserId(null);
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setDetailOpen(true);
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > pagination.pages) return;
    setPagination((prev) => ({ ...prev, page }));
    loadUsers(page);
  };

  const handleRefresh = () => {
    loadUsers(pagination.page);
  };

  const handleClearFilters = () => {
    setSearchValue("");
    setRoleFilter("");
    setStatusFilter("all");
    setSort("recent");
    setLimit(20);
    setPagination((prev) => ({ ...prev, page: 1, limit: 20 }));
  };

  const handleSoftDelete = async (user) => {
    setPendingUserId(user.id);
    try {
      const updated = await userApi.softDelete(user.id);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      if (selectedUser?.id === updated.id) setSelectedUser(updated);
      setBanner({
        variant: "warning",
        message: `${user.fullName || user.email} pasifleştirildi`,
      });
    } catch (e) {
      setBanner({ variant: "danger", message: extractMessage(e) });
    } finally {
      setPendingUserId(null);
    }
  };

  const handleRestore = async (user) => {
    setPendingUserId(user.id);
    try {
      const updated = await userApi.restore(user.id);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      if (selectedUser?.id === updated.id) setSelectedUser(updated);
      setBanner({
        variant: "success",
        message: `${user.fullName || user.email} geri yüklendi`,
      });
    } catch (e) {
      setBanner({ variant: "danger", message: extractMessage(e) });
    } finally {
      setPendingUserId(null);
    }
  };

  const filtersActive =
    Boolean(roleFilter) ||
    Boolean(searchValue) ||
    sort !== "recent" ||
    limit !== 20 ||
    statusFilter !== "all";

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-admin)]">
            Müşteriler
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
            Müşteri tabanını görüntüle, ara, filtrele, rolleri düzenle ve hesap durumlarını yönet.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
          >
            <RefreshCw className="h-4 w-4" /> Yenile
          </button>
          {filtersActive && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
            >
              <Filter className="h-4 w-4" /> Filtreleri temizle
            </button>
          )}
        </div>
      </header>

      <UserStats metrics={metrics} />

      <div className="grid gap-4 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4 shadow-sm md:grid-cols-5">
        <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5">
          <Search className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
          <input
            value={searchValue}
            onChange={(event) => {
              setSearchValue(event.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            placeholder="İsim, e-posta veya telefon ara"
            className="w-full border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none"
          />
        </label>

        <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5">
          <SlidersHorizontal className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5">
          <SlidersHorizontal className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5">
          <SlidersHorizontal className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="w-full border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5">
          <span className="text-sm text-[var(--color-text-admin-muted)]">
            Sayfa başına
          </span>
          <select
            value={limit}
            onChange={(event) => {
              const value = Number(event.target.value) || 20;
              setLimit(value);
              setPagination((prev) => ({ ...prev, page: 1, limit: value }));
            }}
            className="w-full border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none"
          >
            {LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {banner && (
        <AlertBanner
          variant={banner.variant}
          message={banner.message}
          onClose={() => setBanner(null)}
        />
      )}

      <UserTable
        users={users}
        loading={loading}
        onSelect={handleSelectUser}
        onChangeRole={handleChangeRole}
        onSoftDelete={handleSoftDelete} // NEW
        onRestore={handleRestore} // NEW
        currentUserId={me?.id}
        pendingUserId={pendingUserId}
      />

      {pagination.pages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text-admin)] md:flex-row">
          <div>
            {pagination.total} kullanıcı • sayfa {pagination.page} /{" "}
            {pagination.pages}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
            >
              Önceki
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
            >
              Sonraki
            </button>
          </div>
        </div>
      )}

      <AdminModal
        open={detailOpen && Boolean(selectedUser)}
        onClose={() => {
          setDetailOpen(false);
          setSelectedUser(null);
        }}
        title="Müşteri detayları"
        description={selectedUser?.email}
      >
        <UserProfileDetails user={selectedUser} />
      </AdminModal>
    </section>
  );
}

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function extractMessage(error) {
  if (!error) return "Beklenmeyen hata";
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return parsed.message;
    } catch {
      /* ignore */
    }
    return error.message;
  }
  return String(error);
}
