import { useEffect, useMemo, useState } from "react";
import { Percent, PlusCircle, RefreshCw } from "lucide-react";
import { productApi } from "../../api/products";
import { setApi } from "../../api/sets";
import { categoryApi } from "../../api/categories";
import { discountApi } from "../../api/discounts";
import { stackedDiscountApi } from "../../api/stackedDiscount";
import DiscountTable from "../../components/admin/discounts/DiscountTable.jsx";
import DiscountForm from "../../components/admin/discounts/DiscountForm.jsx";
import StackedDiscountForm from "../../components/admin/discounts/StackedDiscountForm.jsx";
import AlertBanner from "../../components/ui/AlertBanner.jsx";
import { flattenCategoryTree } from "../../utils/catalog.js";
import { useConfirm } from "../../components/ui/ConfirmDialog.jsx";
import { useAdminLang } from "../../context/LangContext.jsx";

const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 0,
});

export default function AdminDiscounts() {
  const confirm = useConfirm();
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  const [productOptions, setProductOptions] = useState([]);
  const [setOptionsList, setSetOptionsList] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [conflictState, setConflictState] = useState(null);
  const [stackedDiscount, setStackedDiscount] = useState(null);
  const [stackedModalOpen, setStackedModalOpen] = useState(false);
  const [stackedSubmitting, setStackedSubmitting] = useState(false);
  const { adminLang } = useAdminLang();

  useEffect(() => {
    loadDiscounts();
    loadStackedDiscount();
    loadOptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminLang]);

  const loadDiscounts = async () => {
    setLoading(true);
    try {
      const data = await discountApi.list(adminLang);
      setDiscounts(data);
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [productRes, setRes, categoryRes] = await Promise.all([
        productApi.list({ limit: 500, includeHidden: true }, adminLang),
        setApi.list({ includeHidden: true }, adminLang),
        categoryApi.tree(adminLang),
      ]);

      const mappedProducts = (productRes.products || []).map((product) => ({
        id: String(product.id || product._id || "").trim(),
        label: product.name || "Adsız ürün",
        hint: currency.format(product.finalPrice ?? product.price ?? 0),
      }));
      setProductOptions(mappedProducts);

      const mappedSets = (
        Array.isArray(setRes) ? setRes : setRes?.sets || []
      ).map((set) => ({
        id: String(set.id || set._id || "").trim(),
        label: set.name || "Başlıksız set",
        hint: currency.format(set.finalPrice ?? set.price ?? 0),
      }));
      setSetOptionsList(mappedSets);

      const flatCategories = flattenCategoryTree(categoryRes || []);
      const mappedCategories = flatCategories
        .map((item) => {
          const catId = item.id || item._id || item.value; // ← slug YOK
          if (!catId) return null; // id’sizleri at
          const label =
            (Array.isArray(item.path) && item.path.length
              ? item.path.join(" / ")
              : item.label || item.name || String(catId)) || "Adsız";
          const hint =
            typeof item.level === "number"
              ? `Seviye ${item.level + 1}`
              : undefined;
          return { id: String(catId), label, hint };
        })
        .filter(Boolean);
      setCategoryOptions(mappedCategories);
    } catch (error) {
      setBanner(
        (prev) => prev ?? { variant: "danger", message: extractMessage(error) }
      );
    }
  };

  const loadStackedDiscount = async () => {
    try {
      const data = await stackedDiscountApi.getManage();
      setStackedDiscount(data);
    } catch (error) {
      setBanner(
        (prev) => prev ?? { variant: "danger", message: extractMessage(error) }
      );
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDiscount(null);
    setConflictState(null);
    setFormSubmitting(false);
  };

  const openCreateModal = () => {
    setEditingDiscount(null);
    setConflictState(null);
    setModalOpen(true);
  };

  const closeStackedModal = () => {
    setStackedModalOpen(false);
    setStackedSubmitting(false);
  };

  const handleEdit = (discount) => {
    setEditingDiscount(discount);
    setConflictState(null);
    setModalOpen(true);
  };

  const handleEditStackedDiscount = () => {
    setStackedModalOpen(true);
  };

  const handleDelete = async (discount) => {
    const ok = await confirm({
      title: "İndirimi sil",
      description: `“${discount.name}” kaldırılsın mı? Bu işlem geri alınamaz.`,
      confirmText: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await discountApi.remove(discount.id);
      setDiscounts((prev) => prev.filter((item) => item.id !== discount.id));
      setBanner({ variant: "warning", message: "İndirim silindi" });
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  };

  const handleToggleActive = async (discount) => {
    try {
      const updated = await discountApi.update(discount.id, {
        active: !discount.active,
      });
      setDiscounts((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setBanner({
        variant: "success",
        message: updated.active
          ? `“${updated.name}” etkinleştirildi`
          : `“${updated.name}” devre dışı bırakıldı`,
      });
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  };

  const handleSubmit = async (payload) => {
    if (formSubmitting) return;
    setFormSubmitting(true);
    try {
      if (editingDiscount?.id) {
        const updated = await discountApi.update(editingDiscount.id, payload);
        setDiscounts((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
        setBanner({ variant: "success", message: "İndirim güncellendi" });
      } else {
        const created = await discountApi.create(payload);
        if (!created?.cancelled) {
          setDiscounts((prev) => [created, ...prev]);
          setBanner({ variant: "success", message: "İndirim oluşturuldu" });
        }
      }
      closeModal();
    } catch (error) {
      const parsed = parseApiError(error);
      if (parsed?.conflicts) {
        setConflictState({
          payload,
          conflicts: parsed.conflicts,
          message: parsed.message,
          mode: editingDiscount?.id ? "update" : "create",
          id: editingDiscount?.id || null,
        });
      } else {
        setBanner({
          variant: "danger",
          message: parsed?.message || "Beklenmeyen hata",
        });
      }
      setFormSubmitting(false);
    }
  };

  const handleResolveConflict = async (resolution) => {
    if (!conflictState) return;

    if (resolution === "cancel") {
      setConflictState(null);
      setBanner({ variant: "info", message: "İndirim işlemi iptal edildi." });
      setFormSubmitting(false);
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = { ...conflictState.payload, resolve: resolution };
      let result;
      if (conflictState.mode === "update" && conflictState.id) {
        result = await discountApi.update(conflictState.id, payload);
        setDiscounts((prev) =>
          prev.map((item) => (item.id === result.id ? result : item))
        );
        setBanner({ variant: "success", message: "İndirim güncellendi" });
      } else {
        result = await discountApi.create(payload);
        if (result?.cancelled) {
          setBanner({
            variant: "info",
            message: "İndirim oluşturma iptal edildi.",
          });
        } else {
          setDiscounts((prev) => [result, ...prev]);
          setBanner({ variant: "success", message: "İndirim oluşturuldu" });
        }
      }
      setConflictState(null);
      closeModal();
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
      setFormSubmitting(false);
    }
  };

  const handleStackedSubmit = async (payload) => {
    if (stackedSubmitting) return;
    setStackedSubmitting(true);
    try {
      const updated = await stackedDiscountApi.update(payload);
      setStackedDiscount(updated);
      setBanner({
        variant: "success",
        message: "Katlanan indirim güncellendi",
      });
      closeStackedModal();
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
      setStackedSubmitting(false);
    }
  };

  const activeCount = useMemo(
    () => discounts.filter((item) => item.active).length,
    [discounts]
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-bg-hover)]">
            <Percent className="h-6 w-6 text-[var(--color-text-admin)]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-admin)]">
              İndirimler
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
              Katalog genelindeki kampanyaları ve kuponları yönetin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDiscounts}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
          >
            <RefreshCw className="h-4 w-4" /> Yenile
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
            <PlusCircle className="h-4 w-4" /> Yeni indirim
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

      <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-5">
        <div className="mb-6 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-admin)]/30 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-admin)]">
                Katlanan İndirim
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
                Sistem genelinde tek bir katlanan indirim kuralı çalışır.
              </p>
            </div>
            <button
              type="button"
              onClick={handleEditStackedDiscount}
              className="inline-flex items-center justify-center rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
            >
              Düzenle
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <SummaryCard
              label="Durum"
              value={stackedDiscount?.active ? "Aktif" : "Pasif"}
            />
            <SummaryCard
              label="Kademeler"
              value={
                stackedDiscount?.tiers?.length
                  ? `${stackedDiscount.tiers.length} kademe`
                  : "Tanımsız"
              }
            />
            <SummaryCard
              label="Kupon Etkileşimi"
              value={
                stackedDiscount?.allowCouponStacking === false
                  ? "Kuponla birleşmez"
                  : "Kuponla birleşir"
              }
            />
            <SummaryCard
              label="Normal İndirim"
              value={
                stackedDiscount?.allowDiscountStacking === false
                  ? "Birleşmez"
                  : "Birleşir"
              }
            />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
                Hedefler
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-admin)]">
                {(stackedDiscount?.targets?.products?.length || 0)} ürün •{" "}
                {(stackedDiscount?.targets?.sets?.length || 0)} set •{" "}
                {(stackedDiscount?.targets?.categories?.length || 0)} kategori
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
                Kural Akışı
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(stackedDiscount?.tiers || []).length ? (
                  stackedDiscount.tiers.map((tier) => (
                    <span
                      key={`${tier.quantity}-${tier.percentage}`}
                      className="rounded-full bg-[var(--color-bg-hover)] px-3 py-1 text-xs font-medium text-[var(--color-text-admin)]"
                    >
                      {tier.quantity}+ ürün → %{tier.percentage}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[var(--color-text-admin-muted)]">
                    Henüz kademe tanımlanmadı.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-admin)] pb-4">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-admin)]">
              Aktif indirimler
            </p>
            <p className="text-xs text-[var(--color-text-admin-muted)]">
              {activeCount} aktif • {discounts.length} toplam
            </p>
          </div>
        </div>
        <div className="pt-4">
          <DiscountTable
            discounts={discounts}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
          />
        </div>
      </div>

      <DiscountForm
        open={modalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        initialDiscount={editingDiscount}
        productOptions={productOptions}
        setOptions={setOptionsList}
        categoryOptions={categoryOptions}
        submitting={formSubmitting}
        conflict={conflictState}
        onResolveConflict={handleResolveConflict}
      />

      <StackedDiscountForm
        open={stackedModalOpen}
        onClose={closeStackedModal}
        onSubmit={handleStackedSubmit}
        initialDiscount={stackedDiscount}
        productOptions={productOptions}
        setOptions={setOptionsList}
        categoryOptions={categoryOptions}
        submitting={stackedSubmitting}
      />
    </section>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-[var(--color-text-admin)]">
        {value}
      </p>
    </div>
  );
}

function parseApiError(error) {
  if (!error) return null;
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      /* ignore */
    }
    return { message: error.message };
  }
  return { message: String(error) };
}

function extractMessage(error) {
  const parsed = parseApiError(error);
  return parsed?.message || "Beklenmeyen hata";
}
