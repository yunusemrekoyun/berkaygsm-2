import { useEffect, useMemo, useState } from "react";
import privacyApi from "../../../api/privacy.js";
import TranslationModal from "../translations/TranslationModal.jsx";

const joinParagraphs = (arr = []) => arr.filter(Boolean).join("\n\n");
const splitParagraphs = (value = "") =>
  value
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);

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
    id: section?.id || `section_${index}`,
    title: section?.title ?? "",
    content: Array.isArray(section?.content)
      ? section.content.map((p) => String(p ?? ""))
      : [],
  }));
};

const mapById = (sections = []) => {
  const map = new Map();
  if (!Array.isArray(sections)) return map;
  sections.forEach((section, index) => {
    const key = section?.id || `__idx_${index}`;
    map.set(key, {
      title: section?.title ?? "",
      content: Array.isArray(section?.content)
        ? section.content.map((p) => String(p ?? ""))
        : [],
    });
  });
  return map;
};

const createEmptyDraft = (structure = []) => ({
  heroTitle: "",
  heroIntro: "",
  sections: structure.map((section) => ({
    id: section.id,
    title: "",
    content: [],
  })),
  footerHtml: "",
  seo: {
    title: "",
    description: "",
    keywords: "",
  },
});

const createBaseSnapshot = (page = {}, baseLang = "tr") => {
  const translations = page?.translations || {};
  const baseSections = buildSectionsStructure(page);
  const trSections = mapById(translations[baseLang]?.sections || []);

  const mergedSections = baseSections.map((section) => {
    const localized = trSections.get(section.id);
    return {
      id: section.id,
      title: localized?.title || section.title || "",
      content: localized?.content?.length
        ? localized.content
        : section.content || [],
    };
  });

  return {
    heroTitle: translations[baseLang]?.heroTitle ?? page?.heroTitle ?? "",
    heroIntro: translations[baseLang]?.heroIntro ?? page?.heroIntro ?? "",
    sections: mergedSections,
    footerHtml: translations[baseLang]?.footerHtml ?? page?.footerHtml ?? "",
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
    const sectionMap = mapById(bucket.sections || []);
    drafts[value] = {
      heroTitle: bucket.heroTitle ?? "",
      heroIntro: bucket.heroIntro ?? "",
      sections: structure.map((section) => ({
        id: section.id,
        title: sectionMap.get(section.id)?.title ?? "",
        content: sectionMap.get(section.id)?.content || [],
      })),
      footerHtml: bucket.footerHtml ?? "",
      seo: {
        title: bucket.seo?.title ?? "",
        description: bucket.seo?.description ?? "",
        keywords: keywordsToText(bucket.seo?.keywords || []),
      },
    };
  });
  return drafts;
};

export default function PrivacyTranslationModal({
  open,
  loading,
  error,
  privacy,
  baseLang = "tr",
  langs = [],
  onClose,
  onUpdated,
}) {
  const structure = useMemo(() => buildSectionsStructure(privacy), [privacy]);
  const baseSnapshot = useMemo(
    () => createBaseSnapshot(privacy, baseLang),
    [privacy, baseLang]
  );
  const [drafts, setDrafts] = useState(() =>
    createTranslationDrafts(privacy, langs, structure)
  );
  const [savingMap, setSavingMap] = useState({});
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    setDrafts(createTranslationDrafts(privacy, langs, structure));
    setSavingMap({});
    setAlert(null);
  }, [privacy, langs, structure]);

  const handleFieldChange = (lang, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: {
        ...(prev[lang] || createEmptyDraft(structure)),
        [field]: value,
      },
    }));
  };

  const handleSectionTitleChange = (lang, index, value) => {
    setDrafts((prev) => {
      const existing = prev[lang] || createEmptyDraft(structure);
      const sections = existing.sections || createEmptyDraft(structure).sections;
      const next = sections.map((section, idx) =>
        idx === index ? { ...section, title: value } : section
      );
      return {
        ...prev,
        [lang]: { ...existing, sections: next },
      };
    });
  };

  const handleSectionContentChange = (lang, index, value) => {
    const content = splitParagraphs(value);
    setDrafts((prev) => {
      const existing = prev[lang] || createEmptyDraft(structure);
      const sections = existing.sections || createEmptyDraft(structure).sections;
      const next = sections.map((section, idx) =>
        idx === index ? { ...section, content } : section
      );
      return {
        ...prev,
        [lang]: { ...existing, sections: next },
      };
    });
  };

  const handleCopyFromBase = (lang) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: {
        heroTitle: baseSnapshot.heroTitle,
        heroIntro: baseSnapshot.heroIntro,
        sections: baseSnapshot.sections.map((section) => ({
          id: section.id,
          title: section.title,
          content: section.content,
        })),
        footerHtml: baseSnapshot.footerHtml,
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
      [lang]: createTranslationDrafts(privacy, [{ value: lang }], structure)[
        lang
      ],
    }));
  };

  const handleSave = async (lang) => {
    const draft = drafts[lang] || createEmptyDraft(structure);
    setSavingMap((prev) => ({ ...prev, [lang]: true }));
    setAlert(null);
    try {
      const payload = {
        heroTitle: (draft.heroTitle ?? "").trim(),
        heroIntro: draft.heroIntro ?? "",
        sections: draft.sections.map((section, index) => ({
          id: structure[index]?.id,
          title: (section.title ?? "").trim(),
          content: section.content || [],
        })),
        footerHtml: draft.footerHtml ?? "",
        seo: {
          title: draft.seo?.title ?? "",
          description: draft.seo?.description ?? "",
          keywords: textToKeywords(draft.seo?.keywords ?? ""),
        },
      };

      await privacyApi.updateTranslations(payload, lang);
      const refreshed = await privacyApi.get(baseLang);
      const nextPrivacy = refreshed?.privacyPolicy || refreshed;
      setDrafts(
        createTranslationDrafts(nextPrivacy, langs, buildSectionsStructure(nextPrivacy))
      );
      setAlert({
        variant: "success",
        message: `${lang.toUpperCase()} çevirisi kaydedildi`,
      });
      await onUpdated?.(nextPrivacy);
    } catch (err) {
      setAlert({ variant: "danger", message: err?.message || "Kaydedilemedi" });
    } finally {
      setSavingMap((prev) => ({ ...prev, [lang]: false }));
    }
  };

  const panels = (langs || []).map(({ value, label }) => {
    const draft = drafts[value] || createEmptyDraft(structure);
    const saved = createTranslationDrafts(privacy, [{ value }], structure)[value];
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
              key={section.id}
              className="space-y-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-surface-light)] p-3"
            >
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                  Bölüm başlığı ({structure[index]?.title || "TR"})
                </span>
                <input
                  value={section.title}
                  onChange={(event) =>
                    handleSectionTitleChange(value, index, event.target.value)
                  }
                  className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                  Paragraflar (iki satır arası boşluk paragraf ayırır)
                </span>
                <textarea
                  rows={5}
                  value={joinParagraphs(section.content)}
                  onChange={(event) =>
                    handleSectionContentChange(value, index, event.target.value)
                  }
                  className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm font-mono"
                />
              </label>
            </div>
          ))}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Footer HTML
            </span>
            <textarea
              rows={4}
              value={draft.footerHtml}
              onChange={(event) =>
                handleFieldChange(value, "footerHtml", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm font-mono"
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
      title="Gizlilik politikası çevirileri"
      description="Hero, bölüm içerikleri ve SEO metinlerini diller bazında yönetin."
      loading={loading}
      error={error}
      emptyMessage={privacy ? undefined : "Gizlilik politikası bulunamadı."}
      alert={alert}
      onDismissAlert={() => setAlert(null)}
      panels={panels}
    />
  );
}
