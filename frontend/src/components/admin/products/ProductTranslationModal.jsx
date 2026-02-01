import { useEffect, useMemo, useState } from "react";
import { productApi } from "../../../api/products.js";
import {
  buildProductState,
  createBaseDraft,
  createTranslationDrafts,
  splitTextToArray,
} from "./productTranslationUtils.js";
import TranslationModal from "../translations/TranslationModal.jsx";

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
  if (typeof error === "string") return error;
  return String(error);
}

const EMPTY_DRAFT = {
  name: "",
  description: "",
  careInstructions: "",
  details: "",
  customAttributeTitle: "",
  customAttributeValues: "",
};

export default function ProductTranslationModal({
  open,
  loading,
  error,
  product,
  baseLang = "tr",
  langs = [],
  onClose,
  onUpdated,
}) {
  const [currentProduct, setCurrentProduct] = useState(product);
  const [drafts, setDrafts] = useState(() => createTranslationDrafts(product, langs));
  const [savingMap, setSavingMap] = useState({});
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    setCurrentProduct(product);
    setDrafts(createTranslationDrafts(product, langs));
    setSavingMap({});
    setAlert(null);
  }, [product, langs]);

  const baseDraft = useMemo(
    () => createBaseDraft(currentProduct),
    [currentProduct]
  );

  const savedDrafts = useMemo(
    () => createTranslationDrafts(currentProduct, langs),
    [currentProduct, langs]
  );

  const hasCustomAttribute = Boolean(currentProduct?.customAttribute?.show);

  const handleFieldChange = (lang, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: {
        ...(prev[lang] || EMPTY_DRAFT),
        [field]: value,
      },
    }));
  };

  const handleCopyFromBase = (lang) => {
    if (!baseDraft) return;
    setDrafts((prev) => ({
      ...prev,
      [lang]: { ...baseDraft },
    }));
  };

  const handleReset = (lang) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: savedDrafts[lang] || { ...EMPTY_DRAFT },
    }));
  };

  const handleSave = async (lang) => {
    const identifier =
      currentProduct?.id ||
      currentProduct?._id ||
      currentProduct?.slug ||
      "";
    if (!identifier) {
      setAlert({
        variant: "danger",
        message:
          "Ürün kimliği bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.",
      });
      return;
    }

    setSavingMap((prev) => ({ ...prev, [lang]: true }));
    setAlert(null);
    try {
      const draft = drafts[lang] || EMPTY_DRAFT;
      const payload = {
        name: (draft.name ?? "").trim(),
        description: draft.description ?? "",
        careInstructions: draft.careInstructions ?? "",
        details: splitTextToArray(draft.details),
        customAttribute: {
          title: (draft.customAttributeTitle ?? "").trim(),
          values: splitTextToArray(draft.customAttributeValues),
          show: hasCustomAttribute,
        },
      };

      await productApi.update(identifier, payload, lang);
      const refreshed = await productApi.get(identifier, baseLang);
      const normalized = buildProductState(
        refreshed,
        refreshed?.inventory || currentProduct?.inventory || []
      );
      setCurrentProduct(normalized);
      setDrafts(createTranslationDrafts(normalized, langs));
      setAlert({
        variant: "success",
        message: `${lang.toUpperCase()} çevirisi kaydedildi`,
      });
      await onUpdated?.(normalized);
    } catch (err) {
      setAlert({ variant: "danger", message: extractMessage(err) });
    } finally {
      setSavingMap((prev) => ({ ...prev, [lang]: false }));
    }
  };

  const panels = (langs || []).map(({ value, label }) => {
    const draft = drafts[value] || EMPTY_DRAFT;
    const saved = savedDrafts[value] || EMPTY_DRAFT;
    const isDirty =
      draft.name !== saved.name ||
      draft.description !== saved.description ||
      draft.careInstructions !== saved.careInstructions ||
      draft.details !== saved.details ||
      draft.customAttributeTitle !== saved.customAttributeTitle ||
      draft.customAttributeValues !== saved.customAttributeValues;
    const summary = saved.name || "Türkçe metin kullanılıyor";

    return {
      value,
      label,
      summary,
      dirty: isDirty,
      saving: Boolean(savingMap[value]),
      onCopy: () => handleCopyFromBase(value),
      onReset: () => handleReset(value),
      onSave: () => handleSave(value),
      render: () => (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Ürün adı
            </span>
            <input
              value={draft.name}
              onChange={(event) =>
                handleFieldChange(value, "name", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="Lüks İpek Pijama"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Ürün açıklaması
            </span>
            <textarea
              rows={4}
              value={draft.description}
              onChange={(event) =>
                handleFieldChange(value, "description", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="Ürün açıklaması"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Ürün detayları (her satır bir madde)
            </span>
            <textarea
              rows={4}
              value={draft.details}
              onChange={(event) =>
                handleFieldChange(value, "details", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="• %100 pamuk&#10;• Yumuşak dokulu..."
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Bakım talimatları
            </span>
            <textarea
              rows={3}
              value={draft.careInstructions}
              onChange={(event) =>
                handleFieldChange(value, "careInstructions", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="30°C hassas yıkama..."
            />
          </label>

          {hasCustomAttribute && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                  Ek özellik başlığı
                </span>
                <input
                  value={draft.customAttributeTitle}
                  onChange={(event) =>
                    handleFieldChange(
                      value,
                      "customAttributeTitle",
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                  placeholder="Öne çıkan özellik"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                  Ek özellik değerleri (her satır bir madde)
                </span>
                <textarea
                  rows={4}
                  value={draft.customAttributeValues}
                  onChange={(event) =>
                    handleFieldChange(
                      value,
                      "customAttributeValues",
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                />
              </label>
            </div>
          )}
        </div>
      ),
    };
  });

  return (
    <TranslationModal
      open={open}
      onClose={onClose}
      title="Ürün çevirileri"
      description={
        currentProduct ? currentProduct.name : "Ürün varyantlarını düzenleyin"
      }
      loading={loading}
      error={error}
      emptyMessage={currentProduct ? undefined : "Ürün verisi bulunamadı."}
      alert={alert}
      onDismissAlert={() => setAlert(null)}
      panels={panels}
    />
  );
}
