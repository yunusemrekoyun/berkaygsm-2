import { useCallback, useEffect, useMemo, useState } from "react";
import { PlusCircle, RefreshCw, Search } from "lucide-react";
import AlertBanner from "../../components/ui/AlertBanner.jsx";
import { useConfirm } from "../../components/ui/ConfirmDialog.jsx";
import { serviceRecordsApi } from "../../api/serviceRecords.js";
import ServiceRecordTable from "../../components/admin/service-records/ServiceRecordTable.jsx";
import ServiceRecordForm from "../../components/admin/service-records/ServiceRecordForm.jsx";

const WORKFLOW_OPTIONS = [
  { value: "", label: "Tüm durumlar" },
  { value: "new", label: "Yeni Kayıt" },
  { value: "in_progress", label: "İşlemde" },
  { value: "completed", label: "Tamamlandı" },
  { value: "delivered", label: "Teslim Edildi" },
  { value: "cancelled", label: "İptal" },
];

const OUTCOME_OPTIONS = [
  { value: "", label: "Tüm sonuçlar" },
  { value: "ongoing", label: "Tamir devam ediyor" },
  { value: "repaired", label: "Tamir tamamlandı" },
  { value: "returned_unrepaired", label: "Tamir yapılamadı / iade" },
];

const VISIBILITY_OPTIONS = [
  { value: "active", label: "Aktif Kayıtlar" },
  { value: "all", label: "Tümü (Arşiv Dahil)" },
  { value: "deleted", label: "Sadece Arşiv" },
];

const SORT_OPTIONS = [
  { value: "recent", label: "En yeni kayıt" },
  { value: "oldest", label: "En eski kayıt" },
  { value: "intake_desc", label: "Tamire alma (yeni-eski)" },
  { value: "intake_asc", label: "Tamire alma (eski-yeni)" },
  { value: "completion_desc", label: "Tamamlama (yeni-eski)" },
  { value: "completion_asc", label: "Tamamlama (eski-yeni)" },
];

function extractMessage(error) {
  if (!error) return "İşlem sırasında beklenmeyen bir hata oluştu.";
  if (typeof error === "string") return error;
  if (error.message) {
    try {
      const parsed = JSON.parse(error.message);
      return parsed?.message || error.message;
    } catch {
      return error.message;
    }
  }
  return "İşlem sırasında beklenmeyen bir hata oluştu.";
}

export default function AdminServiceRecords() {
  const confirm = useConfirm();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState(null);

  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: 20,
  });

  const [filters, setFilters] = useState({
    q: "",
    workflowStatus: "",
    repairOutcome: "",
    visibility: "active",
    fromDate: "",
    toDate: "",
    sort: "recent",
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const loadRecords = useCallback(
    async (nextPage = pagination.page, nextFilters = filters) => {
      setLoading(true);
      try {
        const visibility = nextFilters.visibility || "active";
        const params = {
          page: nextPage,
          limit: pagination.limit,
          q: nextFilters.q || undefined,
          workflowStatus: nextFilters.workflowStatus || undefined,
          repairOutcome: nextFilters.repairOutcome || undefined,
          fromDate: nextFilters.fromDate || undefined,
          toDate: nextFilters.toDate || undefined,
          sort: nextFilters.sort || "recent",
          includeDeleted: visibility === "all" ? "true" : undefined,
          deletedOnly: visibility === "deleted" ? "true" : undefined,
        };

        const data = await serviceRecordsApi.list(params);
        setRecords(data.records || []);
        setPagination((prev) => ({
          ...prev,
          ...(data.pagination || {}),
          page: data.pagination?.page || nextPage,
        }));
      } catch (error) {
        setBanner({ variant: "danger", message: extractMessage(error) });
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.limit, pagination.page]
  );

  useEffect(() => {
    loadRecords(1, filters);
  }, [filters, loadRecords]);

  const activeCount = useMemo(
    () => records.filter((record) => !record.isDeleted).length,
    [records]
  );

  const openCreate = () => {
    setEditingRecord(null);
    setFormOpen(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingRecord(null);
    setSubmitting(false);
  };

  const handleSubmit = async (payload) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (editingRecord?.id) {
        await serviceRecordsApi.update(editingRecord.id, payload);
        setBanner({ variant: "success", message: "Servis kaydı güncellendi." });
      } else {
        await serviceRecordsApi.create(payload);
        setBanner({ variant: "success", message: "Servis kaydı oluşturuldu." });
      }
      closeForm();
      await loadRecords(1, filters);
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
      setSubmitting(false);
    }
  };

  const handleDelete = async (record) => {
    const ok = await confirm({
      title: "Servis kaydını arşivle",
      description: `${record.trackingNo} arşive taşınsın mı?`,
      confirmText: "Arşivle",
      tone: "danger",
    });
    if (!ok) return;

    try {
      await serviceRecordsApi.remove(record.id);
      setBanner({ variant: "warning", message: "Servis kaydı arşive taşındı." });
      await loadRecords(pagination.page, filters);
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  };

  const handleRestore = async (record) => {
    try {
      await serviceRecordsApi.restore(record.id);
      setBanner({ variant: "success", message: "Servis kaydı geri alındı." });
      await loadRecords(pagination.page, filters);
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  };

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.pages) return;
    loadRecords(nextPage, filters);
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-admin)]">
            Servis Kayıtları
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
            Tamir süreçlerini takip edin, garanti durumunu izleyin ve arşiv kayıtlarını yönetin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadRecords(pagination.page, filters)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
          >
            <RefreshCw className="h-4 w-4" />
            Yenile
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90"
          >
            <PlusCircle className="h-4 w-4" />
            Yeni Kayıt
          </button>
        </div>
      </header>

      {banner && (
        <AlertBanner
          variant={banner.variant}
          message={banner.message}
          onClose={() => setBanner(null)}
        />
      )}

      <section className="grid gap-4 rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4 md:grid-cols-12">
        <label className="md:col-span-4 flex items-center gap-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2.5">
          <Search className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
          <input
            value={filters.q}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, q: event.target.value }))
            }
            placeholder="Takip no, müşteri, telefon veya işlem detayı ara"
            className="w-full border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none"
          />
        </label>

        <select
          value={filters.workflowStatus}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, workflowStatus: event.target.value }))
          }
          className="md:col-span-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none"
        >
          {WORKFLOW_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={filters.repairOutcome}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, repairOutcome: event.target.value }))
          }
          className="md:col-span-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none"
        >
          {OUTCOME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={filters.visibility}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, visibility: event.target.value }))
          }
          className="md:col-span-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none"
        >
          {VISIBILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, sort: event.target.value }))
          }
          className="md:col-span-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2.5 text-sm text-[var(--color-text-admin)] outline-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="md:col-span-2 flex flex-col gap-1 text-xs text-[var(--color-text-admin-muted)]">
          Başlangıç tarihi
          <input
            type="date"
            value={filters.fromDate}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, fromDate: event.target.value }))
            }
            className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none"
          />
        </label>
        <label className="md:col-span-2 flex flex-col gap-1 text-xs text-[var(--color-text-admin-muted)]">
          Bitiş tarihi
          <input
            type="date"
            value={filters.toDate}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, toDate: event.target.value }))
            }
            className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none"
          />
        </label>
      </section>

      <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text-admin-muted)]">
        Görüntülenen kayıt: <strong className="text-[var(--color-text-admin)]">{records.length}</strong>{" "}
        | Aktif: <strong className="text-[var(--color-text-admin)]">{activeCount}</strong>{" "}
        | Toplam: <strong className="text-[var(--color-text-admin)]">{pagination.total}</strong>
      </div>

      <ServiceRecordTable
        records={records}
        loading={loading}
        onEdit={openEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
      />

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-4 py-3 text-sm">
        <p className="text-[var(--color-text-admin-muted)]">
          Sayfa {pagination.page} / {pagination.pages}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
            className="rounded-full border border-[var(--color-border-admin)] px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Önceki
          </button>
          <button
            type="button"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages || loading}
            className="rounded-full border border-[var(--color-border-admin)] px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sonraki
          </button>
        </div>
      </footer>

      <ServiceRecordForm
        open={formOpen}
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        initialRecord={editingRecord}
      />
    </section>
  );
}
