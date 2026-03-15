import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Printer,
  RotateCcw,
  X,
} from "lucide-react";
import { orderApi } from "../../api/orders";
import { printJobApi } from "../../api/printJobs";
import OrderPrintSheet from "./OrderPrintSheet.jsx";
import {
  buildOrderPrintHtml,
  buildOrderPrintModel,
  formatOrderDateTime,
} from "./orderPrintTemplate.js";

const ORDER_STATUS_LABELS = {
  pending: "Beklemede",
  paid: "Ödendi",
  shipped: "Kargoda",
  completed: "Tamamlandı",
  cancelled: "İptal Edildi",
  failed: "Başarısız",
};

const PAYMENT_STATUS_LABELS = {
  success: "Başarılı",
  pending: "Beklemede",
  failed: "Başarısız",
};

const PAYMENT_METHOD_LABELS = {
  checkout_simulation: "Sipariş Simülasyonu",
  gateway_simulation: "Sipariş Simülasyonu",
  simulation: "Sipariş Simülasyonu",
  paytr: "PayTR",
  cod: "Kapıda Ödeme",
  card: "Kredi Kartı",
};

const PRINT_JOB_STATUS_LABELS = {
  pending: "Sırada",
  processing: "Yazdırılıyor",
  printed: "Yazdırıldı",
  failed: "Hata",
  cancelled: "İptal",
};

const PRINT_JOB_STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  processing: "bg-sky-50 text-sky-700 ring-sky-200",
  printed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
  cancelled: "bg-stone-100 text-stone-600 ring-stone-200",
};

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function formatPaymentMethod(method) {
  const normalized = String(method || "").trim().toLowerCase();
  if (!normalized) return "-";
  return PAYMENT_METHOD_LABELS[normalized] || normalized.toUpperCase();
}

function buildPaymentLabel(order) {
  const method = formatPaymentMethod(order?.payment?.method);
  const status =
    PAYMENT_STATUS_LABELS[String(order?.payment?.status || "").toLowerCase()];
  return status ? `${method} • ${status}` : method;
}

function getOrderLookupId(order, fallback = "") {
  return order?.id || order?.orderNumber || fallback || "";
}

function mergePrintJob(order, printJob) {
  if (!order) return order;
  return {
    ...order,
    printJob: printJob || null,
  };
}

function hasSamePrintJob(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return (
    String(left.id || "") === String(right.id || "") &&
    String(left.status || "") === String(right.status || "") &&
    Number(left.attempts || 0) === Number(right.attempts || 0) &&
    Number(left.maxAttempts || 0) === Number(right.maxAttempts || 0) &&
    String(left.claimedBy || "") === String(right.claimedBy || "") &&
    String(left.printer || "") === String(right.printer || "") &&
    String(left.printedAt || "") === String(right.printedAt || "") &&
    String(left.createdAt || "") === String(right.createdAt || "") &&
    String(left.lastError?.message || "") ===
      String(right.lastError?.message || "")
  );
}

function getPrintJobBadge(status) {
  const normalized = String(status || "").toLowerCase();
  return {
    label: PRINT_JOB_STATUS_LABELS[normalized] || "Durum Yok",
    style:
      PRINT_JOB_STATUS_STYLES[normalized] ||
      "bg-stone-100 text-stone-600 ring-stone-200",
  };
}

function canRequeuePrint(order) {
  const paymentStatus = String(order?.payment?.status || "").toLowerCase();
  const orderStatus = String(order?.status || "").toLowerCase();
  if (paymentStatus !== "success") return false;
  if (["cancelled", "failed"].includes(orderStatus)) return false;
  return true;
}

export default function OrderDetailsModal({ orderId, onClose, admin = false }) {
  const previewRef = useRef(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState({
    printing: false,
    downloading: false,
    requeueing: false,
  });
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setFeedback(null);
        const data = admin
          ? await orderApi.adminGet(orderId)
          : await orderApi.get(orderId);
        if (!mounted) return;
        setOrder(data);
      } catch (error) {
        if (!mounted) return;
        console.error("Order get error:", error);
        setFeedback({
          variant: "danger",
          message: "Sipariş detayı yüklenemedi.",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [orderId, admin]);

  const printJobLookupId = getOrderLookupId(order, orderId);

  useEffect(() => {
    if (!admin || !printJobLookupId) return undefined;

    let cancelled = false;

    const refreshPrintJob = async () => {
      try {
        const printJob = await printJobApi.getOrderJob(printJobLookupId);
        if (cancelled) return;
        setOrder((current) => {
          if (!current) return current;
          if (hasSamePrintJob(current.printJob, printJob)) return current;
          return mergePrintJob(current, printJob);
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Print job get error:", error);
      }
    };

    void refreshPrintJob();
    const intervalId = window.setInterval(() => {
      void refreshPrintJob();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [admin, printJobLookupId]);

  const printModel = useMemo(() => buildOrderPrintModel(order), [order]);
  const currentPrintJob = order?.printJob || null;
  const printJobBadge = getPrintJobBadge(currentPrintJob?.status);

  const summary = useMemo(() => {
    if (!order) return null;
    return {
      status:
        ORDER_STATUS_LABELS[String(order.status || "").toLowerCase()] ||
        order.status ||
        "-",
      payment: buildPaymentLabel(order),
      createdAt: formatOrderDateTime(order.createdAt),
      customerName: printModel?.customerName || "-",
      phone: printModel?.phone || "-",
    };
  }, [order, printModel]);

  const handleBrowserPrint = () => {
    if (!printModel || typeof window === "undefined") return;

    const printWindow = window.open("", "_blank", "width=980,height=900");
    if (!printWindow) {
      setFeedback({
        variant: "danger",
        message: "Tarayıcı yazdırma penceresi açılamadı.",
      });
      return;
    }

    setActionState((prev) => ({ ...prev, printing: true }));
    try {
      printWindow.document.open();
      printWindow.document.write(buildOrderPrintHtml(printModel));
      printWindow.document.close();
      setFeedback({
        variant: "success",
        message: "Tarayıcı yazdırma penceresi açıldı.",
      });
    } finally {
      setActionState((prev) => ({ ...prev, printing: false }));
    }
  };

  const handleDownloadPdf = async () => {
    if (!previewRef.current || !printModel) return;

    setActionState((prev) => ({ ...prev, downloading: true }));
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(previewRef.current, {
        scale: 2.5,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [100, 150],
      });

      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        100,
        150,
        undefined,
        "FAST"
      );
      pdf.save(`${printModel.orderNumber || "siparis"}-etiket.pdf`);

      setFeedback({
        variant: "success",
        message: "Etiket PDF olarak indirildi.",
      });
    } catch (error) {
      console.error("PDF export error:", error);
      setFeedback({
        variant: "danger",
        message: "PDF oluşturulamadı.",
      });
    } finally {
      setActionState((prev) => ({ ...prev, downloading: false }));
    }
  };

  const handleRequeue = async () => {
    if (!admin || !order) return;

    const lookupId = getOrderLookupId(order, orderId);
    if (!lookupId) return;

    setActionState((prev) => ({ ...prev, requeueing: true }));
    try {
      const printJob = await printJobApi.requeueOrder(lookupId);
      setOrder((current) => mergePrintJob(current, printJob));
      setFeedback({
        variant: "success",
        message: "Etiket yeniden kuyruğa alındı.",
      });
    } catch (error) {
      console.error("Print job requeue error:", error);
      setFeedback({
        variant: "danger",
        message: error.message || "Yeniden yazdırma kuyruğu oluşturulamadı.",
      });
    } finally {
      setActionState((prev) => ({ ...prev, requeueing: false }));
    }
  };

  if (!orderId) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />

      <div className="absolute inset-2 flex flex-col overflow-hidden rounded-[24px] border border-border bg-white shadow-[0_30px_120px_rgba(15,23,42,0.25)] sm:inset-4 lg:inset-5 xl:left-1/2 xl:top-6 xl:bottom-6 xl:w-[min(1120px,calc(100vw-64px))] xl:-translate-x-1/2">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
              Yazdırma Önizlemesi
            </div>
            <div className="mt-1 text-2xl font-semibold text-primary">
              Sipariş #{order?.orderNumber || orderId}
            </div>
            {!loading && summary && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-secondary">
                <span>{summary.status}</span>
                <span>•</span>
                <span>{summary.payment}</span>
                <span>•</span>
                <span>{summary.createdAt}</span>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-hover"
            aria-label="Kapat"
          >
            <X className="h-5 w-5 text-secondary" />
          </button>
        </div>

        <div className="min-h-0 overflow-auto px-4 py-4 sm:px-6 sm:py-5">
          {loading ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="h-[680px] animate-pulse rounded-[28px] bg-stone-100" />
              <div className="space-y-4">
                <div className="h-40 animate-pulse rounded-[24px] bg-stone-100" />
                <div className="h-56 animate-pulse rounded-[24px] bg-stone-100" />
              </div>
            </div>
          ) : !order || !printModel ? (
            <div className="py-16 text-center text-secondary">
              Sipariş şablonu oluşturulamadı.
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,#f8f5ef_0%,#f1ede6_100%)] p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">
                        100x150 Etiket
                      </div>
                      <div className="mt-1 text-sm text-stone-500">
                        Müşteriye gidecek kutu etiketi önizlemesi
                      </div>
                    </div>
                    <div className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-500">
                      Gap label • Dikey
                    </div>
                  </div>

                  <OrderPrintSheet model={printModel} previewRef={previewRef} />
                </div>

                <div className="mt-4 rounded-[22px] border border-border bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-[240px] flex-1">
                      <div className="text-sm font-semibold text-primary">
                        Yazdırma durumu
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <span
                          className={cls(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                            currentPrintJob
                              ? printJobBadge.style
                              : "bg-stone-100 text-stone-600 ring-stone-200"
                          )}
                        >
                          {currentPrintJob
                            ? printJobBadge.label
                            : "Henüz kuyruğa alınmadı"}
                        </span>
                        {currentPrintJob?.claimedBy && (
                          <span className="text-secondary">
                            Agent:{" "}
                            <strong className="text-primary">
                              {currentPrintJob.claimedBy}
                            </strong>
                          </span>
                        )}
                      </div>

                      <div className="mt-3 space-y-1 text-sm text-secondary">
                        {currentPrintJob ? (
                          <>
                            <div>
                              Deneme:{" "}
                              <strong className="text-primary">
                                {currentPrintJob.attempts || 0}/
                                {currentPrintJob.maxAttempts || 0}
                              </strong>
                            </div>
                            <div>
                              Kuyruğa alındı:{" "}
                              <strong className="text-primary">
                                {formatOrderDateTime(currentPrintJob.createdAt)}
                              </strong>
                            </div>
                            {currentPrintJob.printedAt && (
                              <div>
                                Yazdırıldı:{" "}
                                <strong className="text-primary">
                                  {formatOrderDateTime(currentPrintJob.printedAt)}
                                </strong>
                              </div>
                            )}
                            {currentPrintJob.printer && (
                              <div>
                                Yazıcı:{" "}
                                <strong className="text-primary">
                                  {currentPrintJob.printer}
                                </strong>
                              </div>
                            )}
                            {currentPrintJob.lastError?.message && (
                              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                                Son hata: {currentPrintJob.lastError.message}
                              </div>
                            )}
                          </>
                        ) : (
                          <div>
                            Bu sipariş için henüz otomatik yazdırma kaydı
                            oluşmadı.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleBrowserPrint}
                        disabled={actionState.printing}
                        className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                      >
                        <Printer className="h-4 w-4" />
                        Tarayıcıdan Yazdır
                      </button>
                      {admin && (
                        <button
                          onClick={handleRequeue}
                          disabled={
                            actionState.requeueing || !canRequeuePrint(order)
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RotateCcw className="h-4 w-4" />
                          {actionState.requeueing
                            ? "Kuyruğa Ekleniyor..."
                            : "Kuyruğa Yeniden Al"}
                        </button>
                      )}
                      <button
                        onClick={handleDownloadPdf}
                        disabled={actionState.downloading}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-primary hover:bg-surface-hover disabled:opacity-60"
                      >
                        <Download className="h-4 w-4" />
                        {actionState.downloading ? "Hazırlanıyor..." : "PDF İndir"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-secondary">
                    Tarayıcıdan yazdır ve PDF indir butonları önizleme içindir.
                    Otomatik yazdırma, Windows agent kuyruktan işi aldığında
                    çalışır.
                  </div>

                  {feedback && (
                    <div
                      className={cls(
                        "mt-4 rounded-2xl border px-4 py-3 text-sm",
                        feedback.variant === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      )}
                    >
                      {feedback.message}
                    </div>
                  )}
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-[24px] border border-border bg-contact-bg p-5">
                  <div className="text-sm font-semibold text-primary">
                    Sipariş Özeti
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-secondary">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-secondary/70">
                        Alıcı
                      </div>
                      <div className="mt-1 font-medium text-primary">
                        {summary?.customerName}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-secondary/70">
                        Telefon
                      </div>
                      <div className="mt-1 font-medium text-primary">
                        {summary?.phone}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-secondary/70">
                        Sipariş Durumu
                      </div>
                      <div className="mt-1 font-medium text-primary">
                        {summary?.status}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-secondary/70">
                        Ödeme
                      </div>
                      <div className="mt-1 font-medium text-primary">
                        {summary?.payment}
                      </div>
                    </div>
                    {order?.note && (
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-secondary/70">
                          Not
                        </div>
                        <div className="mt-1 font-medium text-primary">
                          {order.note}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-border bg-white p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    Otomatik yazdırma
                  </div>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-secondary">
                    <p>
                      Sipariş ödemesi başarılı olduğunda backend otomatik bir
                      print job oluşturur.
                    </p>
                    <p>
                      Windows agent bu işi alıp ZIJIANG LABEL yazıcısına
                      gönderecek. Bu alandaki durum da artık o kuyruktan geliyor.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
