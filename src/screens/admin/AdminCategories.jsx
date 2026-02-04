import { useEffect, useMemo, useState } from "react";
import { categoryApi } from "../../api/categories";
import CategoryTree from "../../components/admin/categories/CategoryTree";
import CategoryForm from "../../components/admin/categories/CategoryForm";
import AlertBanner from "../../components/ui/AlertBanner.jsx";
import LoadingOverlay from "../../components/ui/LoadingOverlay.jsx";
import { useConfirm } from "../../components/ui/ConfirmDialog.jsx";
import {
  collectDescendantIds,
  flattenCategoryTree,
} from "../../utils/catalog.js";
import { HAS_TRANSLATIONS, TRANSLATION_LANGS } from "../../constants/lang.js";

const BASE_LANG = "tr";

function createTranslationDrafts(category) {
  const drafts = {};
  TRANSLATION_LANGS.forEach(({ value }) => {
    drafts[value] = {
      name: category?.translations?.[value]?.name ?? "",
    };
  });
  return drafts;
}

function normalizeId(value) {
  if (value == null) return null;
  return String(value);
}

function normalizeCategory(category) {
  if (!category) return category;
  return {
    ...category,
    id: normalizeId(category.id),
    parent: normalizeId(category.parent),
    ancestors: Array.isArray(category.ancestors)
      ? category.ancestors.map(normalizeId)
      : [],
  };
}

export default function AdminCategories() {
  const confirm = useConfirm();
  const [tree, setTree] = useState([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [banner, setBanner] = useState(null);
  const [translationDrafts, setTranslationDrafts] = useState(
    createTranslationDrafts(null)
  );
  const [translationSaving, setTranslationSaving] = useState({});

  useEffect(() => {
    refreshTree(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parentOptions = useMemo(() => {
    const flat = flattenCategoryTree(tree);
    const disabledSet = new Set();

    if (selectedCategory?.id) {
      disabledSet.add(selectedCategory.id);
      collectDescendantIds(tree, selectedCategory.id).forEach((id) =>
        disabledSet.add(id)
      );
    }

    return flat.map((item) => ({
      id: item.id,
      label: item.name,
      level: item.level,
      disabled:
        item.node.level >= 2 ||
        (selectedCategory ? disabledSet.has(item.id) : false),
    }));
  }, [tree, selectedCategory]);

  const handleTranslationInput = (lang, value) => {
    setTranslationDrafts((prev) => ({
      ...prev,
      [lang]: {
        ...(prev[lang] || {}),
        name: value,
      },
    }));
  };

  const handleTranslationSave = async (lang) => {
    if (!selectedCategory?.id) return;
    setTranslationSaving((prev) => ({ ...prev, [lang]: true }));
    try {
      const payload = {
        name: (translationDrafts[lang]?.name ?? "").trim(),
      };
      const updated = await categoryApi.update(
        selectedCategory.id,
        payload,
        lang
      );
      const normalized = normalizeCategory(updated);
      setSelectedCategory(normalized);
      setTranslationDrafts(createTranslationDrafts(normalized));
      setBanner({
        variant: "success",
        message: `${lang.toUpperCase()} çevirisi kaydedildi`,
      });
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    } finally {
      setTranslationSaving((prev) => ({ ...prev, [lang]: false }));
    }
  };

  const handleSelect = async (node, lang = BASE_LANG) => {
    if (!node?.id) return;
    setSelectedId(node.id);
    setLoadingCategory(true);
    try {
      const detail = await categoryApi.get(node.id, lang);
      const normalized = normalizeCategory(detail);
      setSelectedCategory(normalized);
      setTranslationDrafts(createTranslationDrafts(normalized));
      setTranslationSaving({});
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
      setSelectedCategory(null);
      setTranslationDrafts(createTranslationDrafts(null));
      setTranslationSaving({});
    } finally {
      setLoadingCategory(false);
    }
  };

  const refreshTree = async (nextSelectId, lang = BASE_LANG) => {
    setLoadingTree(true);
    try {
      const data = await categoryApi.tree(lang);
      setTree(data);
      if (nextSelectId) {
        await handleSelect({ id: nextSelectId }, lang);
      }
      return data;
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
      return [];
    } finally {
      setLoadingTree(false);
    }
  };

  const handleSubmit = async (payload) => {
    setSaving(true);
    try {
      if (selectedCategory?.id) {
        const updated = await categoryApi.update(
          selectedCategory.id,
          payload,
          BASE_LANG
        );
        setBanner({ variant: "success", message: "Kategori güncellendi" });
        let resolved = updated;
        if (!resolved) {
          resolved = await categoryApi.get(selectedCategory.id, BASE_LANG);
        }
        if (resolved) {
          const normalized = normalizeCategory(resolved);
          setSelectedCategory(normalized);
          setTranslationDrafts(createTranslationDrafts(normalized));
          setTranslationSaving({});
        }
        await refreshTree(selectedCategory.id, BASE_LANG);
      } else {
        const created = await categoryApi.create(payload, BASE_LANG);
        setBanner({ variant: "success", message: "Kategori oluşturuldu" });
        if (created) {
          const normalized = normalizeCategory(created);
          setSelectedCategory(normalized);
          setSelectedId(normalized.id);
          setTranslationDrafts(createTranslationDrafts(normalized));
          setTranslationSaving({});
          await refreshTree(created.id, BASE_LANG);
        } else {
          const parentKey = payload.parent ? payload.parent : "root";
          const siblings = await categoryApi
            .list({ parent: parentKey }, BASE_LANG)
            .catch(() => []);
          const match = siblings.find(
            (item) =>
              String(item?.name || "").trim().toLowerCase() ===
              String(payload?.name || "").trim().toLowerCase()
          );
          if (match) {
            const normalized = normalizeCategory(match);
            setSelectedCategory(normalized);
            setSelectedId(normalized.id);
            setTranslationDrafts(createTranslationDrafts(normalized));
            setTranslationSaving({});
            await refreshTree(normalized.id, BASE_LANG);
          } else {
            await refreshTree(undefined, BASE_LANG);
          }
        }
      }
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory?.id) return;

    console.log("handleDelete selectedCategory:", selectedCategory);
    console.log(
      "handleDelete selectedCategory.id:",
      selectedCategory.id,
      "type=",
      typeof selectedCategory.id
    );

    const ok = await confirm({
      title: "Kategoriyi sil",
      description: `“${selectedCategory.name}” kategorisini silmek kalıcıdır. Devam edilsin mi?`,
      confirmText: "Sil",
      tone: "danger",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await categoryApi.remove(selectedCategory.id);
      setBanner({ variant: "warning", message: "Kategori silindi" });
      setSelectedCategory(null);
      setSelectedId(null);
      setTranslationDrafts(createTranslationDrafts(null));
      setTranslationSaving({});
      await refreshTree(undefined, BASE_LANG);
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--color-text-admin)]">
          Kategoriler
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
          Üç seviyeli katalog ağacını ve isteğe bağlı küçük görselleri yönetin.
        </p>
      </header>

      {banner && (
        <AlertBanner
          variant={banner.variant}
          message={banner.message}
          onClose={() => setBanner(null)}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="relative xl:col-span-4">
          <LoadingOverlay show={loadingTree} />
          <CategoryTree
            items={tree}
            selectedId={selectedId}
            onSelect={handleSelect}
            onCreateRoot={() => {
              setSelectedCategory(null);
              setSelectedId(null);
              setTranslationDrafts(createTranslationDrafts(null));
              setTranslationSaving({});
            }}
          />
        </div>
        <div className="relative xl:col-span-8">
          <LoadingOverlay
            show={saving || (loadingCategory && Boolean(selectedId))}
          />
          <CategoryForm
            category={selectedCategory}
            parentOptions={parentOptions}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            submitting={saving}
            loading={loadingCategory && Boolean(selectedId)}
            onCancelEdit={() => {
              setSelectedCategory(null);
              setSelectedId(null);
              setTranslationDrafts(createTranslationDrafts(null));
              setTranslationSaving({});
            }}
          />
          {HAS_TRANSLATIONS && selectedCategory?.id && (
            <TranslationEditors
              category={selectedCategory}
              drafts={translationDrafts}
              onChange={handleTranslationInput}
              onSave={handleTranslationSave}
              savingMap={translationSaving}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function TranslationEditors({ category, drafts, onChange, onSave, savingMap }) {
  if (!HAS_TRANSLATIONS) return null;
  const fallbackName = category?.name ?? "";
  const translations = category?.translations ?? {};
  const [openStates, setOpenStates] = useState(() => {
    const initial = {};
    TRANSLATION_LANGS.forEach(({ value }) => {
      initial[value] = false;
    });
    return initial;
  });

  useEffect(() => {
    const reset = {};
    TRANSLATION_LANGS.forEach(({ value }) => {
      reset[value] = false;
    });
    setOpenStates(reset);
  }, [category?.id]);

  const toggle = (lang) => {
    setOpenStates((prev) => ({ ...prev, [lang]: !prev[lang] }));
  };

  return (
    <section className="mt-6 space-y-4">
      <header>
        <h4 className="text-lg font-semibold text-[var(--color-text-admin)]">
          Çeviri Varyantları
        </h4>
        <p className="text-sm text-[var(--color-text-admin-muted)]">
          Ana kategori oluşturulduktan sonra her dil için ayrı metin
          kaydedebilirsiniz. Varyant açık değilse müşteriler Türkçe metni görür.
        </p>
      </header>

      <div className="space-y-4">
        {TRANSLATION_LANGS.map(({ value, label }) => {
          const draftValue = drafts?.[value]?.name ?? "";
          const savedValue = translations?.[value]?.name ?? "";
          const isDirty = draftValue !== savedValue;
          const isSaving = Boolean(savingMap?.[value]);
          const isOpen = openStates[value];

          return (
            <div
              key={value}
              className="rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-admin)] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-admin)]">
                    {label}
                  </p>
                  <p className="text-xs text-[var(--color-text-admin-muted)]">
                    Kaydedilen: {savedValue || "Türkçe metin kullanılıyor"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
                    onClick={() => toggle(value)}
                  >
                    {isOpen ? "Kapat" : "Çeviri düzenle"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
                    onClick={() => {
                      onChange(value, fallbackName);
                      setOpenStates((prev) => ({ ...prev, [value]: true }));
                    }}
                  >
                    TR'den kopyala
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="space-y-4 px-4 py-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-[var(--color-text-admin-muted)]">
                      Kategori adı ({label})
                    </span>
                    <input
                      value={draftValue}
                      onChange={(event) => onChange(value, event.target.value)}
                      maxLength={120}
                      className="w-full rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-admin)] outline-none focus:border-[var(--color-text-admin)]"
                      placeholder="örn. Lingerie"
                    />
                  </label>

                  <div className="flex items-center justify-between text-xs text-[var(--color-text-admin-muted)]">
                    <span>Varsayılan (TR): {fallbackName || "—"}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onChange(value, savedValue ?? "")}
                        className="rounded-full border border-[var(--color-border-admin)] px-3 py-1 text-xs font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
                        disabled={!isDirty}
                      >
                        Geri al
                      </button>
                      <button
                        type="button"
                        onClick={() => onSave(value)}
                        className="rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
                        disabled={!isDirty || isSaving}
                      >
                        {isSaving ? "Kaydediliyor" : "Kaydet"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function extractMessage(error) {
  if (!error) return "Beklenmeyen hata";
  if (error instanceof Error) {
    const message = error.message || "";
    const trimmed = message.trim();
    const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
    if (looksJson) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.message) return parsed.message;
      } catch {
        /* ignore */
      }
    }
    return message || "Beklenmeyen hata";
  }
  return String(error);
}
