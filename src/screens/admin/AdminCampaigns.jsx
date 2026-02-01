import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Plus } from "lucide-react";
import { campaignApi } from "../../api/campaigns";
import { productApi } from "../../api/products";
import { setApi } from "../../api/sets";
import { categoryApi } from "../../api/categories";
import { discountApi } from "../../api/discounts";
import { flattenCategoryTree } from "../../utils/catalog.js";
import CampaignCard from "../../components/admin/campaigns/CampaignCard.jsx";
import CampaignForm from "../../components/admin/campaigns/CampaignForm.jsx";
import CampaignTranslationModal from "../../components/admin/campaigns/CampaignTranslationModal.jsx";
import AlertBanner from "../../components/ui/AlertBanner.jsx";
import { useConfirm } from "../../components/ui/ConfirmDialog.jsx";

const currency = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
});

const BASE_LANG = "tr";
const TRANSLATION_LANGS = [
  { value: "en", label: "English (EN)" },
  { value: "de", label: "Deutsch (DE)" },
];

function resolveCampaignIdentifier(campaign) {
  if (!campaign) return null;
  if (typeof campaign === "string" || typeof campaign === "number") {
    const trimmed = String(campaign).trim();
    return trimmed && trimmed !== "[object Object]" ? trimmed : null;
  }
  if (typeof campaign === "object") {
    if (typeof campaign.slug === "string" && campaign.slug.trim()) {
      return campaign.slug.trim();
    }
    let raw =
      campaign.id ??
      campaign._id ??
      campaign.campaignId ??
      (campaign.campaign &&
        (campaign.campaign.id ||
          campaign.campaign._id ||
          (typeof campaign.campaign.toHexString === "function"
            ? campaign.campaign.toHexString()
            : null)));
    if (!raw && typeof campaign.toHexString === "function") {
      raw = campaign.toHexString();
    }
    if (!raw && typeof campaign.toString === "function") {
      const str = campaign.toString();
      if (str && str !== "[object Object]") raw = str;
    }
    if (!raw) return null;
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      return trimmed && trimmed !== "[object Object]" ? trimmed : null;
    }
    if (typeof raw === "number") return String(raw);
    if (typeof raw === "object") {
      if (typeof raw._id === "string" && raw._id.trim()) return raw._id.trim();
      if (typeof raw.id === "string" && raw.id.trim()) return raw.id.trim();
      if (typeof raw.toHexString === "function") return raw.toHexString();
      if (
        typeof raw.toString === "function" &&
        raw.toString !== Object.prototype.toString
      ) {
        const str = raw.toString();
        if (str && str !== "[object Object]") return str;
      }
    }
    const fallback = String(raw).trim();
    return fallback && fallback !== "[object Object]" ? fallback : null;
  }
  try {
    const str = String(campaign).trim();
    return str && str !== "[object Object]" ? str : null;
  } catch {
    return null;
  }
}

export default function AdminCampaigns() {
  const confirm = useConfirm();
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [banner, setBanner] = useState(null);

  const [productOptions, setProductOptions] = useState([]);
  const [setOptions, setSetOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [discountOptions, setDiscountOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [formMode, setFormMode] = useState("create");
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [translationState, setTranslationState] = useState({
    open: false,
    loading: false,
    campaign: null,
    error: null,
  });

  useEffect(() => {
    loadCampaigns();
    loadOptions();
  }, []);

  const sortedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [campaigns]
  );

  const activeCount = useMemo(
    () => campaigns.filter((campaign) => campaign.isActive).length,
    [campaigns]
  );

  async function loadCampaigns() {
    setLoadingCampaigns(true);
    try {
      const data = await campaignApi.listManage({ includeInactive: true }, BASE_LANG);
      const normalized =
        (data || []).map((item) => {
          const identifier =
            resolveCampaignIdentifier(item) ||
            item?.id ||
            item?._id ||
            item?.slug ||
            null;
          if (!identifier || item?.id === identifier) return item;
          return { ...item, id: identifier };
        }) || [];
      setCampaigns(normalized);
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    } finally {
      setLoadingCampaigns(false);
    }
  }

  async function loadOptions() {
    setLoadingOptions(true);
    try {
      const [productRes, setRes, categoryRes, discountRes] = await Promise.all([
        productApi.list({ limit: 500, includeHidden: true }, BASE_LANG),
        setApi.list({ includeHidden: true }, BASE_LANG),
        categoryApi.tree(BASE_LANG),
        discountApi.list(BASE_LANG),
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
      setSetOptions(mappedSets);

      const flatCategories = flattenCategoryTree(categoryRes || []);
      const mappedCategories = flatCategories
        .map((item) => {
          const catId = item.id || item._id || item.value;
          if (!catId) return null;
          const label =
            (Array.isArray(item.path) && item.path.length
              ? item.path.join(" / ")
              : item.label || item.name || String(catId)) || "Adsız";
          const hint =
            typeof item.level === "number" ? `Seviye ${item.level + 1}` : undefined;
          return { id: String(catId), label, hint };
        })
        .filter(Boolean);
      setCategoryOptions(mappedCategories);

      const mappedDiscounts = (discountRes || []).map((discount) => ({
        id: discount.id,
        label: discount.name,
        hint: `${discount.percentage}% indirim`,
        appliesTo: discount.appliesTo || {},
      }));
      setDiscountOptions(mappedDiscounts);
    } catch (error) {
      setBanner({
        variant: "danger",
        message: extractMessage(error),
      });
    } finally {
      setLoadingOptions(false);
    }
  }

  function openCreateForm() {
    setFormMode("create");
    setEditingCampaign(null);
  }

  function openEditForm(campaign) {
    setFormMode("edit");
    setEditingCampaign(campaign);
  }

  async function handleToggleActive(campaign) {
    try {
      const identifier = resolveCampaignIdentifier(campaign);
      if (!identifier) throw new Error("Kampanya kimliği okunamadı. Lütfen yenileyin.");
      const updated = await campaignApi.update(
        identifier,
        { isActive: !campaign.isActive },
        BASE_LANG
      );
      setCampaigns((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      if (editingCampaign?.id === updated.id) {
        setEditingCampaign(updated);
      }
      setBanner({
        variant: "success",
        message: `Kampanya “${updated.name}” artık ${
          updated.isActive ? "aktif" : "gizli"
        }.`,
      });
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  }

  async function handleDelete(campaign) {
    const ok = await confirm({
      title: "Kampanyayı sil",
      description: `“${campaign.name}” kampanyasını silmek istiyor musun? Bu işlem geri alınamaz.`,
      tone: "danger",
      confirmText: "Sil",
    });
    if (!ok) return;
    try {
      const identifier = resolveCampaignIdentifier(campaign);
      if (!identifier) throw new Error("Kampanya kimliği okunamadı. Lütfen yenileyin.");
      await campaignApi.remove(identifier);
      setCampaigns((prev) => prev.filter((item) => item.id !== campaign.id));
      if (editingCampaign?.id === campaign.id) {
        openCreateForm();
      }
      setBanner({
        variant: "warning",
        message: `Kampanya “${campaign.name}” silindi.`,
      });
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  }

  async function handleMove(campaign, direction) {
    const list = sortedCampaigns;
    const from = list.findIndex((item) => item.id === campaign.id);
    const to = from + direction;
    if (to < 0 || to >= list.length) return;

    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    const nextWithOrder = next.map((item, index) => ({
      ...item,
      sortOrder: index,
    }));

    setCampaigns((prev) =>
      prev.map((item) => nextWithOrder.find((it) => it.id === item.id) || item)
    );

    try {
      await campaignApi.reorder(
        nextWithOrder.map((item) => ({
          id: resolveCampaignIdentifier(item) || item.id,
          sortOrder: item.sortOrder,
        }))
      );
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
      loadCampaigns();
    }
  }

  async function handleFormSubmit(payload) {
    setFormSubmitting(true);
    try {
      if (formMode === "create") {
        const created = await campaignApi.create(payload, BASE_LANG);
        setCampaigns((prev) => [...prev, created]);
        setBanner({
          variant: "success",
          message: `Kampanya “${created.name}” oluşturuldu.`,
        });
        openCreateForm();
      } else if (editingCampaign?.id) {
        const identifier = resolveCampaignIdentifier(editingCampaign);
        if (!identifier) {
          throw new Error("Kampanya kimliği okunamadı. Lütfen yenileyin.");
        }
        const updated = await campaignApi.update(identifier, payload, BASE_LANG);
        setCampaigns((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
        setEditingCampaign(updated);
        setBanner({
          variant: "success",
          message: `Kampanya “${updated.name}” güncellendi.`,
        });
      }
    } catch (error) {
      const message = extractMessage(error);
      setBanner({ variant: "danger", message });
      throw new Error(message);
    } finally {
      setFormSubmitting(false);
    }
  }

  const openTranslationModal = async (campaign) => {
    const identifier = resolveCampaignIdentifier(campaign);
    if (!identifier) {
      setTranslationState({
        open: true,
        loading: false,
        campaign: null,
        error: "Kampanya kimliği okunamadı. Lütfen yenileyin.",
      });
      return;
    }
    setTranslationState({
      open: true,
      loading: true,
      campaign: null,
      error: null,
    });
    try {
      const detail = await campaignApi.get(identifier, BASE_LANG);
      setTranslationState({
        open: true,
        loading: false,
        campaign: detail,
        error: null,
      });
    } catch (error) {
      setTranslationState({
        open: true,
        loading: false,
        campaign: null,
        error: extractMessage(error),
      });
    }
  };

  const closeTranslationModal = () => {
    setTranslationState({
      open: false,
      loading: false,
      campaign: null,
      error: null,
    });
  };

  const handleTranslationsUpdated = async () => {
    await loadCampaigns();
    setBanner({
      variant: "success",
      message: "Kampanya çevirisi kaydedildi.",
    });
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs uppercase tracking-wide text-[var(--color-text-admin-muted)]">
            <Megaphone className="h-4 w-4" />
            Kampanyalar
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--color-text-admin)]">
            Anasayfa Kampanya Yöneticisi
          </h1>
          <p className="text-sm text-[var(--color-text-admin-muted)]">
            Anasayfa kampanya kartlarını ve yönlendirmelerini yapılandırın.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/campaigns/layout"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
          >
            Yerleşim
          </Link>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-text-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-bg-admin)] hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Yeni kampanya
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          <div className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-admin)] pb-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-admin)]">
                  Kampanya özeti
                </p>
                <p className="text-xs text-[var(--color-text-admin-muted)]">
                  {activeCount} aktif • {campaigns.length} toplam
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadCampaigns()}
                className="text-xs text-[var(--color-text-admin-muted)] underline-offset-2 hover:underline"
              >
                Yenile
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {loadingCampaigns ? (
                Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[280px] animate-pulse rounded-2xl bg-[var(--color-bg-admin)]/60"
                  />
                ))
              ) : sortedCampaigns.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-6 text-center text-sm text-[var(--color-text-admin-muted)]">
                  Henüz kampanya yok. Anasayfadaki yer tutucu kartları değiştirmek için ilk kampanyanı oluştur.
                </div>
              ) : (
                sortedCampaigns.map((campaign, index) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onEdit={() => openEditForm(campaign)}
                    onDelete={() => handleDelete(campaign)}
                    onToggleActive={() => handleToggleActive(campaign)}
                    onMoveUp={() => handleMove(campaign, -1)}
                    onMoveDown={() => handleMove(campaign, +1)}
                    onTranslate={() => openTranslationModal(campaign)}
                    disableMoveUp={index === 0}
                    disableMoveDown={index === sortedCampaigns.length - 1}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-5">
          <CampaignForm
            mode={formMode}
            initialCampaign={editingCampaign}
            onSubmit={handleFormSubmit}
            onCancel={
              formMode === "edit"
                ? () => {
                    openCreateForm();
                  }
                : undefined
            }
            submitting={formSubmitting}
            productOptions={productOptions}
            setOptions={setOptions}
            categoryOptions={categoryOptions}
            discountOptions={discountOptions}
            contentLang={BASE_LANG}
          />

          {loadingOptions && (
            <div className="mt-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-4 py-3 text-xs text-[var(--color-text-admin-muted)]">
              Seçim seçenekleri yükleniyor...
            </div>
          )}
        </div>
      </div>

      <CampaignTranslationModal
        open={translationState.open}
        loading={translationState.loading}
        error={translationState.error}
        campaign={translationState.campaign}
        baseLang={BASE_LANG}
        langs={TRANSLATION_LANGS}
        onClose={closeTranslationModal}
        onUpdated={handleTranslationsUpdated}
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
