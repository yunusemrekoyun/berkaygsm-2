import { useEffect, useMemo, useState } from "react";
import { shippingReturnsApi } from "../../../api/shippingReturns.js";
import TranslationModal from "../translations/TranslationModal.jsx";

const KEYWORDS_SEPARATOR = ", ";

const joinParagraphs = (arr = []) => arr.filter(Boolean).join("\n\n");
const splitParagraphs = (value = "") =>
  value
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);

const joinLines = (arr = []) => arr.filter(Boolean).join("\n");
const splitLines = (value = "") =>
  value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

const keywordsToText = (arr = []) =>
  arr.filter(Boolean).join(KEYWORDS_SEPARATOR);
const textToKeywords = (value = "") =>
  value
       .split(/[,\n]+/)
    .map((token) => token.trim())
    .filter(Boolean);

const htmlToPlainText = (html = "") =>
  String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();

const convertTextToHtml = (raw = "") => {
  const escaped = String(raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withBreaks = escaped.replace(/\n/g, "<br>");
  const withMailLinks = withBreaks.replace(
    /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi,
    `<a href="mailto:$1" class="text-accent underline">$1</a>`
  );
  return withMailLinks.replace(
    /\b(https?:\/\/[^\s<]+|www\.[^\s<]+)\b/gi,
    (match) => {
      const href = match.startsWith("http") ? match : `https://${match}`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-accent underline">${match}</a>`;
    }
  );
};

const buildSectionsStructure = (page) => {
  const sections = Array.isArray(page?.sections) ? page.sections : [];
  return sections.map((section, index) => ({
    index,
    title: section?.title ?? "",
    paragraphs: Array.isArray(section?.paragraphs)
      ? section.paragraphs.map((p) => String(p ?? ""))
      : [],
    listHeading: section?.list?.heading ?? "",
    listItems: Array.isArray(section?.list?.items)
      ? section.list.items.map((item) => String(item ?? ""))
      : [],
  }));
};

const createEmptyDraft = (structure = []) => ({
  heroTitle: "",
  heroSubtitle: "",
  sections: structure.map(() => ({
    title: "",
    paragraphs: [],
    listHeading: "",
    listItems: [],
  })),
  quickFacts: [],
  sidebarContact: {
    hoursText: "",
    note: "",
  },
  seo: {
    title: "",
    description: "",
    keywords: "",
  },
});

const createBaseSnapshot = (page, baseLang = "tr") => {
  const translations = page?.translations || {};
  const trSnapshot = translations[baseLang] || {};
  const structure = buildSectionsStructure(page);
  const mergedSections = structure.map((baseSection, index) => {
    const localized = Array.isArray(trSnapshot.sections)
      ? trSnapshot.sections[index]
      : null;
    return {
      title: localized?.title || baseSection.title || "",
      paragraphs: localized?.paragraphs?.length
        ? localized.paragraphs
        : baseSection.paragraphs || [],
      listHeading: localized?.list?.heading || baseSection.listHeading || "",
      listItems: localized?.list?.items?.length
        ? localized.list.items
        : baseSection.listItems || [],
    };
  });

  const baseQuickFacts = Array.isArray(page?.quickFacts)
    ? page.quickFacts
    : Array.isArray(page?.sidebar?.quickFacts)
    ? page.sidebar.quickFacts
    : [];

  return {
    heroTitle: trSnapshot.heroTitle ?? page?.heroTitle ?? "",
    heroSubtitle: trSnapshot.heroSubtitle ?? page?.heroSubtitle ?? "",
    sections: mergedSections,
    quickFacts: Array.isArray(trSnapshot.quickFacts) && trSnapshot.quickFacts.length
      ? trSnapshot.quickFacts
      : baseQuickFacts,
    sidebarContact: {
      hoursText:
        trSnapshot.sidebarContact?.hoursText ??
        page?.sidebarContact?.hoursText ??
        "",
      note: htmlToPlainText(
        trSnapshot.sidebarContact?.note ||
          trSnapshot.sidebar?.helpBoxHtml ||
          page?.sidebar?.helpBoxHtml ||
          ""
      ),
    },
    seo: {
      title: trSnapshot.seo?.title ?? page?.seo?.title ?? "",
      description: trSnapshot.seo?.description ?? page?.seo?.description ?? "",
      keywords: trSnapshot.seo?.keywords?.length
        ? trSnapshot.seo.keywords
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
      heroSubtitle: bucket.heroSubtitle ?? "",
      sections: structure.map((section, index) => {
        const tSection = Array.isArray(bucket.sections)
          ? bucket.sections[index]
          : null;
        return {
          title: tSection?.title ?? "",
          paragraphs: Array.isArray(tSection?.paragraphs)
            ? tSection.paragraphs.map((p) => String(p ?? ""))
            : [],
          listHeading: tSection?.list?.heading ?? "",
          listItems: Array.isArray(tSection?.list?.items)
            ? tSection.list.items.map((item) => String(item ?? ""))
            : [],
        };
      }),
      quickFacts: Array.isArray(bucket.quickFacts)
        ? bucket.quickFacts.map((item) => String(item ?? ""))
        : [],
      sidebarContact: {
        hoursText: bucket.sidebarContact?.hoursText ?? "",
        note: htmlToPlainText(
          bucket.sidebarContact?.note ?? bucket.sidebar?.helpBoxHtml ?? ""
        ),
      },
      seo: {
        title: bucket.seo?.title ?? "",
        description: bucket.seo?.description ?? "",
        keywords: keywordsToText(bucket.seo?.keywords || []),
      },
    };
  });
  return drafts;
};

export default function ShippingReturnsTranslationModal({
  open,
  loading,
  error,
  page,
  baseLang = "tr",
  langs = [],
  onClose,
  onUpdated,
}) {
  const structure = useMemo(() => buildSectionsStructure(page), [page]);
  const baseSnapshot = useMemo(
    () => createBaseSnapshot(page, baseLang),
    [page, baseLang]
  );
  const [drafts, setDrafts] = useState(() =>
    createTranslationDrafts(page, langs, structure)
  );
  const [savingMap, setSavingMap] = useState({});
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const nextDrafts = createTranslationDrafts(page, langs, structure);
    setDrafts(nextDrafts);
    setSavingMap({});
    setAlert(null);
  }, [page, langs, structure]);

  const handleFieldChange = (lang, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: {
        ...(prev[lang] || createEmptyDraft(structure)),
        [field]: value,
      },
    }));
  };

  const handleSectionFieldChange = (lang, index, field, value) => {
    setDrafts((prev) => {
      const existing = prev[lang] || createEmptyDraft(structure);
      const sections = existing.sections || createEmptyDraft(structure).sections;
      const next = sections.map((section, idx) =>
        idx === index ? { ...section, [field]: value } : section
      );
      return {
        ...prev,
        [lang]: { ...existing, sections: next },
      };
    });
  };

  const handleSectionListChange = (lang, index, field, value) => {
    const mapper =
      field === "paragraphs" ? splitParagraphs : (val) => splitLines(val);
    handleSectionFieldChange(lang, index, field, mapper(value));
  };

  const handleCopyFromBase = (lang) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: {
        heroTitle: baseSnapshot.heroTitle,
        heroSubtitle: baseSnapshot.heroSubtitle,
        sections: baseSnapshot.sections.map((section) => ({
          title: section.title,
          paragraphs: section.paragraphs,
          listHeading: section.listHeading,
          listItems: section.listItems,
        })),
        quickFacts: [...baseSnapshot.quickFacts],
        sidebarContact: {
          hoursText: baseSnapshot.sidebarContact.hoursText,
          note: baseSnapshot.sidebarContact.note,
        },
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
      [lang]: createTranslationDrafts(page, [{ value: lang }], structure)[lang],
    }));
  };

  const handleSave = async (lang) => {
    const draft = drafts[lang] || createEmptyDraft(structure);
    setSavingMap((prev) => ({ ...prev, [lang]: true }));
    setAlert(null);
    try {
      const payload = {
        heroTitle: (draft.heroTitle ?? "").trim(),
        heroSubtitle: draft.heroSubtitle ?? "",
        // eslint-disable-next-line no-unused-vars
        sections: draft.sections.map((section, index) => ({
          title: (section.title ?? "").trim(),
          paragraphs: section.paragraphs || [],
          list: {
            heading: section.listHeading ?? "",
            items: section.listItems || [],
          },
        })),
        quickFacts: draft.quickFacts || [],
        sidebarContact: {
          hoursText: draft.sidebarContact?.hoursText ?? "",
          note: convertTextToHtml(draft.sidebarContact?.note ?? ""),
        },
        seo: {
          title: draft.seo?.title ?? "",
          description: draft.seo?.description ?? "",
          keywords: textToKeywords(draft.seo?.keywords ?? ""),
        },
      };

      await shippingReturnsApi.updateTranslations(payload, lang);
      const refreshed = await shippingReturnsApi.get(baseLang);
      const nextPage = refreshed?.page || refreshed;
      setDrafts(
        createTranslationDrafts(nextPage, langs, buildSectionsStructure(nextPage))
      );
      setAlert({
        variant: "success",
        message: `${lang.toUpperCase()} çevirisi kaydedildi`,
      });
      await onUpdated?.(nextPage);
    } catch (err) {
      setAlert({ variant: "danger", message: err?.message || "Kaydedilemedi" });
    } finally {
      setSavingMap((prev) => ({ ...prev, [lang]: false }));
    }
  };

  const panels = (langs || []).map(({ value, label }) => {
    const draft = drafts[value] || createEmptyDraft(structure);
    const saved = createTranslationDrafts(page, [{ value }], structure)[value];
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
              Hero alt başlık
            </span>
            <textarea
              rows={3}
              value={draft.heroSubtitle}
              onChange={(event) =>
                handleFieldChange(value, "heroSubtitle", event.target.value)
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
                    handleSectionFieldChange(value, index, "title", event.target.value)
                  }
                  className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                  Paragraflar (iki satır arası boşluk yeni paragraf)
                </span>
                <textarea
                  rows={4}
                  value={joinParagraphs(section.paragraphs)}
                  onChange={(event) =>
                    handleSectionListChange(value, index, "paragraphs", event.target.value)
                  }
                  className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm font-mono"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                  Liste başlığı
                </span>
                <input
                  value={section.listHeading}
                  onChange={(event) =>
                    handleSectionFieldChange(value, index, "listHeading", event.target.value)
                  }
                  className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                  Liste maddeleri (her satır bir madde)
                </span>
                <textarea
                  rows={3}
                  value={joinLines(section.listItems)}
                  onChange={(event) =>
                    handleSectionListChange(value, index, "listItems", event.target.value)
                  }
                  className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm font-mono"
                />
              </label>
            </div>
          ))}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Hızlı notlar (her satır bir madde)
            </span>
            <textarea
              rows={3}
              value={joinLines(draft.quickFacts)}
              onChange={(event) =>
                handleFieldChange(value, "quickFacts", splitLines(event.target.value))
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm font-mono"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                Yan panel - çalışma saatleri metni
              </span>
              <textarea
                rows={3}
                value={draft.sidebarContact.hoursText}
                onChange={(event) =>
                  handleFieldChange(value, "sidebarContact", {
                    ...(draft.sidebarContact || {}),
                    hoursText: event.target.value,
                  })
                }
                className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                Yan panel notu (düz metin)
              </span>
              <textarea
                rows={3}
                value={draft.sidebarContact.note}
                onChange={(event) =>
                  handleFieldChange(value, "sidebarContact", {
                    ...(draft.sidebarContact || {}),
                    note: event.target.value,
                  })
                }
                className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
              />
            </label>
          </div>

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
      title="Kargo & İade çevirileri"
      description="Hero, bölümler, hızlı bilgiler ve SEO içeriklerini diller bazında yönetin."
      loading={loading}
      error={error}
      emptyMessage={page ? undefined : "Sayfa verisi bulunamadı."}
      alert={alert}
      onDismissAlert={() => setAlert(null)}
      panels={panels}
    />
  );
}
