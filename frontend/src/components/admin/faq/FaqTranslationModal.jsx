import { useEffect, useMemo, useState } from "react";
import { faqApi } from "../../../api/faq.js";
import TranslationModal from "../translations/TranslationModal.jsx";

const KEYWORDS_SEPARATOR = ", ";

const buildIdString = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && typeof value.toString === "function") {
    const str = value.toString();
    if (str && str !== "[object Object]") return str;
  }
  return null;
};

const buildSectionKey = (section, index = 0) =>
  buildIdString(section?.id) ??
  buildIdString(section?._id) ??
  section?.key ??
  `section_${index}`;

const buildItemKey = (item, parentKey, index = 0) =>
  buildIdString(item?.id) ??
  buildIdString(item?._id) ??
  item?.key ??
  `${parentKey}_item_${index}`;

const buildSectionsStructure = (faq) => {
  const sections = Array.isArray(faq?.sections) ? faq.sections : [];
  return sections.map((section, si) => {
    const key = buildSectionKey(section, si);
    return {
      key,
      _id: section?.id ?? section?._id ?? null,
      title: section?.title ?? "",
      subtitle: section?.subtitle ?? "",
      items: (Array.isArray(section?.items) ? section.items : []).map(
        (item, qi) => {
          const itemKey = buildItemKey(item, key, qi);
          return {
            key: itemKey,
            _id: item?.id ?? item?._id ?? null,
            question: item?.question ?? "",
            answer: item?.answer ?? "",
          };
        }
      ),
    };
  });
};

const createEmptyDraft = (structure = []) => {
  const sections = {};
  structure.forEach((section) => {
    sections[section.key] = {
      title: "",
      subtitle: "",
      items: section.items.reduce((acc, item) => {
        acc[item.key] = { question: "", answer: "" };
        return acc;
      }, {}),
    };
  });
  return {
    heroTitle: "",
    heroIntro: "",
    sections,
    seo: { title: "", description: "", keywords: "" },
  };
};

const normalizeSeoKeywords = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(KEYWORDS_SEPARATOR);
  }
  return String(value ?? "");
};

const createBaseSnapshot = (faq, structure = []) => {
  const sections = {};
  structure.forEach((section) => {
    sections[section.key] = {
      title: section.title,
      subtitle: section.subtitle,
      items: section.items.reduce((acc, item) => {
        acc[item.key] = {
          question: item.question,
          answer: item.answer,
        };
        return acc;
      }, {}),
    };
  });
  return {
    heroTitle: faq?.heroTitle ?? "",
    heroIntro: faq?.heroIntro ?? "",
    sections,
    seo: {
      title: faq?.seo?.title ?? "",
      description: faq?.seo?.description ?? "",
      keywords: normalizeSeoKeywords(faq?.seo?.keywords || []),
    },
  };
};

function buildDraftFromTranslation(translation, structure = []) {
  const draft = createEmptyDraft(structure);
  if (!translation) return draft;

  draft.heroTitle = translation.heroTitle ?? "";
  draft.heroIntro = translation.heroIntro ?? "";
  if (translation.seo) {
    draft.seo = {
      title: translation.seo.title ?? "",
      description: translation.seo.description ?? "",
      keywords: normalizeSeoKeywords(translation.seo.keywords),
    };
  }

  if (Array.isArray(translation.sections)) {
    const map = new Map();
    translation.sections.forEach((section, index) => {
      map.set(buildSectionKey(section, index), section);
    });
    structure.forEach((section) => {
      const localized = map.get(section.key);
      if (!localized) return;
      const target = draft.sections[section.key] || {
        title: "",
        subtitle: "",
        items: {},
      };
      if (localized.title !== undefined) {
        target.title = localized.title ?? "";
      }
      if (localized.subtitle !== undefined) {
        target.subtitle = localized.subtitle ?? "";
      }
      if (Array.isArray(localized.items)) {
        const itemMap = new Map();
        localized.items.forEach((item, itemIndex) => {
          itemMap.set(buildItemKey(item, section.key, itemIndex), item);
        });
        section.items.forEach((item) => {
          const localizedItem = itemMap.get(item.key);
          const targetItem = target.items[item.key] || {
            question: "",
            answer: "",
          };
          if (localizedItem) {
            if (localizedItem.question !== undefined) {
              targetItem.question = localizedItem.question ?? "";
            }
            if (localizedItem.answer !== undefined) {
              targetItem.answer = localizedItem.answer ?? "";
            }
          }
          target.items[item.key] = targetItem;
        });
      }
      draft.sections[section.key] = target;
    });
  }

  return draft;
}

const createTranslationDrafts = (faq, langs = [], structure = []) => {
  const translations = faq?.translations || {};
  const drafts = {};
  langs.forEach(({ value }) => {
    drafts[value] = buildDraftFromTranslation(translations[value], structure);
  });
  return drafts;
};

const buildPayloadFromDraft = (draft, structure = []) => {
  const safeDraft = draft || createEmptyDraft(structure);
  const keywordArray = (safeDraft.seo?.keywords || "")
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    heroTitle: safeDraft.heroTitle?.trim?.() ?? "",
    heroIntro: safeDraft.heroIntro?.trim?.() ?? "",
    sections: structure.map((section) => {
      const source = safeDraft.sections?.[section.key] || {
        title: "",
        subtitle: "",
        items: {},
      };
      return {
        id: section._id,
        title: source.title ?? section.title ?? "",
        subtitle: source.subtitle ?? section.subtitle ?? "",
        items: section.items.map((item) => {
          const sourceItem = source.items?.[item.key] || {
            question: "",
            answer: "",
          };
          return {
            id: item._id,
            question: sourceItem.question ?? item.question ?? "",
            answer: sourceItem.answer ?? item.answer ?? "",
          };
        }),
      };
    }),
    seo: {
      title: safeDraft.seo?.title ?? "",
      description: safeDraft.seo?.description ?? "",
      keywords: keywordArray,
    },
  };
};

export default function FaqTranslationModal({
  open,
  loading,
  error,
  faq,
  baseLang = "tr",
  langs = [],
  onClose,
  onUpdated,
}) {
  const structure = useMemo(() => buildSectionsStructure(faq), [faq]);
  const baseSnapshot = useMemo(
    () => createBaseSnapshot(faq, structure),
    [faq, structure]
  );
  const [drafts, setDrafts] = useState(() =>
    createTranslationDrafts(faq, langs, structure)
  );
  const [savingMap, setSavingMap] = useState({});
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const nextDrafts = createTranslationDrafts(faq, langs, structure);
    setDrafts(nextDrafts);
    setSavingMap({});
    setAlert(null);
  }, [faq, langs, structure]);

  const handleFieldChange = (lang, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: {
        ...(prev[lang] || createEmptyDraft(structure)),
        [field]: value,
      },
    }));
  };

  const handleSectionChange = (lang, sectionKey, field, value) => {
    setDrafts((prev) => {
      const existing = prev[lang] || createEmptyDraft(structure);
      const section = existing.sections?.[sectionKey] || {
        title: "",
        subtitle: "",
        items: {},
      };
      return {
        ...prev,
        [lang]: {
          ...existing,
          sections: {
            ...(existing.sections || {}),
            [sectionKey]: { ...section, [field]: value },
          },
        },
      };
    });
  };

  const handleItemChange = (lang, sectionKey, itemKey, field, value) => {
    setDrafts((prev) => {
      const existing = prev[lang] || createEmptyDraft(structure);
      const section = existing.sections?.[sectionKey] || {
        title: "",
        subtitle: "",
        items: {},
      };
      const item = section.items?.[itemKey] || {
        question: "",
        answer: "",
      };
      return {
        ...prev,
        [lang]: {
          ...existing,
          sections: {
            ...(existing.sections || {}),
            [sectionKey]: {
              ...section,
              items: {
                ...(section.items || {}),
                [itemKey]: { ...item, [field]: value },
              },
            },
          },
        },
      };
    });
  };

  const handleCopyFromBase = (lang) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: createBaseSnapshot(
        {
          heroTitle: baseSnapshot.heroTitle,
          heroIntro: baseSnapshot.heroIntro,
          sections: structure.map((section) => ({
            id: section._id,
            title: baseSnapshot.sections[section.key].title,
            subtitle: baseSnapshot.sections[section.key].subtitle,
            items: section.items.map((item) => ({
              id: item._id,
              question:
                baseSnapshot.sections[section.key].items[item.key].question,
              answer: baseSnapshot.sections[section.key].items[item.key].answer,
            })),
          })),
          seo: {
            title: baseSnapshot.seo.title,
            description: baseSnapshot.seo.description,
            keywords: baseSnapshot.seo.keywords,
          },
        },
        structure
      ),
    }));
  };

  const handleReset = (lang) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: createTranslationDrafts(faq, [{ value: lang }], structure)[lang],
    }));
  };

  const handleSave = async (lang) => {
    const draft = drafts[lang] || createEmptyDraft(structure);
    setSavingMap((prev) => ({ ...prev, [lang]: true }));
    setAlert(null);
    try {
      const payload = buildPayloadFromDraft(draft, structure);
      await faqApi.updateTranslations(payload, lang);
      const refreshed = await faqApi.get(baseLang);
      const nextFaq = refreshed?.faq || refreshed;
      setDrafts(
        createTranslationDrafts(nextFaq, langs, buildSectionsStructure(nextFaq))
      );
      setAlert({
        variant: "success",
        message: `${lang.toUpperCase()} çevirisi kaydedildi`,
      });
      await onUpdated?.(nextFaq);
    } catch (err) {
      setAlert({ variant: "danger", message: err?.message || "Kaydedilemedi" });
    } finally {
      setSavingMap((prev) => ({ ...prev, [lang]: false }));
    }
  };

  const panels = (langs || []).map(({ value, label }) => {
    const draft = drafts[value] || createEmptyDraft(structure);
    const saved = createTranslationDrafts(faq, [{ value }], structure)[value];
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

          {structure.map((section) => (
            <div
              key={section.key}
              className="space-y-3 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-surface-light)] p-3"
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                    Bölüm başlığı ({section.title})
                  </span>
                  <input
                    value={draft.sections?.[section.key]?.title ?? ""}
                    onChange={(event) =>
                      handleSectionChange(
                        value,
                        section.key,
                        "title",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                    Bölüm alt başlık
                  </span>
                  <input
                    value={draft.sections?.[section.key]?.subtitle ?? ""}
                    onChange={(event) =>
                      handleSectionChange(
                        value,
                        section.key,
                        "subtitle",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="space-y-3">
                {section.items.map((item) => (
                  <div
                    key={item.key}
                    className="space-y-2 rounded-lg border border-dashed border-[var(--color-border-admin)] p-3"
                  >
                    <p className="text-[11px] text-[var(--color-text-admin-muted)]">
                      Soru: {item.question || "(TR metni)"}
                    </p>
                    <input
                      value={
                        draft.sections?.[section.key]?.items?.[item.key]
                          ?.question ?? ""
                      }
                      onChange={(event) =>
                        handleItemChange(
                          value,
                          section.key,
                          item.key,
                          "question",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                      placeholder="Soru"
                    />
                    <textarea
                      rows={3}
                      value={
                        draft.sections?.[section.key]?.items?.[item.key]
                          ?.answer ?? ""
                      }
                      onChange={(event) =>
                        handleItemChange(
                          value,
                          section.key,
                          item.key,
                          "answer",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                      placeholder="Cevap"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

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
                SEO anahtar kelimeler ({KEYWORDS_SEPARATOR} ile ayırın)
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
      title="SSS çevirileri"
      description="Bölüm başlıkları ve soru-cevap içeriklerini diğer dillerde yönetin."
      loading={loading}
      error={error}
      emptyMessage={faq ? undefined : "SSS verisi bulunamadı."}
      alert={alert}
      onDismissAlert={() => setAlert(null)}
      panels={panels}
    />
  );
}
