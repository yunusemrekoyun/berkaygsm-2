import { useEffect, useMemo, useState } from "react";
import { setApi } from "../../../api/sets.js";
import TranslationModal from "../translations/TranslationModal.jsx";

const EMPTY_DRAFT = {
  name: "",
  description: "",
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

function createBaseDraft(setItem) {
  if (!setItem) return null;
  return {
    name: setItem.name ?? "",
    description: setItem.description ?? "",
  };
}

function createTranslationDrafts(setItem, langs = []) {
  const drafts = {};
  langs.forEach(({ value }) => {
    drafts[value] = { ...EMPTY_DRAFT };
  });

  if (!setItem) return drafts;
  const translations = setItem.translations || {};
  langs.forEach(({ value }) => {
    const t = translations[value] || {};
    drafts[value] = {
      name: t.name ?? "",
      description: t.description ?? "",
    };
  });

  return drafts;
}

export default function SetTranslationModal({
  open,
  loading,
  error,
  setItem,
  baseLang = "tr",
  langs = [],
  onClose,
  onUpdated,
}) {
  const [currentSet, setCurrentSet] = useState(setItem);
  const [drafts, setDrafts] = useState(() =>
    createTranslationDrafts(setItem, langs)
  );
  const [savingMap, setSavingMap] = useState({});
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    setCurrentSet(setItem);
    setDrafts(createTranslationDrafts(setItem, langs));
    setSavingMap({});
    setAlert(null);
  }, [setItem, langs]);

  const baseDraft = useMemo(
    () => createBaseDraft(currentSet),
    [currentSet]
  );

  const savedDrafts = useMemo(
    () => createTranslationDrafts(currentSet, langs),
    [currentSet, langs]
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
    if (!currentSet) {
      setAlert({
        variant: "danger",
        message: "Set verisi bulunamadı. Lütfen pencereyi kapatıp tekrar deneyin.",
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
      };
      await setApi.update(currentSet, payload, lang);
      const refreshed = await setApi.get(currentSet, baseLang, {
        auth: true,
      });
      setCurrentSet(refreshed);
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
    const isDirty =
      draft.name !== saved.name || draft.description !== saved.description;
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
              Set adı
            </span>
            <input
              value={draft.name}
              onChange={(event) =>
                handleFieldChange(value, "name", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="Set adı"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Set açıklaması
            </span>
            <textarea
              rows={5}
              value={draft.description}
              onChange={(event) =>
                handleFieldChange(value, "description", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="Set açıklaması"
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
      title="Set çevirileri"
      description={
        currentSet?.name
          ? `“${currentSet.name}” için diğer dillerde görünen metinleri düzenleyin.`
          : "Set çeviri varyantlarını yönetin."
      }
      loading={loading}
      error={error}
      emptyMessage={currentSet ? undefined : "Set verisi bulunamadı."}
      alert={alert}
      onDismissAlert={() => setAlert(null)}
      panels={panels}
    />
  );
}
