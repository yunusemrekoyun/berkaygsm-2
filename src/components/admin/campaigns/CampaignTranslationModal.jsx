import { useEffect, useMemo, useState } from "react";
import { campaignApi } from "../../../api/campaigns.js";
import TranslationModal from "../translations/TranslationModal.jsx";

const EMPTY_DRAFT = {
  name: "",
  description: "",
  badge: "",
  ctaText: "",
};

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

function createBaseDraft(campaign) {
  if (!campaign) return null;
  return {
    name: campaign.name ?? "",
    description: campaign.description ?? "",
    badge: campaign.badge ?? "",
    ctaText: campaign.ctaText ?? "",
  };
}

function createTranslationDrafts(campaign, langs = []) {
  const drafts = {};
  langs.forEach(({ value }) => {
    drafts[value] = { ...EMPTY_DRAFT };
  });

  if (!campaign) return drafts;
  const translations = campaign.translations || {};
  langs.forEach(({ value }) => {
    const t = translations[value] || {};
    drafts[value] = {
      name: t.name ?? "",
      description: t.description ?? "",
      badge: t.badge ?? "",
      ctaText: t.ctaText ?? "",
    };
  });

  return drafts;
}

export default function CampaignTranslationModal({
  open,
  loading,
  error,
  campaign,
  baseLang = "tr",
  langs = [],
  onClose,
  onUpdated,
}) {
  const [currentCampaign, setCurrentCampaign] = useState(campaign);
  const [drafts, setDrafts] = useState(() =>
    createTranslationDrafts(campaign, langs)
  );
  const [savingMap, setSavingMap] = useState({});
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    setCurrentCampaign(campaign);
    setDrafts(createTranslationDrafts(campaign, langs));
    setSavingMap({});
    setAlert(null);
  }, [campaign, langs]);

  const baseDraft = useMemo(
    () => createBaseDraft(currentCampaign),
    [currentCampaign]
  );
  const savedDrafts = useMemo(
    () => createTranslationDrafts(currentCampaign, langs),
    [currentCampaign, langs]
  );

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
    if (!currentCampaign?.id) {
      setAlert({
        variant: "danger",
        message:
          "Kampanya kimliği bulunamadı. Lütfen pencereyi kapatıp tekrar deneyin.",
      });
      return;
    }
    const draft = drafts[lang] || EMPTY_DRAFT;
    setSavingMap((prev) => ({ ...prev, [lang]: true }));
    setAlert(null);
    try {
      const payload = {
        name: (draft.name ?? "").trim(),
        description: draft.description ?? "",
        badge: draft.badge ?? "",
        ctaText: draft.ctaText ?? "",
      };
      await campaignApi.update(currentCampaign.id, payload, lang);
      const refreshed = await campaignApi.get(currentCampaign.id, baseLang);
      setCurrentCampaign(refreshed);
      setDrafts(createTranslationDrafts(refreshed, langs));
      setAlert({
        variant: "success",
        message: `${lang.toUpperCase()} çevirisi kaydedildi`,
      });
      await onUpdated?.(refreshed);
    } catch (err) {
      setAlert({ variant: "danger", message: extractMessage(err) });
    } finally {
      setSavingMap((prev) => ({ ...prev, [lang]: false }));
    }
  };

  const panels = (langs || []).map(({ value, label }) => {
    const draft = drafts[value] || EMPTY_DRAFT;
    const saved = savedDrafts[value] || EMPTY_DRAFT;
    const isDirty = JSON.stringify(draft) !== JSON.stringify(saved || {});

    return {
      value,
      label,
      summary: saved.name || "Türkçe metin kullanılıyor",
      dirty: isDirty,
      saving: Boolean(savingMap[value]),
      onCopy: () => handleCopyFromBase(value),
      onReset: () => handleReset(value),
      onSave: () => handleSave(value),
      render: () => (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Kampanya adı
            </span>
            <input
              value={draft.name}
              onChange={(event) =>
                handleFieldChange(value, "name", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Kampanya açıklaması
            </span>
            <textarea
              rows={4}
              value={draft.description}
              onChange={(event) =>
                handleFieldChange(value, "description", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Rozet metni
            </span>
            <input
              value={draft.badge}
              onChange={(event) =>
                handleFieldChange(value, "badge", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              CTA buton metni
            </span>
            <input
              value={draft.ctaText}
              onChange={(event) =>
                handleFieldChange(value, "ctaText", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
            />
          </label>
        </div>
      ),
    };
  });

  return (
    <TranslationModal
      open={open}
      onClose={onClose}
      title="Kampanya çevirileri"
      description={
        currentCampaign?.name
          ? `“${currentCampaign.name}” için diğer dillerde gösterilen içerikleri düzenleyin.`
          : "Kampanya çeviri varyantlarını yönetin."
      }
      loading={loading}
      error={error}
      emptyMessage={currentCampaign ? undefined : "Kampanya verisi bulunamadı."}
      alert={alert}
      onDismissAlert={() => setAlert(null)}
      panels={panels}
    />
  );
}
