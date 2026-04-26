import { useEffect, useMemo, useState } from "react";
import { TicketPercent, PlusCircle, RefreshCw } from "lucide-react";
import { couponApi } from "../../api/coupons";
import { userApi } from "../../api/users";
import { productApi } from "../../api/products";
import { setApi } from "../../api/sets";
import { categoryApi } from "../../api/categories";
import CouponTable from "../../components/admin/coupons/CouponTable.jsx";
import CouponForm from "../../components/admin/coupons/CouponForm.jsx";
import AlertBanner from "../../components/ui/AlertBanner.jsx";
import { useConfirm } from "../../components/ui/ConfirmDialog.jsx";
import { flattenCategoryTree } from "../../utils/catalog.js";

const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 0,
});

export default function AdminCoupons() {
  const confirm = useConfirm();
  const [coupons, setCoupons] = useState([]);
  const [couponConfig, setCouponConfig] = useState({
    cartInputVisible: true,
  });
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [resourceOptions, setResourceOptions] = useState({
    users: [],
    products: [],
    sets: [],
    categories: [],
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    loadCoupons();
    loadCouponConfig();
  }, []);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const list = await couponApi.list();
      setCoupons(list);
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const loadCouponConfig = async () => {
    setConfigLoading(true);
    try {
      const config = await couponApi.getConfig();
      if (config) {
        setCouponConfig({
          cartInputVisible: config.cartInputVisible !== false,
        });
      }
    } catch (error) {
      setBanner((prev) => ({
        variant: "danger",
        message: extractMessage(error) || prev?.message,
      }));
    } finally {
      setConfigLoading(false);
    }
  };

  const activeCount = useMemo(
    () => coupons.filter((coupon) => coupon.active).length,
    [coupons]
  );

  const openCreateModal = () => {
    setEditingCoupon(null);
    setModalOpen(true);
    loadResourceOptions();
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCoupon(null);
    setFormSubmitting(false);
  };

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setModalOpen(true);
    loadResourceOptions();
  };

  const handleDelete = async (coupon) => {
      const ok = await confirm({
        title: "Kuponu sil",
        description: `“${
          coupon.code || "Kişiye özel kupon"
        }” kaydı kaldırılsın mı?`,
        confirmText: "Sil",
        tone: "danger",
      });
    if (!ok) return;
    try {
      await couponApi.remove(coupon.id);
      setCoupons((prev) => prev.filter((item) => item.id !== coupon.id));
      setBanner({ variant: "warning", message: "Kupon silindi" });
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  };

  const handleToggleActive = async (coupon) => {
    try {
      const updated = await couponApi.update(coupon.id, {
        active: !coupon.active,
      });
      setCoupons((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setBanner({
        variant: "success",
        message: updated.active
          ? `Kupon ${updated.code} etkinleştirildi`
          : `Kupon ${updated.code} devre dışı bırakıldı`,
      });
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  };

  const handleToggleCartCouponInput = async () => {
    if (configSaving) return;
    const nextValue = !(couponConfig?.cartInputVisible !== false);
    setConfigSaving(true);
    try {
      const updated = await couponApi.updateConfig({
        cartInputVisible: nextValue,
      });
      setCouponConfig({
        cartInputVisible: updated?.cartInputVisible !== false,
      });
      setBanner({
        variant: "success",
        message: nextValue
          ? "Sepette kupon alanı görünür yapıldı"
          : "Sepette kupon alanı gizlendi",
      });
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    } finally {
      setConfigSaving(false);
    }
  };

  const handleSubmit = async (payload) => {
    if (formSubmitting) return;
    setFormSubmitting(true);
    try {
      if (editingCoupon?.id) {
        const updated = await couponApi.update(editingCoupon.id, payload);
        setCoupons((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
        setBanner({ variant: "success", message: "Kupon güncellendi" });
      } else {
        const created = await couponApi.create(payload);
        setCoupons((prev) => [created, ...prev]);
        setBanner({ variant: "success", message: "Kupon oluşturuldu" });
      }
      closeModal();
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
      setFormSubmitting(false);
    }
  };

  const loadResourceOptions = async () => {
    if (optionsLoading) return;
    setOptionsLoading(true);
    try {
      const [usersRes, productsRes, setsRes, categoryTree] = await Promise.all([
        userApi.list({ page: 1, limit: 100, role: "user", sort: "recent" }),
        productApi.list({ page: 1, limit: 500, includeHidden: true }),
        setApi.list({ includeHidden: true, limit: 500 }),
        categoryApi.tree(),
      ]);

      const users = (usersRes?.users || [])
        .filter((user) => !user?.isDeleted)
        .map((user) => ({
          id: String(user.id || ""),
          label: user.fullName || user.email || "Adsız kullanıcı",
          hint: user.email || undefined,
        }))
        .filter((item) => item.id);

      const products = (productsRes?.products || [])
        .map((product) => ({
          id: String(product.id || product._id || "").trim(),
          label: product.name || "Adsız ürün",
          hint: currency.format(product.finalPrice ?? product.price ?? 0),
        }))
        .filter((item) => item.id);

      const sets = (Array.isArray(setsRes) ? setsRes : setsRes?.sets || [])
        .map((set) => ({
          id: String(set.id || set._id || "").trim(),
          label: set.name || "Adsız set",
          hint: currency.format(set.finalPrice ?? set.price ?? 0),
        }))
        .filter((item) => item.id);

      const categories = flattenCategoryTree(categoryTree || [])
        .map((category) => {
          const id = category.id || category._id;
          if (!id) return null;
          return {
            id: String(id),
            label:
              category.path?.length > 0
                ? category.path.join(" / ")
                : category.name || "Adsız kategori",
            hint:
              typeof category.level === "number"
                ? `Seviye ${category.level + 1}`
                : undefined,
          };
        })
        .filter(Boolean);

      setResourceOptions({
        users,
        products,
        sets,
        categories,
      });
    } catch (error) {
      setBanner((prev) => ({
        variant: "danger",
        message: extractMessage(error) || prev?.message,
      }));
    } finally {
      setOptionsLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-bg-hover)]">
            <TicketPercent className="h-6 w-6 text-[var(--color-text-admin)]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-admin)]">
              Kuponlar
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
              Kod tabanlı kampanyaları isteğe bağlı minimum sepet kurallarıyla yapılandırın.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-3 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-medium text-[var(--color-text-admin)]">
            <span>Sepette kupon alanı</span>
            <span className="text-xs text-[var(--color-text-admin-muted)]">
              {couponConfig?.cartInputVisible !== false ? "Açık" : "Kapalı"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={couponConfig?.cartInputVisible !== false}
              onClick={handleToggleCartCouponInput}
              disabled={configLoading || configSaving}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                couponConfig?.cartInputVisible !== false
                  ? "bg-[var(--color-accent)]"
                  : "bg-slate-300"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  couponConfig?.cartInputVisible !== false
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </label>
          <button
            onClick={loadCoupons}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
          >
            <RefreshCw className="h-4 w-4" /> Yenile
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
            <PlusCircle className="h-4 w-4" /> Yeni kupon
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-admin)] pb-4">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-admin)]">
              Aktif kuponlar
            </p>
            <p className="text-xs text-[var(--color-text-admin-muted)]">
              {activeCount} aktif • {coupons.length} toplam
            </p>
          </div>
          <button
            onClick={loadResourceOptions}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
          >
            Form seçeneklerini yenile
          </button>
        </div>
        <div className="pt-4">
          <CouponTable
            coupons={coupons}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
          />
        </div>
      </div>

      <CouponForm
        open={modalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        submitting={formSubmitting}
        initialCoupon={editingCoupon}
        optionsLoading={optionsLoading}
        userOptions={resourceOptions.users}
        productOptions={resourceOptions.products}
        setOptions={resourceOptions.sets}
        categoryOptions={resourceOptions.categories}
      />
    </section>
  );
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
