/* eslint-disable no-useless-catch */
import { useEffect, useState } from "react";
import { PlusCircle, RefreshCw } from "lucide-react";
import { setApi } from "../../api/sets";
import { productApi } from "../../api/products";
import { categoryApi } from "../../api/categories";
import AlertBanner from "../../components/ui/AlertBanner.jsx";
import { useConfirm } from "../../components/ui/ConfirmDialog.jsx";
import SetTable from "../../components/admin/sets/SetTable";
import SetForm from "../../components/admin/sets/SetForm";
import SetTranslationModal from "../../components/admin/sets/SetTranslationModal.jsx";

const BASE_LANG = "tr";
const TRANSLATION_LANGS = [
  { value: "en", label: "English (EN)" },
  { value: "de", label: "Deutsch (DE)" },
];

function resolveSetIdentifier(setItem) {
  if (!setItem) return null;

  if (typeof setItem === "string" || typeof setItem === "number") {
    const trimmed = String(setItem).trim();
    return trimmed && trimmed !== "[object Object]" ? trimmed : null;
  }

  if (typeof setItem === "object") {
    if (typeof setItem.slug === "string" && setItem.slug.trim()) {
      return setItem.slug.trim();
    }

    let raw =
      setItem.id ??
      setItem._id ??
      setItem.setId ??
      (setItem.set &&
        (setItem.set.id ||
          setItem.set._id ||
          (typeof setItem.set.toHexString === "function"
            ? setItem.set.toHexString()
            : null)));

    if (!raw && typeof setItem.toHexString === "function") {
      raw = setItem.toHexString();
    }

    if (!raw && typeof setItem.toString === "function") {
      const asString = setItem.toString();
      if (asString && asString !== "[object Object]") raw = asString;
    }

    if (!raw) return null;

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      return trimmed && trimmed !== "[object Object]" ? trimmed : null;
    }

    if (typeof raw === "number") return String(raw);

    if (typeof raw === "object") {
      if (typeof raw._id === "string" && raw._id.trim()) return raw._id.trim();
      if (typeof raw.id === "string" && raw.id.trim()) return raw.id.trim();
      if (typeof raw.toHexString === "function") return raw.toHexString();
      if (
        typeof raw.toString === "function" &&
        raw.toString !== Object.prototype.toString
      ) {
        const str = raw.toString();
        if (str && str !== "[object Object]") return str;
      }
    }

    const fallback = String(raw).trim();
    return fallback && fallback !== "[object Object]" ? fallback : null;
  }

  try {
    const str = String(setItem).trim();
    return str && str !== "[object Object]" ? str : null;
  } catch {
    return null;
  }
}

export default function AdminSets() {
  const confirm = useConfirm();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banner, setBanner] = useState(null);
  const [translationState, setTranslationState] = useState({
    open: false,
    loading: false,
    set: null,
    error: null,
  });

  useEffect(() => {
    loadSets();
    loadProducts();
    loadCategories();
  }, []);

  const loadSets = async () => {
    setLoading(true);
    try {
      const data = await setApi.list({ includeHidden: true }, BASE_LANG);
      const normalized =
        (data || []).map((item) => {
          const identifier =
            resolveSetIdentifier(item) ||
            item?.id ||
            item?._id ||
            item?.slug ||
            null;
          if (!identifier || item?.id === identifier) {
            return { ...item };
          }
          return {
            ...item,
            id: identifier,
          };
        }) || [];
      setSets(normalized);
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await productApi.list(
        { limit: 200, includeHidden: true },
        BASE_LANG
      );
      setProducts(data.products || []);
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  };

  const loadCategories = async () => {
    try {
      const tree = await categoryApi.tree(BASE_LANG);
      const flat = flattenTree(tree);
      setCategories(flat);
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  };

  const handleCreate = () => {
    setEditingSet(null);
    setModalOpen(true);
  };

  const handleEdit = async (setItem) => {
    const identifier = resolveSetIdentifier(setItem);
    if (!identifier) {
      setBanner({
        variant: "danger",
        message: "Set kimliği okunamadı. Lütfen sayfayı yenileyin.",
      });
      return;
    }
    setModalOpen(true);
    setEditingSet(null);
    try {
      const detail = await setApi.get(identifier, BASE_LANG);
      setEditingSet(detail);
    } catch (error) {
      setModalOpen(false);
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  };

  const handleDelete = async (setItem) => {
    const ok = await confirm({
      title: "Seti sil",
      description: `“${setItem.name}” silinsin mi? Bu işlem geri alınamaz.`,
      confirmText: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    const identifier = resolveSetIdentifier(setItem);
    if (!identifier) {
      setBanner({
        variant: "danger",
        message: "Set kimliği okunamadı. Lütfen sayfayı yenileyin.",
      });
      return;
    }
    try {
      await setApi.remove(identifier);
      setBanner({ variant: "warning", message: "Set silindi" });
      setModalOpen(false);
      setEditingSet(null);
      await loadSets();
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  };

  const handleSubmit = async (payload) => {
    try {
      if (editingSet) {
        const identifier = resolveSetIdentifier(editingSet);
        if (!identifier) {
          throw new Error("Set kimliği okunamadı. Lütfen sayfayı yenileyin.");
        }
        await setApi.update(identifier, payload, BASE_LANG);
        setBanner({ variant: "success", message: "Set güncellendi" });
      } else {
        await setApi.create(payload, BASE_LANG);
        setBanner({ variant: "success", message: "Set oluşturuldu" });
      }
      setModalOpen(false);
      setEditingSet(null);
      await loadSets();
      await loadProducts();
    } catch (error) {
      throw error;
    }
  };

  const openTranslationModal = async (setItem) => {
    const identifier = resolveSetIdentifier(setItem);
    if (!identifier) {
      setTranslationState({
        open: true,
        loading: false,
        set: null,
        error: "Set kimliği okunamadı. Lütfen sayfayı yenileyin.",
      });
      return;
    }
    setTranslationState({
      open: true,
      loading: true,
      set: null,
      error: null,
    });
    try {
      const detail = await setApi.get(identifier, BASE_LANG);
      setTranslationState({
        open: true,
        loading: false,
        set: detail,
        error: null,
      });
    } catch (error) {
      setTranslationState({
        open: true,
        loading: false,
        set: null,
        error: extractMessage(error),
      });
    }
  };

  const closeTranslationModal = () => {
    setTranslationState({
      open: false,
      loading: false,
      set: null,
      error: null,
    });
  };

  const handleTranslationsUpdated = async () => {
    await loadSets();
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-admin)]">
            Setler
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
            Özel koleksiyonları sergilemek için paket ürünler oluşturup yönetin.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadSets()}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
          >
            <RefreshCw className="h-4 w-4" /> Yenile
          </button>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
            <PlusCircle className="h-5 w-5" /> Yeni set
          </button>
        </div>
      </header>

      {banner && (
        <AlertBanner
          variant={banner.variant}
          message={banner.message}
          onClose={() => setBanner(null)}
        />
      )}

      <SetTable
        sets={sets}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onTranslate={openTranslationModal}
      />

      <SetForm
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingSet(null);
        }}
        onSubmit={handleSubmit}
        onDelete={editingSet ? () => handleDelete(editingSet) : undefined}
        initialSet={editingSet}
        products={products}
        categories={categories}
        contentLang={BASE_LANG}
      />

      <SetTranslationModal
        open={translationState.open}
        loading={translationState.loading}
        error={translationState.error}
        setItem={translationState.set}
        baseLang={BASE_LANG}
        langs={TRANSLATION_LANGS}
        onClose={closeTranslationModal}
        onUpdated={handleTranslationsUpdated}
      />
    </section>
  );
}

function flattenTree(tree = [], path = []) {
  const result = [];
  tree.forEach((node) => {
    result.push({
      id: node.id,
      label: [...path, node.name].join(" / "),
    });
    if (node.children?.length) {
      result.push(...flattenTree(node.children, [...path, node.name]));
    }
  });
  return result;
}

function extractMessage(error) {
  if (!error) return "Beklenmeyen hata";
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return parsed.message;
    } catch (e) {
      console.error(e);
      /* ignore */
    }
    return error.message;
  }
  return String(error);
}
