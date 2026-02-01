import { useEffect, useMemo, useState } from "react";
import { heroApi } from "../../../api/heroes.js";
import TranslationModal from "../translations/TranslationModal.jsx";

const EMPTY_DRAFT = {
  title: "",
  subtitle: "",
  buttonText: "",
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

function createBaseDraft(hero) {
  if (!hero) return null;
  return {
    title: hero.title ?? "",
    subtitle: hero.subtitle ?? "",
    buttonText: hero.buttonText ?? "",
  };
}

function createTranslationDrafts(hero, langs = []) {
  const drafts = {};
  langs.forEach(({ value }) => {
    drafts[value] = { ...EMPTY_DRAFT };
  });

  if (!hero) return drafts;
  const translations = hero.translations || {};
  langs.forEach(({ value }) => {
    const t = translations[value] || {};
    drafts[value] = {
      title: t.title ?? "",
      subtitle: t.subtitle ?? "",
      buttonText: t.buttonText ?? "",
    };
  });

  return drafts;
}

export default function HeroTranslationModal({
  open,
  loading,
  error,
  hero,
  baseLang = "tr",
  langs = [],
  onClose,
  onUpdated,
}) {
  const [currentHero, setCurrentHero] = useState(hero);
  const [drafts, setDrafts] = useState(() => createTranslationDrafts(hero, langs));
  const [savingMap, setSavingMap] = useState({});
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    setCurrentHero(hero);
    setDrafts(createTranslationDrafts(hero, langs));
    setSavingMap({});
    setAlert(null);
  }, [hero, langs]);

  const baseDraft = useMemo(() => createBaseDraft(currentHero), [currentHero]);
  const savedDrafts = useMemo(
    () => createTranslationDrafts(currentHero, langs),
    [currentHero, langs]
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
    if (!currentHero?.id) {
      setAlert({
        variant: "danger",
        message: "Hero kaydı bulunamadı. Lütfen pencereyi kapatıp tekrar deneyin.",
      });
      return;
    }

    const draft = drafts[lang] || EMPTY_DRAFT;
    setSavingMap((prev) => ({ ...prev, [lang]: true }));
    setAlert(null);
    try {
      const payload = {
        title: (draft.title ?? "").trim(),
        subtitle: draft.subtitle ?? "",
        buttonText: draft.buttonText ?? "",
      };
      await heroApi.update(currentHero.id, payload, lang);
      const refreshed = await heroApi.get(currentHero.id, baseLang);
      setCurrentHero(refreshed);
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
      draft.title !== saved.title ||
      draft.subtitle !== saved.subtitle ||
      draft.buttonText !== saved.buttonText;
    const summary = saved.title || "Türkçe metin kullanılıyor";

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
              Başlık
            </span>
            <input
              value={draft.title}
              onChange={(event) =>
                handleFieldChange(value, "title", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="Sür headline"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Alt başlık
            </span>
            <textarea
              rows={3}
              value={draft.subtitle}
              onChange={(event) =>
                handleFieldChange(value, "subtitle", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="Kısa açıklama"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Buton metni
            </span>
            <input
              value={draft.buttonText}
              onChange={(event) =>
                handleFieldChange(value, "buttonText", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
              placeholder="Hemen keşfet"
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
      title="Hero çevirileri"
      description={
        currentHero?.title
          ? `“${currentHero.title}” için farklı dil metinlerini yönetin.`
          : "Hero çeviri varyantlarını düzenleyin."
      }
      loading={loading}
      error={error}
      emptyMessage={currentHero ? undefined : "Hero verisi bulunamadı."}
      alert={alert}
      onDismissAlert={() => setAlert(null)}
      panels={panels}
    />
  );
}
