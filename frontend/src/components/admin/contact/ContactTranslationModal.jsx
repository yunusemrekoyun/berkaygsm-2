import { useEffect, useMemo, useState } from "react";
import { contactPageApi } from "../../../api/contact.js";
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

const BLOCKS = [
  { key: "addressBlock", label: "Adres Bloğu" },
  { key: "hoursBlock", label: "Çalışma Saatleri Bloğu" },
  { key: "emailBlock", label: "E-posta Bloğu" },
  { key: "phoneBlock", label: "Telefon Bloğu" },
];

const arrayToText = (lines = []) =>
  Array.isArray(lines)
    ? lines
        .map((line) => String(line ?? "").trim())
        .filter(Boolean)
        .join("\n")
    : "";

const textToArray = (value) =>
  String(value || "")
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

const emptyBlocks = () =>
  BLOCKS.reduce((acc, { key }) => {
    acc[key] = { title: "", lines: "" };
    return acc;
  }, {});

const EMPTY_DRAFT = {
  heroTitle: "",
  heroSubtitle: "",
  successMessage: "",
  blocks: emptyBlocks(),
};

function createBaseDraft(contact) {
  if (!contact) return null;
  const draft = {
    heroTitle: contact.heroTitle ?? "",
    heroSubtitle: contact.heroSubtitle ?? "",
    successMessage: contact.successMessage ?? "",
    blocks: emptyBlocks(),
  };  
  BLOCKS.forEach(({ key }) => {
    const baseBlock = contact[key] || {};
    draft.blocks[key] = {
      title: baseBlock.title ?? "",
      lines: arrayToText(baseBlock.lines),
    };
  });
  return draft;
}

function createTranslationDrafts(contact, langs = []) {
  const drafts = {};
  langs.forEach(({ value }) => {
    drafts[value] = {
      ...EMPTY_DRAFT,
      blocks: emptyBlocks(),
    };
  });

  if (!contact) return drafts;
  langs.forEach(({ value }) => {
    const translation = contact.translations?.[value] || {};
    drafts[value] = {
      heroTitle: translation.heroTitle ?? "",
      heroSubtitle: translation.heroSubtitle ?? "",
      successMessage: translation.successMessage ?? "",
      blocks: BLOCKS.reduce((acc, { key }) => {
        const block = translation[key] || {};
        acc[key] = {
          title: block.title ?? "",
          lines: arrayToText(block.lines),
        };
        return acc;
      }, {}),
    };
  });

  return drafts;
}

export default function ContactTranslationModal({
  open,
  loading,
  error,
  contact,
  baseLang = "tr",
  langs = [],
  onClose,
  onUpdated,
}) {
  const [currentContact, setCurrentContact] = useState(contact);
  const [drafts, setDrafts] = useState(() =>
    createTranslationDrafts(contact, langs)
  );
  const [savingMap, setSavingMap] = useState({});
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    setCurrentContact(contact);
    setDrafts(createTranslationDrafts(contact, langs));
    setSavingMap({});
    setAlert(null);
  }, [contact, langs]);

  const baseDraft = useMemo(() => createBaseDraft(currentContact), [currentContact]);
  const savedDrafts = useMemo(
    () => createTranslationDrafts(currentContact, langs),
    [currentContact, langs]
  );

  const handleFieldChange = (lang, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: {
        ...(prev[lang] || { ...EMPTY_DRAFT, blocks: emptyBlocks() }),
        [field]: value,
      },
    }));
  };

  const handleBlockChange = (lang, blockKey, field, value) => {
    setDrafts((prev) => {
      const existing = prev[lang] || { ...EMPTY_DRAFT, blocks: emptyBlocks() };
      const block = existing.blocks?.[blockKey] || { title: "", lines: "" };
      return {
        ...prev,
        [lang]: {
          ...existing,
          blocks: {
            ...(existing.blocks || {}),
            [blockKey]: {
              ...block,
              [field]: value,
            },
          },
        },
      };
    });
  };

  const handleCopyFromBase = (lang) => {
    if (!baseDraft) return;
    setDrafts((prev) => ({
      ...prev,
      [lang]: {
        heroTitle: baseDraft.heroTitle,
        heroSubtitle: baseDraft.heroSubtitle,
        successMessage: baseDraft.successMessage,
        blocks: BLOCKS.reduce((acc, { key }) => {
          acc[key] = {
            title: baseDraft.blocks[key].title,
            lines: baseDraft.blocks[key].lines,
          };
          return acc;
        }, {}),
      },
    }));
  };

  const handleReset = (lang) => {
    setDrafts((prev) => ({
      ...prev,
      [lang]: savedDrafts[lang] || { ...EMPTY_DRAFT, blocks: emptyBlocks() },
    }));
  };

  const handleSave = async (lang) => {
    const draft = drafts[lang] || { ...EMPTY_DRAFT, blocks: emptyBlocks() };
    setSavingMap((prev) => ({ ...prev, [lang]: true }));
    setAlert(null);
    try {
      const blockPayload = (key) => ({
        title: (draft.blocks?.[key]?.title ?? "").trim(),
        lines: textToArray(draft.blocks?.[key]?.lines ?? ""),
      });

      const payload = {
        heroTitle: (draft.heroTitle ?? "").trim(),
        heroSubtitle: draft.heroSubtitle ?? "",
        successMessage: draft.successMessage ?? "",
        addressBlock: blockPayload("addressBlock"),
        hoursBlock: blockPayload("hoursBlock"),
        emailBlock: blockPayload("emailBlock"),
        phoneBlock: blockPayload("phoneBlock"),
      };

      await contactPageApi.updateTranslations(payload, lang);
      const refreshed = await contactPageApi.get(baseLang);
      const nextContact = refreshed?.contactConfig || refreshed;
      setCurrentContact(nextContact);
      setDrafts(createTranslationDrafts(nextContact, langs));
      setAlert({
        variant: "success",
        message: `${lang.toUpperCase()} çevirisi kaydedildi`,
      });
      await onUpdated?.(nextContact);
    } catch (err) {
      setAlert({ variant: "danger", message: extractMessage(err) });
    } finally {
      setSavingMap((prev) => ({ ...prev, [lang]: false }));
    }
  };

  const panels = (langs || []).map(({ value, label }) => {
    const draft = drafts[value] || { ...EMPTY_DRAFT, blocks: emptyBlocks() };
    const saved = savedDrafts[value] || { ...EMPTY_DRAFT, blocks: emptyBlocks() };
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

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
              Form başarı mesajı
            </span>
            <textarea
              rows={3}
              value={draft.successMessage}
              onChange={(event) =>
                handleFieldChange(value, "successMessage", event.target.value)
              }
              className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
            />
          </label>

          {BLOCKS.map(({ key, label: blockLabel }) => (
            <div key={key} className="space-y-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-surface-light)] p-3">
              <p className="text-xs font-semibold text-[var(--color-text-admin)]">
                {blockLabel}
              </p>
              <input
                value={draft.blocks?.[key]?.title ?? ""}
                onChange={(event) =>
                  handleBlockChange(value, key, "title", event.target.value)
                }
                className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm"
                placeholder="Başlık"
              />
              <textarea
                rows={3}
                value={draft.blocks?.[key]?.lines ?? ""}
                onChange={(event) =>
                  handleBlockChange(value, key, "lines", event.target.value)
                }
                className="w-full rounded-lg border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm font-mono"
                placeholder="Her satır bir madde"
              />
            </div>
          ))}
        </div>
      ),
    };
  });

  return (
    <TranslationModal
      open={open}
      onClose={onClose}
      title="İletişim sayfası çevirileri"
      description="Adres blokları, form mesajları ve CTA metinlerini her dil için güncelleyin."
      loading={loading}
      error={error}
      emptyMessage={currentContact ? undefined : "İletişim verisi bulunamadı."}
      alert={alert}
      onDismissAlert={() => setAlert(null)}
      panels={panels}
    />
  );
}
