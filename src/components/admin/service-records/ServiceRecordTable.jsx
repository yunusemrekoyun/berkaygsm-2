import { Edit3, RotateCcw, Trash2 } from "lucide-react";
import { formatTrPhoneForInput } from "../../../utils/phoneMask.js";

const workflowLabels = {
  new: "Yeni Kayıt",
  in_progress: "İşlemde",
  completed: "Tamamlandı",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
};

const workflowTone = {
  new: "bg-slate-100 text-slate-700 ring-slate-200",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  delivered: "bg-teal-50 text-teal-700 ring-teal-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
};

const outcomeLabels = {
  ongoing: "Tamir devam ediyor",
  repaired: "Tamir tamamlandı",
  returned_unrepaired: "Tamir yapılamadı / iade",
};

const warrantyTone = {
  pending: "bg-slate-100 text-slate-700 ring-slate-200",
  no_warranty: "bg-slate-100 text-slate-700 ring-slate-200",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  expired: "bg-rose-50 text-rose-700 ring-rose-200",
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatMoney = (value) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

function Badge({ label, className }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${className}`}
    >
      {label}
    </span>
  );
}

export default function ServiceRecordTable({
  records = [],
  loading = false,
  onEdit,
  onDelete,
  onRestore,
}) {
  return (
    <section className="rounded-3xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]">
      <div className="admin-table-container overflow-x-auto">
        <table className="admin-table min-w-full divide-y divide-[var(--color-border-admin)]/60 text-sm">
          <thead className="bg-[var(--color-bg-admin)]/60">
            <tr className="text-left text-[var(--color-text-admin-muted)]">
              <th className="px-4 py-3 font-medium">Takip No</th>
              <th className="px-4 py-3 font-medium">Müşteri</th>
              <th className="px-4 py-3 font-medium">Durum / Sonuç</th>
              <th className="px-4 py-3 font-medium">Fiyat</th>
              <th className="px-4 py-3 font-medium">Garanti</th>
              <th className="px-4 py-3 font-medium">Tarih</th>
              <th className="px-4 py-3 font-medium text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-admin)]/50">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm">
                  Servis kayıtları yükleniyor...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm">
                  Kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr
                  key={record.id}
                  className={record.isDeleted ? "opacity-60" : "hover:bg-[var(--color-bg-admin)]/40"}
                >
                  <td data-label="Takip No" className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <p className="font-semibold text-[var(--color-text-admin)]">
                        {record.trackingNo}
                      </p>
                      {record.isDeleted && (
                        <Badge
                          label="Arşivlendi"
                          className="bg-amber-50 text-amber-700 ring-amber-200"
                        />
                      )}
                    </div>
                  </td>
                  <td data-label="Müşteri" className="px-4 py-3 align-top">
                    <p className="font-medium text-[var(--color-text-admin)]">
                      {record.customerFullName || "—"}
                    </p>
                    <p className="text-xs text-[var(--color-text-admin-muted)]">
                      {formatTrPhoneForInput(record.customerPhone) ||
                        record.customerPhone ||
                        "—"}
                    </p>
                  </td>
                  <td data-label="Durum / Sonuç" className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-1.5">
                      <Badge
                        label={workflowLabels[record.workflowStatus] || "—"}
                        className={
                          workflowTone[record.workflowStatus] ||
                          "bg-slate-100 text-slate-700 ring-slate-200"
                        }
                      />
                      <span className="text-xs text-[var(--color-text-admin-muted)]">
                        {outcomeLabels[record.repairOutcome] || "—"}
                      </span>
                    </div>
                  </td>
                  <td data-label="Fiyat" className="px-4 py-3 align-top">
                    <p className="font-semibold text-[var(--color-text-admin)]">
                      {formatMoney(record.price)}
                    </p>
                  </td>
                  <td data-label="Garanti" className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <Badge
                        label={record.warranty?.label || "—"}
                        className={
                          warrantyTone[record.warranty?.state] ||
                          "bg-slate-100 text-slate-700 ring-slate-200"
                        }
                      />
                      <p className="text-xs text-[var(--color-text-admin-muted)]">
                        {record.warranty?.endsAt
                          ? `Bitiş: ${formatDate(record.warranty.endsAt)}`
                          : "Bitiş tarihi yok"}
                      </p>
                    </div>
                  </td>
                  <td data-label="Tarih" className="px-4 py-3 align-top">
                    <div className="space-y-1 text-xs text-[var(--color-text-admin-muted)]">
                      <p>Alım: {formatDate(record.intakeDate)}</p>
                      <p>Tamam: {formatDate(record.completionDate)}</p>
                      <p>
                        Geçen gün:{" "}
                        {record.daysSinceCompletion != null
                          ? record.daysSinceCompletion
                          : "—"}
                      </p>
                    </div>
                  </td>
                  <td data-label="İşlemler" className="px-4 py-3 align-top">
                    <div className="mobile-full flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit?.(record)}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border-admin)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--color-bg-hover)]"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Düzenle
                      </button>
                      {record.isDeleted ? (
                        <button
                          type="button"
                          onClick={() => onRestore?.(record)}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Geri Al
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDelete?.(record)}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Sil
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
