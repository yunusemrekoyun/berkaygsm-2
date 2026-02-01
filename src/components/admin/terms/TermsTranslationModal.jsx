import { useEffect, useMemo, useState } from "react";
import { termsApi } from "../../../api/terms";
import TranslationModal from "../translations/TranslationModal.jsx";

const keywordsToText = (arr = []) => arr.filter(Boolean).join(", ");
const textToKeywords = (value = "") =>
  value
    .split(/[,\n]+/)
    .map((token) => token.trim())
    .filter(Boolean);

const buildSectionsStructure = (page) => {
  const sections = Array.isArray(page?.sections) ? page.sections : [];
  return sections.map((section, index) => ({
    index,
    title: section?.title ?? "",
    paragraphs: Array.isArray(section?.paragraphs)
      ? section.paragraphs.map((p) => String(p ?? ""))
      : [],
  }));
};

const createBaseSnapshot = (page = {}, baseLang = "tr") => {
  const translations = page?.translations || {};
  const baseSections = buildSectionsStructure(page);
  const trSections = Array.isArray(translations[baseLang]?.sections)
    ? translations[baseLang].sections.map((section) => ({
        title: section?.title ?? "",
        paragraphs: Array.isArray(section?.paragraphs)
          ? section.paragraphs.map((p) => String(p ?? ""))
          : [],
      }))
    : [];

  const mergedSections = baseSections.map((section, index) => {
    const localized = trSections[index];
    return {
      title: localized?.title || section.title || "",
      paragraphs: localized?.paragraphs?.length
        ? localized.paragraphs
        : section.paragraphs || [],
    };
  });

  return {
    heroTitle: translations[baseLang]?.heroTitle ?? page?.heroTitle ?? "",
    heroIntro: translations[baseLang]?.heroIntro ?? page?.heroIntro ?? "",
    sections: mergedSections,
    footerNote: translations[baseLang]?.footerNote ?? page?.footerNote ?? "",
    seo: {
      title: translations[baseLang]?.seo?.title ?? page?.seo?.title ?? "",
      description:
        translations[baseLang]?.seo?.description ??
        page?.seo?.description ??
        "",
      keywords: translations[baseLang]?.seo?.keywords?.length
        ? translations[baseLang].seo.keywords
        : page?.seo?.keywords || [],
    },
  };
};

const createTranslationDrafts = (page, langs = [], structure = []) => {
  const translations = page?.translations || {};
  const drafts = {};
  langs.forEach(({ value }) => {
    const bucket = translations[value] || {};
    drafts[value] = {
      heroTitle: bucket.heroTitle ?? "",
      heroIntro: bucket.heroIntro ?? "",
      sections: structure.map((section, index) => {
        const localized = Array.isArray(bucket.sections)
          ? bucket.sections[index]
          : null;
        return {
          title: localized?.title ?? "",
          paragraphs: Array.isArray(localized?.paragraphs)
            ? localized.paragraphs.map((p) => String(p ?? ""))
            : [],
        };
      }),
      footerNote: bucket.footerNote ?? "",
      seo: {
        title: bucket.seo?.title ?? "",
        description: bucket.seo?.description ?? "",
        keywords: keywordsToText(bucket.seo?.keywords || []),
      },
    };
  });
  return drafts;
};

export default function TermsTranslationModal({
  open,
  loading,
  error,
  terms,
  baseLang = "tr",
  langs = [],
  onClose,
  onUpdated,
}) {
  const structure = useMemo(() => buildSectionsStructure(terms), [terms]);
  const baseSnapshot = useMemo(
    () => createBaseSnapshot(terms, baseLang),
    [terms, baseLang]
  );
  const [drafts, setDrafts] = useState(() =>
    createTranslationDrafts(terms, langs, structure)
  );
  const [savingMap, setSavingMap] = useState({});
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const nextDrafts = createTranslationDrafts(terms, langs, structure);
    setDrafts(nextDrafts);
    setSavingMap({});
    setAlert(null);
  }, [terms, langs, structure]);

  const handleFieldChange = (lang, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: {
        ...(prev[lang] || createTranslationDrafts(terms, [lang], structure)[lang]),
        [field]: value,
      },
    }));
  };

  const handleSectionChange = (lang, index, field, value) => {
    setDrafts((prev) => {
      const existing =
        prev[lang] || createTranslationDrafts(terms, [lang], structure)[lang];
      const sections =
        existing.sections || structure.map(() => ({ title: "", paragraphs: [] }));
      const nextSections = sections.map((section, idx) =>
        idx === index ? { ...section, [field]: value } : section
      );
      return {
        ...prev,
        [lang]: {
          ...existing,
          sections: nextSections,
        },
      };
    });
  };

  const handleParagraphChange = (lang, index, value) => {
    const paragraphs = value
      .split(/\n{2,}/)
      .map((line) => line.trim())
      .filter(Boolean);
    handleSectionChange(lang, index, "paragraphs", paragraphs);
  };

  const handleCopyFromBase = (lang) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: {
        heroTitle: baseSnapshot.heroTitle,
        heroIntro: baseSnapshot.heroIntro,
        sections: baseSnapshot.sections.map((section) => ({
          title: section.title,
          paragraphs: section.paragraphs,
        })),
        footerNote: baseSnapshot.footerNote,
        seo: {
          title: baseSnapshot.seo.title,
          description: baseSnapshot.seo.description,
          keywords: keywordsToText(baseSnapshot.seo.keywords),
        },
      },
    }));
  };

  const handleReset = (lang) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: createTranslationDrafts(terms, [{ value: lang }], structure)[lang],
    }));
  };

  const handleSave = async (lang) => {
    const draft = drafts[lang] || createTranslationDrafts(terms, [lang], structure)[lang];
    setSavingMap((prev) => ({ ...prev, [lang]: true }));
    setAlert(null);
    try {
      const payload = {
        heroTitle: (draft.heroTitle ?? "").trim(),
        heroIntro: draft.heroIntro ?? "",
        // eslint-disable-next-line no-unused-vars
        sections: draft.sections.map((section, index) => ({
          title: (section.title ?? "").trim(),
          paragraphs: section.paragraphs || [],
        })),
        footerNote: draft.footerNote ?? "",
        seo: {
          title: draft.seo?.title ?? "",
          description: draft.seo?.description ?? "",
          keywords: textToKeywords(draft.seo?.keywords ?? ""),
        },
      };

      await termsApi.updateTranslations(payload, lang);
      const refreshed = await termsApi.get(baseLang);
      const nextTerms = refreshed?.page || refreshed;
      setDrafts(
        createTranslationDrafts(nextTerms, langs, buildSectionsStructure(nextTerms))
      );
      setAlert({
        variant: "success",
        message: `${lang.toUpperCase()} çevirisi kaydedildi`,
      });
      await onUpdated?.(nextTerms);
    } catch (err) {
      setAlert({ variant: "danger", message: err?.message || "Kaydedilemedi" });
    } finally {
      setSavingMap((prev) => ({ ...prev, [lang]: false }));
    }
  };

  const panels = (langs || []).map(({ value, label }) => {
    const draft = drafts[value] || createTranslationDrafts(terms, [value], structure)[value];
    const saved = createTranslationDrafts(terms, [{ value }], structure)[value];
    const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

    return {
      value,
      label,
      summary: draft.heroTitle || "Türkçe metin kullanılıyor",
      dirty: isDirty,
      saving: Boolean(savingMap[value]),
      onCopy: () => handleCopyFromBase(value),
      onReset: () => handleReset(value),
      onSave: () => handleSave(value),
      render: () => (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Hero başlığı
            </span>
            <input
              value={draft.heroTitle}
              onChange={(event) =>
                handleFieldChange(value, "heroTitle", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Hero intro
            </span>
            <textarea
              rows={3}
              value={draft.heroIntro}
              onChange={(event) =>
                handleFieldChange(value, "heroIntro", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
            />
          </label>

          {draft.sections.map((section, index) => (
            <div
              key={index}
              className="space-y-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-surface-light)] p-3"
            >
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                  Bölüm başlığı ({structure[index]?.title || "TR"})
                </span>
                <input
                  value={section.title}
                  onChange={(event) =>
                    handleSectionChange(value, index, "title", event.target.value)
                  }
                  className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                  Paragraflar (boş satır paragraf ayırır)
                </span>
                <textarea
                  rows={4}
                  value={section.paragraphs.join("\n\n")}
                onChange={(event) =>
                  handleParagraphChange(value, index, event.target.value)
                }
                  className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm font-mono"
                />
              </label>
            </div>
          ))}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Footer notu
            </span>
            <textarea
              rows={3}
              value={draft.footerNote}
              onChange={(event) =>
                handleFieldChange(value, "footerNote", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
            />
          </label>

          <div className="space-y-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-surface-light)] p-3">
            <p className="text-xs font-semibold text-[var(--color-text-admin)]">
              SEO ayarları
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                SEO başlığı
              </span>
              <input
                value={draft.seo?.title ?? ""}
                onChange={(event) =>
                  handleFieldChange(value, "seo", {
                    ...(draft.seo || {}),
                    title: event.target.value,
                  })
                }
                className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                SEO açıklaması
              </span>
              <textarea
                rows={2}
                value={draft.seo?.description ?? ""}
                onChange={(event) =>
                  handleFieldChange(value, "seo", {
                    ...(draft.seo || {}),
                    description: event.target.value,
                  })
                }
                className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                SEO anahtar kelimeler
              </span>
              <textarea
                rows={2}
                value={draft.seo?.keywords ?? ""}
                onChange={(event) =>
                  handleFieldChange(value, "seo", {
                    ...(draft.seo || {}),
                    keywords: event.target.value,
                  })
                }
                className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm font-mono"
              />
            </label>
          </div>
        </div>
      ),
    };
  });

  return (
    <TranslationModal
      open={open}
      onClose={onClose}
      title="Şartlar & Koşullar çevirileri"
      description="Hero metinleri, bölümler ve SEO içeriklerini diller bazında yönetin."
      loading={loading}
      error={error}
      emptyMessage={terms ? undefined : "Şartlar sayfası bulunamadı."}
      alert={alert}
      onDismissAlert={() => setAlert(null)}
      panels={panels}
    />
  );
}
