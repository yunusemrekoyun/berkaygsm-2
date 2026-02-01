import { useEffect, useMemo, useState } from "react";
import { aboutApi } from "../../../api/about.js";
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
  heroTitle: "",
  heroSubtitle: "",
  materialsTitle: "",
  materialsText: "",
  materialsBullets: "",
  ctaTitle: "",
  ctaSubtitle: "",
  dotBlocks: [],
  stats: [],
  ctas: [],
};

const arrayToText = (value) =>
  Array.isArray(value) ? value.filter(Boolean).join("\n") : "";

const textToArray = (value) =>
  String(value || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

function createBaseDraft(about) {
  if (!about) return null;
  return {
    heroTitle: about.heroTitle ?? "",
    heroSubtitle: about.heroSubtitle ?? "",
    materialsTitle: about.materialsTitle ?? "",
    materialsText: about.materialsText ?? "",
    materialsBullets: arrayToText(about.materialsBullets),
    ctaTitle: about.ctaTitle ?? "",
    ctaSubtitle: about.ctaSubtitle ?? "",
    dotBlocks: (about.dotBlocks || []).map((block) => ({
      title: block?.title ?? "",
      text: block?.text ?? "",
    })),
    stats: (about.stats || []).map((stat) => ({
      value: stat?.value ?? "",
      label: stat?.label ?? "",
    })),
    ctas: (about.ctas || []).map((cta) => ({
      text: cta?.text ?? "",
    })),
  };
}

function createTranslationDrafts(about, langs = []) {
  const baseDotBlocks = about?.dotBlocks || [];
  const baseStats = about?.stats || [];
  const baseCtas = about?.ctas || [];
  const drafts = {};

  langs.forEach(({ value }) => {
    const translation = about?.translations?.[value] || {};
    drafts[value] = {
      heroTitle: translation.heroTitle ?? "",
      heroSubtitle: translation.heroSubtitle ?? "",
      materialsTitle: translation.materialsTitle ?? "",
      materialsText: translation.materialsText ?? "",
      materialsBullets: arrayToText(translation.materialsBullets),
      ctaTitle: translation.ctaTitle ?? "",
      ctaSubtitle: translation.ctaSubtitle ?? "",
      dotBlocks: baseDotBlocks.map((_, idx) => {
        const localized = translation.dotBlocks?.[idx] || {};
        return {
          title: localized.title ?? "",
          text: localized.text ?? "",
        };
      }),
      stats: baseStats.map((_, idx) => {
        const localized = translation.stats?.[idx] || {};
        return {
          value: localized.value ?? "",
          label: localized.label ?? "",
        };
      }),
      ctas: baseCtas.map((_, idx) => {
        const localized = translation.ctas?.[idx] || {};
        return {
          text: localized.text ?? "",
        };
      }),
    };
  });

  return drafts;
}

export default function AboutTranslationModal({
  open,
  loading,
  error,
  about,
  baseLang = "tr",
  langs = [],
  onClose,
  onUpdated,
}) {
  const [currentAbout, setCurrentAbout] = useState(about);
  const [drafts, setDrafts] = useState(() =>
    createTranslationDrafts(about, langs)
  );
  const [savingMap, setSavingMap] = useState({});
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    setCurrentAbout(about);
    setDrafts(createTranslationDrafts(about, langs));
    setSavingMap({});
    setAlert(null);
  }, [about, langs]);

  const baseDraft = useMemo(
    () => createBaseDraft(currentAbout),
    [currentAbout]
  );
  const baseDotBlocks = currentAbout?.dotBlocks || [];
  const baseStats = currentAbout?.stats || [];
  const baseCtas = currentAbout?.ctas || [];
  const savedDrafts = useMemo(
    () => createTranslationDrafts(currentAbout, langs),
    [currentAbout, langs]
  );

  const handleFieldChange = (lang, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: {
        ...(prev[lang] || { ...EMPTY_DRAFT }),
        [field]: value,
      },
    }));
  };

  const handleNestedChange = (lang, field, index, key, value) => {
    setDrafts((prev) => {
      const existing = prev[lang] || { ...EMPTY_DRAFT };
      const list = Array.isArray(existing[field]) ? [...existing[field]] : [];
      const target = { ...(list[index] || {}) };
      target[key] = value;
      list[index] = target;
      return {
        ...prev,
        [lang]: {
          ...existing,
          [field]: list,
        },
      };
    });
  };

  const handleCopyFromBase = (lang) => {
    if (!baseDraft) return;
    setDrafts((prev) => ({
      ...prev,
      [lang]: {
        ...baseDraft,
        materialsBullets: baseDraft.materialsBullets ?? "",
      },
    }));
  };

  const handleReset = (lang) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: savedDrafts[lang] || { ...EMPTY_DRAFT },
    }));
  };

  const handleSave = async (lang) => {
    if (!currentAbout) {
      setAlert({
        variant: "danger",
        message: "Kayıt bulunamadı. Lütfen pencereyi kapatıp tekrar deneyin.",
      });
      return;
    }
    const draft = drafts[lang] || {};
    setSavingMap((prev) => ({ ...prev, [lang]: true }));
    setAlert(null);
    try {
      const payload = {
        heroTitle: (draft.heroTitle ?? "").trim(),
        heroSubtitle: draft.heroSubtitle ?? "",
        materialsTitle: (draft.materialsTitle ?? "").trim(),
        materialsText: draft.materialsText ?? "",
        materialsBullets: textToArray(draft.materialsBullets),
        ctaTitle: (draft.ctaTitle ?? "").trim(),
        ctaSubtitle: draft.ctaSubtitle ?? "",
        dotBlocks: baseDotBlocks.map((_, idx) => ({
          title: (draft.dotBlocks?.[idx]?.title ?? "").trim(),
          text: draft.dotBlocks?.[idx]?.text ?? "",
        })),
        stats: baseStats.map((_, idx) => ({
          value: (draft.stats?.[idx]?.value ?? "").trim(),
          label: (draft.stats?.[idx]?.label ?? "").trim(),
        })),
        ctas: baseCtas.map((_, idx) => ({
          text: (draft.ctas?.[idx]?.text ?? "").trim(),
        })),
      };

      await aboutApi.updateTranslations(payload, lang);
      const refreshed = await aboutApi.get(baseLang);
      const nextAbout = refreshed?.about || refreshed;
      setCurrentAbout(nextAbout);
      setDrafts(createTranslationDrafts(nextAbout, langs));
      setAlert({
        variant: "success",
        message: `${lang.toUpperCase()} çevirisi kaydedildi`,
      });
      await onUpdated?.(nextAbout);
    } catch (err) {
      setAlert({ variant: "danger", message: extractMessage(err) });
    } finally {
      setSavingMap((prev) => ({ ...prev, [lang]: false }));
    }
  };

  const panels = (langs || []).map(({ value, label }) => {
    const draft = drafts[value] || { ...EMPTY_DRAFT };
    const saved = savedDrafts[value] || { ...EMPTY_DRAFT };
    const isDirty =
      JSON.stringify(draft) !== JSON.stringify(saved || {});

    return {
      value,
      label,
      summary: saved.heroTitle || "Türkçe metin kullanılıyor",
      dirty: isDirty,
      saving: Boolean(savingMap[value]),
      onCopy: () => handleCopyFromBase(value),
      onReset: () => handleReset(value),
      onSave: () => handleSave(value),
      render: () => (
        <div className="space-y-4">
          <p className="text-xs text-[var(--color-text-admin-muted)]">
            Doldurulmayan alanlarda Türkçe içerik gösterilir.
          </p>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Hero başlığı
            </span>
            <input
              value={draft.heroTitle}
              onChange={(event) =>
                handleFieldChange(value, "heroTitle", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Hero alt başlık
            </span>
            <textarea
              rows={3}
              value={draft.heroSubtitle}
              onChange={(event) =>
                handleFieldChange(value, "heroSubtitle", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                Malzemeler başlığı
              </span>
              <input
                value={draft.materialsTitle}
                onChange={(event) =>
                  handleFieldChange(value, "materialsTitle", event.target.value)
                }
                className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                Malzemeler açıklaması
              </span>
              <textarea
                rows={3}
                value={draft.materialsText}
                onChange={(event) =>
                  handleFieldChange(value, "materialsText", event.target.value)
                }
                className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Malzeme maddeleri (her satır bir madde)
            </span>
            <textarea
              rows={4}
              value={draft.materialsBullets}
              onChange={(event) =>
                handleFieldChange(value, "materialsBullets", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm font-mono"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                CTA başlığı
              </span>
              <input
                value={draft.ctaTitle}
                onChange={(event) =>
                  handleFieldChange(value, "ctaTitle", event.target.value)
                }
                className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                CTA alt başlık
              </span>
              <textarea
                rows={2}
                value={draft.ctaSubtitle}
                onChange={(event) =>
                  handleFieldChange(value, "ctaSubtitle", event.target.value)
                }
                className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
              />
            </label>
          </div>

          {baseDotBlocks.length > 0 && (
            <div className="space-y-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-surface-light)] p-3">
              <p className="text-xs font-semibold text-[var(--color-text-admin)]">
                Hikaye blokları
              </p>
              {baseDotBlocks.map((block, idx) => (
                <div
                  key={idx}
                  className="space-y-2 rounded-lg border border-dashed border-[var(--color-border-admin)] p-3"
                >
                  <p className="text-[11px] text-[var(--color-text-admin-muted)]">
                    Blok {idx + 1}: {block.title || "Başlık yok"}
                  </p>
                  <input
                    value={draft.dotBlocks?.[idx]?.title ?? ""}
                    onChange={(event) =>
                      handleNestedChange(
                        value,
                        "dotBlocks",
                        idx,
                        "title",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                    placeholder="Blok başlığı"
                  />
                  <textarea
                    rows={3}
                    value={draft.dotBlocks?.[idx]?.text ?? ""}
                    onChange={(event) =>
                      handleNestedChange(
                        value,
                        "dotBlocks",
                        idx,
                        "text",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                    placeholder="Blok metni"
                  />
                </div>
              ))}
            </div>
          )}

          {baseStats.length > 0 && (
            <div className="space-y-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-surface-light)] p-3">
              <p className="text-xs font-semibold text-[var(--color-text-admin)]">
                İstatistikler
              </p>
              {baseStats.map((stat, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-2">
                  <input
                    value={draft.stats?.[idx]?.value ?? ""}
                    onChange={(event) =>
                      handleNestedChange(
                        value,
                        "stats",
                        idx,
                        "value",
                        event.target.value
                      )
                    }
                    className="rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                    placeholder={`Değer (varsayılan ${stat.value})`}
                  />
                  <input
                    value={draft.stats?.[idx]?.label ?? ""}
                    onChange={(event) =>
                      handleNestedChange(
                        value,
                        "stats",
                        idx,
                        "label",
                        event.target.value
                      )
                    }
                    className="rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                    placeholder={`Etiket (varsayılan ${stat.label})`}
                  />
                </div>
              ))}
            </div>
          )}

          {baseCtas.length > 0 && (
            <div className="space-y-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-surface-light)] p-3">
              <p className="text-xs font-semibold text-[var(--color-text-admin)]">
                CTA buton metinleri
              </p>
              {baseCtas.map((cta, idx) => (
                <input
                  key={idx}
                  value={draft.ctas?.[idx]?.text ?? ""}
                  onChange={(event) =>
                    handleNestedChange(value, "ctas", idx, "text", event.target.value)
                  }
                  className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                  placeholder={`CTA ${idx + 1} metni (varsayılan ${cta.text || "-"})`}
                />
              ))}
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
      title="Hakkımızda çevirileri"
      description="Her dil için hero, hikaye ve CTA metinlerini düzenleyin. Boş bırakılan alanlarda Türkçe metin gösterilmeye devam eder."
      loading={loading}
      error={error}
      emptyMessage={currentAbout ? undefined : "Hakkımızda verisi bulunamadı."}
      alert={alert}
      onDismissAlert={() => setAlert(null)}
      panels={panels}
    />
  );
}
