import { useEffect, useMemo, useRef, useState } from "react";
import { PlusCircle, RefreshCw, Search, TrendingUp } from "lucide-react";
import { categoryApi } from "../../api/categories";
import { productApi } from "../../api/products";
import { stocksApi } from "../../api/stocks"; // ✅ yeni: stokları buradan okuyacağız
import ProductTable from "../../components/admin/products/ProductTable";
import ProductForm from "../../components/admin/products/ProductForm";
import ProductTranslationModal from "../../components/admin/products/ProductTranslationModal.jsx";
import BulkPriceModal from "../../components/admin/products/BulkPriceModal.jsx";
import { flattenCategoryTree } from "../../utils/catalog.js";
import AlertBanner from "../../components/ui/AlertBanner.jsx";
import { useConfirm } from "../../components/ui/ConfirmDialog.jsx";
import { buildProductState } from "../../components/admin/products/productTranslationUtils.js";
import { HAS_TRANSLATIONS, TRANSLATION_LANGS } from "../../constants/lang.js";

const BASE_LANG = "tr";

const bytesToHex = (data) => {
  if (!Array.isArray(data)) return "";
  if (data.length !== 12) return "";
  return data.map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const normalizeObjectIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^[0-9a-fA-F]{24}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/[0-9a-fA-F]{24}/);
    return match ? match[0] : "";
  }
  if (typeof value === "object") {
    if (typeof value.$oid === "string") return normalizeObjectIdString(value.$oid);
    if (typeof value.toHexString === "function") return value.toHexString();
    if (typeof value.id === "string") return normalizeObjectIdString(value.id);
    const bufferHex = bytesToHex(value?.id?.data || value?.data);
    if (bufferHex) return bufferHex;
  }
  return "";
};

const extractObjectId = (input) => {
  if (!input || typeof input !== "object") return "";
  const candidates = [
    input.id,
    input._id,
    input.productId,
    input?.product?.id,
    input?.product?._id,
    input?.$oid,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeObjectIdString(candidate);
    if (normalized) return normalized;
  }
  return "";
};

function resolveProductIdentifier(product) {
  if (!product) return null;

  if (typeof product.slug === "string" && product.slug.trim()) {
    return product.slug.trim();
  }

  let raw =
    product.id ??
    product._id ??
    product.productId ??
    (product.product &&
      (product.product.id ||
        product.product._id ||
        (typeof product.product.toHexString === "function"
          ? product.product.toHexString()
          : null)));

  if (!raw && typeof product.toHexString === "function") {
    raw = product.toHexString();
  }

  if (!raw && typeof product.toString === "function") {
    const asString = product.toString();
    if (asString && asString !== "[object Object]") {
      raw = asString;
    }
  }

  if (!raw) {
    const extracted = extractObjectId(product);
    return extracted || null;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed && trimmed !== "[object Object]" ? trimmed : null;
  }

  if (typeof raw === "number") {
    return String(raw);
  }

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
  if (fallback && fallback !== "[object Object]") {
    return fallback;
  }

  const extracted = extractObjectId(raw);
  return extracted || null;
}

const resolveProductObjectId = (input) => {
  if (!input || typeof input !== "object") return "";

  const candidates = [
    input.id,
    input._id,
    input.productId,
    input?.product?.id,
    input?.product?._id,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeObjectIdString(candidate);
    if (normalized) return normalized;
  }
  return extractObjectId(input) || "";
};

/**
 * Stok değişip değişmediğini kontrol eder.
 * originalInventory: handleEditProduct'ta DB'den yüklenen stok ({ color, size, attributeValue, stock })
 * stockLines: form submit'ten gelen stok ({ color, size, attributeValue, qtyOnHand })
 * Yalnızca stok miktarı veya varyant yapısı değişmişse true döner.
 */
function hasStockChanged(stockLines, originalInventory) {
  if (!Array.isArray(originalInventory)) return true;
  if (stockLines.length !== originalInventory.length) return true;

  const originalMap = new Map();
  originalInventory.forEach((item) => {
    const key = [item.color ?? "", item.size ?? "", item.attributeValue ?? ""].join("||");
    originalMap.set(key, Number(item.stock) || 0);
  });

  return stockLines.some((line) => {
    const key = [line.color ?? "", line.size ?? "", line.attributeValue ?? ""].join("||");
    const originalQty = originalMap.get(key);
    if (originalQty === undefined) return true;
    return originalQty !== (Number(line.qtyOnHand) || 0);
  });
}

const normalizeStockLines = (stockLines = []) => {
  if (!Array.isArray(stockLines)) return [];
  const map = new Map();
  stockLines.forEach((line) => {
    const key = [
      line?.color ?? "",
      line?.size ?? "",
      line?.attributeValue ?? "",
    ].join("||");
    if (map.has(key)) return;
    map.set(key, {
      color: line?.color ?? null,
      size: line?.size ?? null,
      attributeValue: line?.attributeValue ?? null,
      qtyOnHand: Number(line?.qtyOnHand) || 0,
      sku: line?.sku,
      note: line?.note,
      isActive: line?.isActive,
    });
  });
  return Array.from(map.values());
};

const syncProductStocks = async (ownerId, stockLines = []) => {
  if (!ownerId || !Array.isArray(stockLines)) {
    return { ok: true, count: 0, recovered: false };
  }

  const normalized = normalizeStockLines(stockLines);

  await stocksApi
    .replace({
      ownerModel: "Product",
      owner: ownerId,
      items: normalized,
    })
    .catch(() => null);

  const verify = await stocksApi
    .listByOwner("Product", ownerId)
    .catch(() => null);
  const existing = Array.isArray(verify?.items)
    ? verify.items
    : Array.isArray(verify?.stocks)
    ? verify.stocks
    : [];
  if (existing.length || normalized.length === 0) {
    return { ok: true, count: existing.length, recovered: false };
  }

  for (const line of normalized) {
    await stocksApi.upsert(
      stocksApi.helpers.forProduct({
        owner: ownerId,
        color: line.color,
        size: line.size,
        attributeValue: line.attributeValue,
        qtyOnHand: Number(line.qtyOnHand || 0),
        sku: line.sku || undefined,
        note: line.note || "",
        isActive: line.isActive !== false,
        mode: "set",
      })
    );
  }

  return { ok: true, count: normalized.length, recovered: true };
};

export default function AdminProducts() {
  const confirm = useConfirm();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);
  const [categoryTree, setCategoryTree] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebounce(searchValue, 400);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    limit: 20,
    total: 0,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const originalInventoryRef = useRef(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [translationState, setTranslationState] = useState({
    open: false,
    loading: false,
    product: null,
    error: null,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, categoryFilter, pagination.limit]);

  const categoryOptions = useMemo(() => {
    const flattened = flattenCategoryTree(categoryTree);
    return flattened.map((item) => ({
      id: item.id,
      label: item.path.join(" / "),
      level: item.level,
    }));
  }, [categoryTree]);

  const loadCategories = async () => {
    try {
      const data = await categoryApi.tree(BASE_LANG);
      setCategoryTree(data);
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    }
  };

  const removeProductFromList = (target) => {
    const targetId = resolveProductObjectId(target);
    const targetSlug =
      typeof target === "string" ? target : target?.slug || null;
    if (!targetId && !targetSlug) return;
    setProducts((prev) =>
      prev.filter((item) => {
        const itemId = resolveProductObjectId(item);
        if (targetId && itemId) return itemId !== targetId;
        if (targetSlug && item?.slug) return item.slug !== targetSlug;
        return true;
      })
    );
    setPagination((prev) => ({
      ...prev,
      total: Math.max(0, Number(prev.total || 0) - 1),
    }));
  };

  const loadProducts = async (page = 1) => {
    setLoading(true);
    try {
      const data = await productApi.list(
        {
          page,
          limit: pagination.limit,
          search: debouncedSearch,
          category: categoryFilter,
          includeHidden: true,
        },
        BASE_LANG
      );

      // Yeni backend ile shape farklılıklarını normalize et
      const normalized =
        (data.products || []).map((p) => {
          const safeId =
            resolveProductIdentifier(p) ||
            p.slug ||
            (p._id ? String(p._id) : null) ||
            null;
          return {
            id: safeId,
            name: p.name,
            slug: typeof p.slug === "string" ? p.slug : safeId,
            price: p.price,
            isActive: p.isActive,
            category: p.category || p.categoryId || null,
            images: p.images || p.media || [],
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            setsCount: Number(p.setsCount ?? p.setCount ?? 0) || 0,
          };
        }) || [];

      setProducts(normalized);
      setPagination(
        data.pagination || {
          page: 1,
          pages: 1,
          limit: 20,
          total: normalized.length,
        }
      );
    } catch (error) {
      setBanner({ variant: "danger", message: extractMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClick = () => {
    originalInventoryRef.current = null;
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleEditProduct = async (product) => {
    try {
      const identifier = resolveProductIdentifier(product);
      if (!identifier) {
        setBanner({
          variant: "danger",
          message: "Ürün kimliği okunamadı. Lütfen sayfayı yenileyin.",
        });
        return;
      }
      const full = await productApi.get(identifier, BASE_LANG, {
        auth: true,
      });

      // ✅ stokları StockItem tablosundan çek
      const ownerId =
        resolveProductObjectId(full) || resolveProductObjectId(product);
      const stockRes = ownerId
        ? await stocksApi.listByOwner("Product", ownerId)
        : { items: [] };
      const inventory = (stockRes.items || []).map((it) => ({
        color: it.color ?? null,
        size: it.size ?? null,
        attributeValue: it.attributeValue ?? null,
        stock: Number(it.qtyOnHand) || 0,
      }));

      const normalized = buildProductState(full, inventory);
      originalInventoryRef.current = inventory;
      setEditingProduct(normalized);
      setModalOpen(true);
    } catch (err) {
      console.error("Product load failed:", err);
      setBanner({ variant: "danger", message: extractMessage(err) });
    }
  };

  const handleDeleteProduct = async (product) => {
    const ok = await confirm({
      title: "Ürünü sil",
      description: `“${product.name}” silinsin mi? Bu işlem geri alınamaz.`,
      confirmText: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const identifier = resolveProductIdentifier(product);
      if (!identifier) {
        setBanner({
          variant: "danger",
          message: "Ürün kimliği okunamadı. Lütfen sayfayı yenileyin.",
        });
        return;
      }
      await productApi.remove(identifier);
      removeProductFromList(product);
      setBanner({ variant: "success", message: "Ürün silindi" });
      await loadProducts(pagination.page);
    } catch (error) {
      const payload = parseErrorPayload(error);
      if (payload?.requiresResolution && Array.isArray(payload.sets)) {
        setDeleteDialog({
          product,
          sets: payload.sets,
          loading: false,
        });
        return;
      }
      setBanner({
        variant: "danger",
        message: payload?.message || extractMessage(error),
      });
    }
  };

  const handleResolveDelete = async (action) => {
    if (!deleteDialog) return;
    if (action === "cancel") {
      setDeleteDialog(null);
      return;
    }

    const actionParam = action === "delete_sets" ? "delete_sets" : "detach";
    setDeleteDialog((prev) => ({ ...prev, loading: true }));

    try {
      const identifier = resolveProductIdentifier(deleteDialog.product);
      if (!identifier) {
        setBanner({
          variant: "danger",
          message: "Ürün kimliği okunamadı. Lütfen sayfayı yenileyin.",
        });
        setDeleteDialog(null);
        return;
      }
      await productApi.remove(identifier, {
        setAction: actionParam,
      });
      removeProductFromList(deleteDialog.product);
      setDeleteDialog(null);
      setBanner({
        variant: "success",
        message:
          actionParam === "delete_sets"
            ? "Ürün ve bağlı setler silindi"
            : "Ürün setlerden kaldırıldı ve silindi",
      });
      await loadProducts(pagination.page);
    } catch (error) {
      const payload = parseErrorPayload(error);
      setBanner({
        variant: "danger",
        message: payload?.message || extractMessage(error),
      });
      setDeleteDialog(null);
    }
  };

  const openTranslationModal = async (product) => {
    const identifier = resolveProductIdentifier(product);
    if (!identifier) {
      setTranslationState({
        open: true,
        loading: false,
        product: null,
        error: "Ürün kimliği okunamadı. Lütfen sayfayı yenileyin.",
      });
      return;
    }
    setTranslationState({
      open: true,
      loading: true,
      product: null,
      error: null,
    });
    try {
      const detail = await productApi.get(identifier, BASE_LANG, {
        auth: true,
      });
      const normalized = buildProductState(detail, detail?.inventory || []);
      setTranslationState({
        open: true,
        loading: false,
        product: normalized,
        error: null,
      });
    } catch (error) {
      setTranslationState({
        open: true,
        loading: false,
        product: null,
        error: extractMessage(error),
      });
    }
  };

  const closeTranslationModal = () => {
    setTranslationState({
      open: false,
      loading: false,
      product: null,
      error: null,
    });
  };

  const handleTranslationsUpdated = async () => {
    await loadProducts(pagination.page);
  };

  const handleSaveProduct = async ({
    productPayload,
    stockLines,
    stockDirty = false,
  }) => {
    // Stok sadece syncProductStocks üzerinden yazılır (stocksApi.replace → low-stock notification tetikler)
    const payloadWithStocks = { ...productPayload };
    let stockWarning = null;
    if (editingProduct) {
      const identifier = resolveProductIdentifier(editingProduct);
      if (!identifier) {
        setBanner({
          variant: "danger",
          message: "Ürün kimliği okunamadı. Lütfen sayfayı yenileyin.",
        });
        return;
      }

      const updated = await productApi.update(
        identifier,
        payloadWithStocks,
        BASE_LANG
      );
      if (
        stockDirty &&
        Array.isArray(stockLines) &&
        hasStockChanged(stockLines, originalInventoryRef.current)
      ) {
        const ownerId =
          resolveProductObjectId(updated) ||
          resolveProductObjectId(editingProduct) ||
          null;
        if (ownerId) {
          try {
            await syncProductStocks(ownerId, stockLines);
            originalInventoryRef.current = stockLines.map((l) => ({
              color: l.color ?? null,
              size: l.size ?? null,
              attributeValue: l.attributeValue ?? null,
              stock: Number(l.qtyOnHand) || 0,
            }));
          } catch (err) {
            stockWarning =
              extractMessage(err) ||
              "Stok detayları kaydedilemedi. Lütfen tekrar deneyin.";
          }
        }
      }
      if (stockWarning) {
        setBanner({ variant: "warning", message: stockWarning });
      } else {
        setBanner({ variant: "success", message: "Ürün güncellendi" });
      }
      await loadProducts(pagination.page);
      setModalOpen(false);
      setEditingProduct(null);
    } else {
      const created = await productApi.create(payloadWithStocks, BASE_LANG);
      let resolvedCreated = created;

      if (!resolvedCreated && productPayload?.name) {
        const searchName = String(productPayload.name).trim();
        if (searchName) {
          const list = await productApi
            .list(
              {
                search: searchName,
                includeHidden: true,
                limit: 5,
                page: 1,
              },
              BASE_LANG
            )
            .catch(() => null);
          const candidates = list?.products || [];
          const normalizedSearch = searchName.toLowerCase();
          const exactMatch = candidates.find(
            (item) =>
              String(item?.name || "").trim().toLowerCase() === normalizedSearch
          );
          resolvedCreated = exactMatch || candidates[0] || null;
        }
      }

      // ✅ Cevap şekline göre ID yakala (çeşitli backend varyantlarına dayanıklı)
      const newId =
        resolveProductObjectId(resolvedCreated) ||
        resolveProductObjectId(resolvedCreated?.product) ||
        null;

      let ownerId = newId;
      if (!ownerId) {
        const slug =
          resolvedCreated?.slug ||
          resolvedCreated?.product?.slug ||
          resolvedCreated?.data?.slug ||
          null;
        if (slug) {
          const full = await productApi.get(slug, BASE_LANG, {
            auth: true,
          });
          ownerId = resolveProductObjectId(full);
        }
      }

      if (!ownerId) {
        const recentList = await productApi
          .list({ includeHidden: true, limit: 10, page: 1 }, BASE_LANG)
          .catch(() => null);
        const recentProducts = recentList?.products || [];
        const normalizedSearch = productPayload?.name
          ? String(productPayload.name).trim().toLowerCase()
          : "";

        const byName = normalizedSearch
          ? recentProducts.find(
              (item) =>
                String(item?.name || "").trim().toLowerCase() ===
                normalizedSearch
            )
          : null;

        const createdAtThreshold = Date.now() - 2 * 60 * 1000;
        const byRecent = recentProducts.find((item) => {
          const createdAt = item?.createdAt
            ? Date.parse(item.createdAt)
            : NaN;
          return Number.isFinite(createdAt) && createdAt >= createdAtThreshold;
        });

        const fallback = byName || byRecent || recentProducts[0] || null;
        ownerId = resolveProductObjectId(fallback);
      }

      if (Array.isArray(stockLines)) {
        if (ownerId) {
          try {
            const stockResult = await syncProductStocks(ownerId, stockLines);
            if (!stockResult?.count) {
              stockWarning =
                "Ürün oluşturuldu ancak stok detayları doğrulanamadı.";
            }
          } catch (err) {
            stockWarning =
              extractMessage(err) ||
              "Ürün oluşturuldu ancak stok detayları kaydedilemedi.";
          }
        } else {
          stockWarning =
            "Ürün oluşturuldu ancak stok için ürün kimliği alınamadı.";
        }
      }
      if (stockWarning) {
        setBanner({ variant: "warning", message: stockWarning });
      } else {
        setBanner({ variant: "success", message: "Ürün oluşturuldu" });
      }
      await loadProducts(1);
      setModalOpen(false);
      setEditingProduct(null);
    }
  };

  const goToPage = (page) => {
    if (page < 1 || page > pagination.pages) return;
    loadProducts(page);
  };

  return (
    <section className="space-y-6">
      <header className="flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-admin)]">
            Ürünler
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
            Mağaza kataloğundaki ürünleri ekleyin, düzenleyin ve yönetin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => loadProducts(pagination.page)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
          >
            <RefreshCw className="h-4 w-4" /> Yenile
          </button>
          <button
            onClick={() => setBulkPriceOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)]"
          >
            <TrendingUp className="h-4 w-4" /> Zam Uygula
          </button>
          <button
            onClick={handleCreateClick}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
            <PlusCircle className="h-4 w-4" /> Yeni ürün
          </button>
        </div>
      </header>

      <div className="space-y-4 rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Ürün ara
            </span>
            <div className="flex w-full items-center gap-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5">
              <Search className="h-4 w-4 text-[var(--color-text-admin-muted)]" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Ürün ara"
                className="w-full border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none placeholder:text-[var(--color-text-admin-muted)]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-admin-muted)]">
              Kategori
            </span>
            <div className="flex w-full items-center gap-2 rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-2.5">
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="flex-1 border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none"
              >
                <option value="">Tüm kategoriler</option>
                {categoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-dashed border-[var(--color-border-admin)] bg-[var(--color-bg-card)] px-3 py-3 text-sm text-[var(--color-text-admin-muted)]">
            <span>
              <strong className="text-[var(--color-text-admin)]">
                {pagination.total}
              </strong>{" "}
              ürün
            </span>
            <span>
              Sayfa {pagination.page} / {pagination.pages}
            </span>
          </div>
        </div>
      </div>

      {banner && (
        <AlertBanner
          variant={banner.variant}
          message={banner.message}
          onClose={() => setBanner(null)}
        />
      )}

      <ProductTable
        products={products}
        loading={loading}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        onTranslate={HAS_TRANSLATIONS ? openTranslationModal : undefined}
      />

      {pagination.pages > 1 && (
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => goToPage(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
          >
            Önceki
          </button>
          <button
            onClick={() => goToPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            className="rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
          >
            Sonraki
          </button>
        </div>
      )}

      <ProductForm
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingProduct(null);
          originalInventoryRef.current = null;
        }}
        onSubmit={handleSaveProduct} // ✅ artık product+stock ayrı gelecek
        initialProduct={editingProduct}
        categories={categoryOptions}
      />

      {HAS_TRANSLATIONS && (
        <ProductTranslationModal
          open={translationState.open}
          loading={translationState.loading}
          error={translationState.error}
          product={translationState.product}
          baseLang={BASE_LANG}
          langs={TRANSLATION_LANGS}
          onClose={closeTranslationModal}
          onUpdated={handleTranslationsUpdated}
        />
      )}

      <BulkPriceModal
        open={bulkPriceOpen}
        onClose={() => setBulkPriceOpen(false)}
        onSuccess={() => loadProducts(pagination.page)}
        categories={categoryOptions}
      />

      {deleteDialog && (
        <DeleteProductResolutionModal
          product={deleteDialog.product}
          sets={deleteDialog.sets}
          loading={deleteDialog.loading}
          onResolve={handleResolveDelete}
        />
      )}
    </section>
  );
}

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function DeleteProductResolutionModal({
  product,
  sets = [],
  loading = false,
  onResolve,
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 px-2 sm:px-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-hidden rounded-2xl border border-[var(--color-border-admin)] bg-[var(--color-bg-card)] shadow-xl">
        <header className="border-b border-[var(--color-border-admin)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-admin)]">
            Ürün setlerde kullanılıyor
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-admin-muted)]">
            “{product?.name || "Ürün"}” aşağıdaki setlere ekli. Devam etmek için
            bir seçenek belirleyin.
          </p>
        </header>

        <div className="max-h-64 overflow-y-auto px-5 py-4">
          {sets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border-admin)] px-4 py-6 text-center text-sm text-[var(--color-text-admin-muted)]">
              Bu ürün başka setlerde görünmüyor.
            </div>
          ) : (
            <ul className="space-y-3">
              {sets.map((set) => (
                <li
                  key={set.id || set.slug || set.name}
                  className="rounded-xl border border-[var(--color-border-admin)] bg-[var(--color-surface-light)] px-4 py-3"
                >
                  <div className="text-sm font-semibold text-[var(--color-text-admin)]">
                    {set.name || "Set"}
                  </div>
                  <div className="text-xs text-[var(--color-text-admin-muted)]">
                    {set.slug ? `/${set.slug}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-admin-muted)]">
                    Ürün adedi: {set.productCount ?? "-"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="flex flex-col gap-2 border-t border-[var(--color-border-admin)] bg-[var(--color-surface-light)] px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => onResolve?.("detach")}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
          >
            Ürünü setlerden çıkar
          </button>
          <button
            type="button"
            onClick={() => onResolve?.("delete_sets")}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
          >
            Setleri de sil
          </button>
          <button
            type="button"
            onClick={() => onResolve?.("cancel")}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-full border border-[var(--color-border-admin)] px-4 py-2 text-sm font-semibold text-[var(--color-text-admin)] hover:bg-[var(--color-bg-hover)] disabled:opacity-60"
          >
            Vazgeç
          </button>
        </footer>
      </div>
    </div>
  );
}

function extractMessage(error) {
  const payload = parseErrorPayload(error);
  if (payload?.message) return payload.message;
  if (!error) return "Beklenmeyen hata";
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function parseErrorPayload(error) {
  if (!error) return null;
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : null;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
