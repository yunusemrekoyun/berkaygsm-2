import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Loader2,
  MessageSquare,
  CheckCircle2,
  Clock3,
  ArrowRight,
} from "lucide-react";
import { reviewApi } from "../../../api/reviews";

const formatPreviewText = (review) => {
  if (!review) return "";
  if (review.title) return review.title;
  if (review.body) return review.body.slice(0, 80);
  return `Puan ${review.rating ?? "—"}`;
};

export default function ReviewSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({ pending: 0, approved: 0, total: 0 });
  const [pendingPreview, setPendingPreview] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [{ summary: summaryData }, pendingData] = await Promise.all([
          reviewApi.summary().then((data) => ({ summary: data })),
          reviewApi.listPending({ limit: 3 }).catch(() => ({ reviews: [] })),
        ]);
        if (!mounted) return;
        setSummary(summaryData || { pending: 0, approved: 0, total: 0 });
        setPendingPreview(pendingData?.reviews || []);
        setError(null);
      } catch (err) {
        if (mounted) setError(err?.message || "Yorumlar yüklenemedi");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(
    () => [
      {
        label: "Beklemede",
        value: summary.pending ?? 0,
        Icon: Clock3,
      },
      {
        label: "Onaylandı",
        value: summary.approved ?? 0,
        Icon: CheckCircle2,
      },
      {
        label: "Toplam",
        value: summary.total ?? 0,
        Icon: MessageSquare,
      },
    ],
    [summary]
  );

  return (
    <Link
      to="/admin/settings/reviews"
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)] transition-colors hover:border-[var(--color-text-admin)]/50"
    >
      <div className="flex items-center gap-3 border-b border-[var(--color-border-admin)]/60 px-4 py-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
          <MessageSquare className="h-5 w-5 text-[var(--color-text-admin)]" />
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--color-text-admin)]">
            Yorumlar & Geri Bildirim
          </div>
          <div className="text-xs text-[var(--color-text-admin-muted)]">
            Müşteri yorumlarını denetleyin ve yayınlayın.
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between px-4 py-4">
        <div className="space-y-4">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {error}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {stats.map((item) => {
                const StatIcon = item.Icon;
                return (
                  <div
                    key={item.label}
                    className="flex flex-col rounded-xl border border-[var(--color-border-admin)]/50 bg-white/10 p-3 text-[var(--color-text-admin)]"
                  >
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--color-text-admin-muted)]">
                      <StatIcon className="h-3.5 w-3.5" />
                      {item.label}
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-text-admin-muted)]" />
                      ) : (
                        item.value
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Bekleyen önizleme
            </div>
            <div className="flex flex-col gap-2">
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-12 animate-pulse rounded-xl bg-[var(--color-bg-hover)]"
                  />
                ))
              ) : pendingPreview.length ? (
                pendingPreview.map((review) => {
                  const target =
                    review?.set?.name || review?.target?.type === "set"
                      ? {
                          name:
                            review?.set?.name ||
                            review?.target?.name ||
                            review?.product?.name ||
                            "—",
                          label: "Set",
                        }
                      : {
                          name:
                            review?.product?.name ||
                            review?.target?.name ||
                            review?.set?.name ||
                            "—",
                          label: "Ürün",
                        };
                  return (
                    <div
                      key={review.id}
                      className="rounded-xl border border-[var(--color-border-admin)]/40 bg-white/10 p-3 text-xs text-[var(--color-text-admin)]"
                    >
                      <div className="font-semibold">
                        {review.user?.name || "Anonim"}
                      </div>
                      <div className="flex items-center gap-2 text-[var(--color-text-admin-muted)]">
                        <span>{target.name}</span>
                        <span className="rounded-full border border-[var(--color-border-admin)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest">
                          {target.label}
                        </span>
                      </div>
                      <div className="mt-1 line-clamp-1 italic text-[var(--color-text-admin-muted)]">
                        “{formatPreviewText(review)}”
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-[var(--color-border-admin)]/40 bg-white/10 p-3 text-xs text-[var(--color-text-admin-muted)]">
                  Bekleyen yorum yok
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-full border border-[var(--color-border-admin)] px-3 py-2 text-xs font-semibold text-[var(--color-text-admin)] transition-colors group-hover:bg-[var(--color-bg-hover)]">
          Yorumları yönet
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
