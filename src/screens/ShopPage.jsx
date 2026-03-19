import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import BreadCrumb from "../components/shop/BreadCrumb";
import ShopPageFilter from "../components/shop/ShopPageFilter";
import ShopPageProducts from "../components/shop/ShopPageProducts";
import { categoryApi } from "../api/categories";
import { productApi } from "../api/products";
import { setApi } from "../api/sets";
import { campaignApi } from "../api/campaigns";
import { stackedDiscountApi } from "../api/stackedDiscount";
import { mapCategoryTree } from "../utils/catalog";
import SetsSetItem from "../components/sets-sets/SetsSetItem";
import { useStorefrontLang } from "../context/LangContext.jsx";
import {
  useStaticTranslation,
  formatStaticText,
} from "../i18n/staticContent.js";
import { getColorInfo } from "../utils/colors.js";

const isObjectId = (v) => typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);

function normalizeIdList(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => {
          if (!value) return "";
          if (typeof value === "string") return value.trim();
          if (typeof value === "object") {
            if (typeof value.id === "string") return value.id.trim();
            if (typeof value._id === "string") return value._id.trim();
          }
          return "";
        })
        .filter(Boolean)
    )
  );
}

function matchesStackedProduct(product, stackedDiscount) {
  const targets = stackedDiscount?.targets || {};
  const productIds = new Set(normalizeIdList(targets.products || []));
  const categoryIds = new Set(normalizeIdList(targets.categories || []));
  const productId = String(product?.id || product?._id || "").trim();
  if (!productId) return false;
  if (productIds.has(productId)) return true;

  if (!categoryIds.size) return false;
  const category = product?.category || null;
  const relatedCategoryIds = normalizeIdList([
    category?.id || category?._id || category || null,
    ...(Array.isArray(category?.ancestors) ? category.ancestors : []),
  ]);
  return relatedCategoryIds.some((categoryId) => categoryIds.has(categoryId));
}

function matchesStackedSet(setDoc, stackedDiscount) {
  const targets = stackedDiscount?.targets || {};
  const setIds = new Set(normalizeIdList(targets.sets || []));
  const setId = String(setDoc?.id || setDoc?._id || "").trim();
  if (!setId) return false;
  return setIds.has(setId);
}

export default function ShopPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [matchingSets, setMatchingSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(false);

  const [categoryTree, setCategoryTree] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedPrice, setSelectedPrice] = useState(0);

  const [campaignContext, setCampaignContext] = useState(null);
  const [campaignError, setCampaignError] = useState("");
  const [stackedDiscountContext, setStackedDiscountContext] = useState(null);
  const [stackedDiscountError, setStackedDiscountError] = useState("");

  const [error, setError] = useState(null);
  const { lang } = useStorefrontLang();
  const t = useStaticTranslation();
  const shopCopy = useMemo(() => t("shopPage") || {}, [t]);
  const matchingCopy = shopCopy.matchingSets || {};
  const bannerCopy = shopCopy.campaignBanner || {};
  const filtersCopy = useMemo(() => t("shopFilters") || {}, [t]);
  const searchPlaceholder = filtersCopy.searchPlaceholder || "Ürün ara";
  const searchButtonLabel = filtersCopy.searchButton || "Ara";
  const clearSearchLabel = filtersCopy.clearSearch || "Temizle";
  const quickCategoriesLabel =
    filtersCopy.quickCategories || filtersCopy.categories || "Kategoriler";
  const breadcrumbs = useMemo(() => t("breadcrumbs") || {}, [t]);
  const shopProductsEmpty =
    shopCopy.noProducts || "Seçili filtrelere uygun ürün bulunamadı.";
  const matchingEmpty = matchingCopy.empty || "Bu aramaya uygun set yok.";
  const setsCardCopy = useMemo(() => {
    const setsPage = t("setsPage") || {};
    return setsPage.cards || {};
  }, [t]);

  const campaignId = searchParams.get("campaign");
  const searchQuery = (searchParams.get("q") || "").trim();
  const saleParam = (searchParams.get("sale") || "").toLowerCase();
  const isSaleMode = saleParam === "true" || saleParam === "1";
  const stackedDiscountParam = (searchParams.get("stackedDiscount") || "").toLowerCase();
  const isStackedDiscountMode =
    stackedDiscountParam === "true" || stackedDiscountParam === "1";
  const saleBannerCopy = shopCopy.saleBanner || {};
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(null);
  const [searchText, setSearchText] = useState(searchQuery);

  useEffect(() => {
    setSearchText(searchQuery);
  }, [searchQuery]);

  const quickCategoryChips = useMemo(() => {
    if (!Array.isArray(categoryTree) || !categoryTree.length) return [];
    return categoryTree.map((node) => ({
      id: node.id,
      label: node.name,
    }));
  }, [categoryTree]);

  // Kampanya parametresi aşaması
  useEffect(() => {
    if (!campaignId) {
      setCampaignContext(null);
      setCampaignError("");
      return;
    }

    let mounted = true;
    (async () => {
      try {
        setCampaignError("");
        const data = await campaignApi.resolve(campaignId, lang);
        if (!mounted) return;
        if (data.targetType === "SETS") {
          navigate(`/sets?campaign=${campaignId}`, { replace: true });
          return;
        }
        setCampaignContext(data);
      } catch (err) {
        if (!mounted) return;
        setCampaignContext(null);
        setCampaignError(extractMessage(err));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [campaignId, lang, navigate]);

  useEffect(() => {
    if (!isStackedDiscountMode) {
      setStackedDiscountContext(null);
      setStackedDiscountError("");
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const data = await stackedDiscountApi.getPublic();
        if (!mounted) return;
        if (!data?.active) {
          setStackedDiscountContext(null);
          setStackedDiscountError("Katlanan indirim filtresi şu an aktif değil.");
          return;
        }
        setStackedDiscountContext(data);
        setStackedDiscountError("");
      } catch (error) {
        if (!mounted) return;
        setStackedDiscountContext(null);
        setStackedDiscountError(extractMessage(error));
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isStackedDiscountMode]);

  // Kategori ağacı
  useEffect(() => {
    let mounted = true;
    setError(null);
    if (isStackedDiscountMode && !stackedDiscountContext && !stackedDiscountError) {
      setLoadingProducts(true);
      return () => {
        mounted = false;
      };
    }
    if (isStackedDiscountMode && stackedDiscountError) {
      setProducts([]);
      setMatchingSets([]);
      setLoadingProducts(false);
      setLoadingSets(false);
      return () => {
        mounted = false;
      };
    }
    (async () => {
      try {
        const treeRes = await categoryApi.tree(lang);
        if (!mounted) return;
        setCategoryTree(mapCategoryTree(treeRes));
      } catch (err) {
        if (!mounted) return;
        setError((prev) => prev || extractMessage(err));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isStackedDiscountMode, lang, stackedDiscountContext, stackedDiscountError]);

  // Ürünler + set arama sonuçları
  useEffect(() => {
    let mounted = true;
    setError(null);
    (async () => {
      try {
        setLoadingProducts(true);
        if (campaignContext?.items) {
          const items = campaignContext.items || [];
          const filtered = searchQuery
            ? items.filter((item) =>
                String(item?.name || "")
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase())
              )
            : items;
          if (!mounted) return;
          setProducts(filtered);
          setMatchingSets([]);
          setLoadingSets(false);
        } else {
          const params = { limit: 200 };
          if (searchQuery) params.search = searchQuery;
          const { products: productList = [] } = await productApi.list(
            params,
            lang
          );
          if (!mounted) return;
          let resolvedProducts = isSaleMode
            ? productList.filter(
                (item) =>
                  Boolean(item?.hasDiscount) ||
                  Boolean(item?.discount) ||
                  Number(item?.finalPrice ?? item?.price ?? 0) <
                    Number(item?.price ?? 0)
              )
            : productList;
          if (isStackedDiscountMode && stackedDiscountContext?.active) {
            resolvedProducts = resolvedProducts.filter((item) =>
              matchesStackedProduct(item, stackedDiscountContext)
            );
          }
          setProducts(resolvedProducts);

          if (isStackedDiscountMode && stackedDiscountContext?.active) {
            const targetSetCount =
              stackedDiscountContext?.targets?.sets?.length || 0;
            if (targetSetCount > 0) {
              setLoadingSets(true);
              try {
                const setResponse = await setApi.list({ limit: 200 }, lang);
                if (!mounted) return;
                setMatchingSets(
                  mapSetsToCards(setResponse, {
                    includesMoreLabel: setsCardCopy.includesMore,
                    untitledLabel: setsCardCopy.untitled,
                  }).filter((setCard) =>
                    matchesStackedSet(setCard, stackedDiscountContext)
                  )
                );
              } catch (setErr) {
                if (!mounted) return;
                console.error("stacked set filter failed", setErr);
                setMatchingSets([]);
              } finally {
                if (mounted) setLoadingSets(false);
              }
            } else {
              setMatchingSets([]);
              setLoadingSets(false);
            }
          } else if (searchQuery && !isSaleMode) {
            setLoadingSets(true);
            try {
              const setResponse = await setApi.list(
                {
                  search: searchQuery,
                  limit: 60,
                },
                lang
              );
              if (!mounted) return;
              setMatchingSets(
                mapSetsToCards(setResponse, {
                  includesMoreLabel: setsCardCopy.includesMore,
                  untitledLabel: setsCardCopy.untitled,
                })
              );
            } catch (setErr) {
              if (!mounted) return;
              console.error("set search failed", setErr);
              setMatchingSets([]);
            } finally {
              if (mounted) setLoadingSets(false);
            }
          } else {
            setMatchingSets([]);
            setLoadingSets(false);
          }
        }
      } catch (err) {
        if (!mounted) return;
        setError(extractMessage(err));
        setProducts([]);
        setMatchingSets([]);
        setLoadingSets(false);
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [
    campaignContext,
    isSaleMode,
    isStackedDiscountMode,
    lang,
    searchQuery,
    setsCardCopy,
    stackedDiscountContext,
  ]);

  // Fiyat aralığı (ürünlere göre)
  const priceRange = useMemo(() => {
    if (!products.length) return { min: 0, max: 0 };
    const vals = products.map((p) => Number(p.finalPrice ?? p.price ?? 0) || 0);
    const mins = Math.min(...vals);
    const maxs = Math.max(...vals);
    return {
      min: Math.max(0, Math.floor(mins)),
      max: Math.max(0, Math.ceil(maxs)),
    };
  }, [products]);

  // URL paramlarını uygula: category (id/slug), price
  useEffect(() => {
    let mounted = true;
    (async () => {
      // CATEGORY
      const categoryParam = searchParams.get("category");
      if (!categoryParam) {
        if (mounted) setSelectedCategory("all");
      } else if (isObjectId(categoryParam)) {
        if (mounted) setSelectedCategory(categoryParam);
      } else {
        // slug -> id çöz
        try {
          const cat = await categoryApi.get(categoryParam, lang); // id veya slug kabul ediyor
          if (!mounted) return;
          const resolvedId = cat?.id || cat?._id || "";
          setSelectedCategory(resolvedId || "all");
        } catch {
          if (mounted) setSelectedCategory("all");
        }
      }

      // PRICE
      const priceParam = searchParams.get("price");
      if (priceParam) {
        const next = Number(priceParam);
        if (mounted) {
          setSelectedPrice(Number.isFinite(next) ? next : priceRange.max);
        }
      } else if (priceRange.max > 0) {
        if (mounted) setSelectedPrice(priceRange.max);
      }
    })();
    return () => {
      mounted = false;
    };
    // priceRange.max değiştiğinde de başlangıç değeri ayarlansın
  }, [lang, priceRange.max, searchParams]);

  // Renk/Model seçenekleri
  const availableColors = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      if (!product?.showColors) return;
      (product.colors || []).forEach((rawColor) => {
        const value = typeof rawColor === "string" ? rawColor.trim() : rawColor;
        if (!value) return;
        const info = getColorInfo(value, lang);
        const key = (info.value || value || "").toLowerCase();
        if (map.has(key)) return;
        map.set(key, {
          value,
          normalizedValue: info.value || value,
          label: info.label || String(value),
          swatch: info.isHex ? info.swatch : null,
        });
      });
    });
    return Array.from(map.values());
  }, [products, lang]);

  const availableSizes = useMemo(() => {
    const set = new Set();
    products.forEach((product) => {
      if (!product?.showSizes) return;
      (product.sizes || []).forEach((size) => {
        const trimmed = (size || "").trim();
        if (trimmed) set.add(trimmed);
      });
    });
    return Array.from(set);
  }, [products]);

  // Client-side filtreleme (ID uyumlu hale getirildi)
  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase();
    return (products || []).filter((product) => {
      if (!product) return false;

      // price
      const price = Number(product.finalPrice ?? product.price) || 0;
      if (selectedPrice && price > selectedPrice) return false;

      if (normalizedQuery) {
        const name = String(product.name || "").toLowerCase();
        const slug = String(product.slug || "").toLowerCase();
        if (
          !name.includes(normalizedQuery) &&
          !slug.includes(normalizedQuery)
        ) {
          return false;
        }
      }

      // category (product.category id’sini normalize et)
      if (selectedCategory !== "all") {
        const catId =
          product.category?.id || product.category?._id || product.category;
        const ancestors = product.category?.ancestors || [];
        // Ürün hem kendi kategorisi hem de ancestors içinde olabilir
        const allRelatedIds = [String(catId), ...ancestors.map(String)];
        if (!allRelatedIds.includes(String(selectedCategory))) return false;
      }

      // color
      if (selectedColor) {
        if (!product.showColors) return false;
        const colors = product.colors || [];
        if (
          !colors
            .map((c) => (c || "").toLowerCase())
            .includes(selectedColor.toLowerCase())
        ) {
          return false;
        }
      }

      // size
      if (selectedSize) {
        if (!product.showSizes) return false;
        const sizes = product.sizes || [];
        if (!sizes.includes(selectedSize)) return false;
      }

      if (isSaleMode) {
        const hasDeal =
          Boolean(product.hasDiscount) ||
          Boolean(product.discount) ||
          Number(product.finalPrice ?? product.price ?? 0) <
            Number(product.price ?? 0);
        if (!hasDeal) return false;
      }

      return true;
    });
  }, [
    isSaleMode,
    products,
    selectedCategory,
    selectedColor,
    selectedSize,
    selectedPrice,
    searchQuery,
  ]);

  const activeCampaign = campaignContext?.campaign || null;
  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0,
      }),
    []
  );
  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategory === "all") return null;
    return findCategoryById(categoryTree, selectedCategory)?.name || null;
  }, [categoryTree, selectedCategory]);
  const selectedColorLabel = useMemo(() => {
    if (!selectedColor) return null;
    const match = availableColors.find(
      (color) => String(color.value) === String(selectedColor)
    );
    return match?.label || selectedColor;
  }, [availableColors, selectedColor]);
  const priceChipActive =
    priceRange.max > 0 && selectedPrice && selectedPrice < priceRange.max;

  const handleOpenFilters = () => {
    setDraftFilters({
      category: selectedCategory,
      color: selectedColor,
      size: selectedSize,
      price: selectedPrice ?? priceRange.max,
    });
    setFiltersOpen(true);
  };

  const handleCloseFilters = () => {
    setFiltersOpen(false);
    setDraftFilters(null);
  };

  const handleDraftReset = () => {
    setDraftFilters({
      category: "all",
      color: "",
      size: "",
      price: priceRange.max,
    });
  };

  const handleApplyDraftFilters = () => {
    if (!draftFilters) {
      handleCloseFilters();
      return;
    }
    handleCategoryChange(draftFilters.category || "all");
    setSelectedColor(draftFilters.color || "");
    setSelectedSize(draftFilters.size || "");
    handlePriceChange(
      draftFilters.price === undefined ? priceRange.max : draftFilters.price
    );
    handleCloseFilters();
  };

  // Filtre eventleri (URL senkron)
  const handleCategoryChange = (id) => {
    setSelectedCategory(id);
    const params = new URLSearchParams(searchParams);
    if (!id || id === "all") params.delete("category");
    else params.set("category", id);
    setSearchParams(params);
  };

  const handlePriceChange = (value) => {
    setSelectedPrice(value);
    const params = new URLSearchParams(searchParams);
    if (!value || value >= priceRange.max) params.delete("price");
    else params.set("price", String(value));
    setSearchParams(params);
  };

  const handleReset = () => {
    setSelectedCategory("all");
    setSelectedColor("");
    setSelectedSize("");
    setSelectedPrice(priceRange.max);
    const params = new URLSearchParams(searchParams);
    params.delete("category");
    params.delete("price");
    setSearchParams(params);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const next = (searchText || "").trim();
    const params = new URLSearchParams(searchParams);
    if (next) params.set("q", next);
    else params.delete("q");
    setSearchParams(params);
  };

  const handleClearSearch = () => {
    setSearchText("");
    const params = new URLSearchParams(searchParams);
    params.delete("q");
    setSearchParams(params);
  };

  const handleClearCampaign = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("campaign");
    setSearchParams(params);
  };

  const handleClearSale = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("sale");
    setSearchParams(params);
  };

  const handleClearStackedDiscount = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("stackedDiscount");
    setSearchParams(params);
  };

  const activeFilterBadges = [];
  if (selectedCategoryLabel) {
    activeFilterBadges.push({
      key: "category",
      label: selectedCategoryLabel,
      onClear: () => handleCategoryChange("all"),
    });
  }
  if (selectedColor) {
    activeFilterBadges.push({
      key: "color",
      label: selectedColorLabel || selectedColor,
      onClear: () => setSelectedColor(""),
    });
  }
  if (selectedSize) {
    activeFilterBadges.push({
      key: "size",
      label: selectedSize,
      onClear: () => setSelectedSize(""),
    });
  }
  if (priceChipActive) {
    activeFilterBadges.push({
      key: "price",
      label: `${filtersCopy.price || "Fiyat"} ≤ ${priceFormatter.format(
        selectedPrice
      )}`,
      onClear: () => handlePriceChange(priceRange.max),
    });
  }
  if (isStackedDiscountMode) {
    activeFilterBadges.push({
      key: "stackedDiscount",
      label: "Katlanan indirim grubu",
      onClear: handleClearStackedDiscount,
    });
  }

  const pendingFilterValues = {
    category: draftFilters?.category ?? selectedCategory,
    color: draftFilters?.color ?? selectedColor,
    size: draftFilters?.size ?? selectedSize,
    price:
      draftFilters?.price ??
      (selectedPrice === undefined ? priceRange.max : selectedPrice),
  };
  const isSearchActive = Boolean(searchQuery);

  return (
    <section className="app-section">
      <BreadCrumb
        items={[
          { label: breadcrumbs.home || "Ana Sayfa", to: "/" },
          {
            label: breadcrumbs.shop || shopCopy.title || "Mağaza",
          },
        ]}
      />

      {isSaleMode && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-accent">
          <div>
            {saleBannerCopy.text ||
              "Sadece indirimli ürünleri gösteriyorsunuz fırsatları kaçırmayın!"}
          </div>
          <button
            type="button"
            onClick={handleClearSale}
            className="text-accent underline underline-offset-4 hover:text-accent/80"
          >
            {saleBannerCopy.clear || "Tüm ürünleri göster"}
          </button>
        </div>
      )}

      {isStackedDiscountMode && !stackedDiscountError && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
          <div>
            Katlanan indirim grubundaki ürün ve setleri görüntülüyorsunuz.
          </div>
          <button
            type="button"
            onClick={handleClearStackedDiscount}
            className="text-sky-700 underline underline-offset-4 hover:text-sky-600"
          >
            Tüm ürünleri göster
          </button>
        </div>
      )}

      {stackedDiscountError && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{stackedDiscountError}</span>
          <button
            type="button"
            onClick={handleClearStackedDiscount}
            className="underline underline-offset-4 hover:text-rose-800"
          >
            Filtreyi kapat
          </button>
        </div>
      )}

      {campaignError && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{campaignError}</span>
          <button
            type="button"
            onClick={handleClearCampaign}
            className="text-rose-700 underline underline-offset-4 hover:text-rose-800"
          >
            {bannerCopy.errorAction || "Kampanya filtresini temizle"}
          </button>
        </div>
      )}

      {activeCampaign && !campaignError && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          <div>
            {bannerCopy.prefix || "Gösterilen kampanya"}{" "}
            <span className="font-semibold">“{activeCampaign.name}”</span>
            {activeCampaign.description
              ? ` — ${activeCampaign.description}`
              : ""}
          </div>
          <button
            type="button"
            onClick={handleClearCampaign}
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            {bannerCopy.clear || "Temizle"}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="glass-surface mt-6 space-y-3 rounded-2xl border border-border/70 bg-white/95 p-4 shadow-sm md:hidden">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="glass-input flex flex-1 items-center gap-2 rounded-full border border-border bg-white px-3 py-2 shadow-sm focus-within:border-accent">
            <Search className="h-4 w-4 text-secondary" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full border-0 bg-transparent text-sm text-primary placeholder:text-secondary/70 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-2 sm:w-auto sm:flex-row">
            {isSearchActive && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="inline-flex w-full items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-secondary hover:border-accent sm:w-auto"
              >
                {clearSearchLabel}
              </button>
            )}
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 sm:w-auto"
            >
              {searchButtonLabel}
            </button>
          </div>
        </form>

        {quickCategoryChips.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-secondary">
              <span>{quickCategoriesLabel}</span>
              {selectedCategory !== "all" && (
                <button
                  type="button"
                  onClick={() => handleCategoryChange("all")}
                  className="text-secondary underline-offset-4 hover:text-primary"
                >
                  {filtersCopy.allProducts || "Tüm ürünler"}
                </button>
              )}
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => handleCategoryChange("all")}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  selectedCategory === "all"
                    ? "border-accent bg-accent text-white shadow"
                    : "border-border text-primary hover:border-accent"
                }`}
              >
                {filtersCopy.allProducts || "Tüm ürünler"}
              </button>
              {quickCategoryChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleCategoryChange(chip.id)}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    selectedCategory === chip.id
                      ? "border-accent bg-accent text-white shadow"
                      : "border-border text-primary hover:border-accent"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 md:hidden">
        <button
          type="button"
          onClick={handleOpenFilters}
          className="inline-flex flex-1 items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-primary shadow-sm"
        >
          {filtersCopy.title || "Filtreler"}
        </button>
        {searchQuery && (
          <span className="text-xs uppercase tracking-wide text-secondary">
            “{searchQuery}”
          </span>
        )}
      </div>

      {activeFilterBadges.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-primary/80">
          {activeFilterBadges.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onClear}
              className="glass-chip inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 shadow-sm hover:border-accent hover:text-accent"
            >
              <span>{chip.label}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        {/* SOLDA: DESKTOP FİLTRE */}
        <div className="hidden lg:block lg:w-[320px] lg:flex-shrink-0">
          <ShopPageFilter
            categoryTree={categoryTree}
            selectedCategory={selectedCategory}
            onCategoryChange={(category) => handleCategoryChange(category.id)}
            colors={availableColors}
            selectedColor={selectedColor}
            onColorChange={setSelectedColor}
            sizes={availableSizes}
            selectedSize={selectedSize}
            onSizeChange={setSelectedSize}
            priceRange={priceRange}
            selectedPrice={selectedPrice}
            onPriceChange={handlePriceChange}
            onReset={handleReset}
            labels={filtersCopy}
          />
        </div>

        {/* SAĞDA: ÜRÜNLER + DESKTOP SEARCH BAR */}
        <div className="flex-1 min-w-0">
          {/* <div className="hidden md:block rounded-2xl border border-border/70 bg-white/95 p-4 shadow-sm">
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-3"
            >
              <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-white px-3 py-2 shadow-sm focus-within:border-accent">
                <Search className="h-4 w-4 text-secondary" />
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full border-0 bg-transparent text-sm text-primary placeholder:text-secondary/70 focus:outline-none"
                />
              </div>
              {isSearchActive && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="inline-flex items-center justify-center rounded-full border border-border px-4 py-2 text-sm font-semibold text-secondary hover:border-accent"
                >
                  {clearSearchLabel}
                </button>
              )}
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
              >
                {searchButtonLabel}
              </button>
            </form>
            {quickCategoryChips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleCategoryChange("all")}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    selectedCategory === "all"
                      ? "border-accent bg-accent text-white shadow"
                      : "border-border text-primary hover:border-accent"
                  }`}
                >
                  {filtersCopy.allProducts || "Tüm ürünler"}
                </button>
                {quickCategoryChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleCategoryChange(chip.id)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      selectedCategory === chip.id
                        ? "border-accent bg-accent text-white shadow"
                        : "border-border text-primary hover:border-accent"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
          </div> */}

          <ShopPageProducts
            products={filteredProducts}
            loading={loadingProducts}
            emptyLabel={shopProductsEmpty}
          />
          {(searchQuery && !isSaleMode) || isStackedDiscountMode ? (
            <div className="mt-12">
              <h2 className="text-2xl font-semibold text-primary">
                {isStackedDiscountMode
                  ? "Katılan Setler"
                  : matchingCopy.title || "Eşleşen Paketler"}
              </h2>
              <p className="mt-1 text-sm text-secondary">
                {isStackedDiscountMode
                  ? "Katlanan indirim kuralına dahil olan setler."
                  : formatStaticText(
                      matchingCopy.subtitle ||
                        "“{query}” için aksesuar paketleri.",
                      { query: searchQuery }
                    )}
              </p>

              {loadingSets ? (
                <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="glass-surface h-64 rounded-xl bg-white/70 ring-1 ring-black/5 animate-pulse"
                    />
                  ))}
                </div>
              ) : matchingSets.length ? (
                <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6">
                  {matchingSets.map((setCard) => (
                    <SetsSetItem
                      key={setCard.id || setCard.to}
                      {...setCard}
                      copy={setsCardCopy}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-secondary">
                  {matchingEmpty}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-[90] bg-black/60 md:hidden">
          <div className="absolute inset-0" onClick={handleCloseFilters} />
          <div className="glass-surface absolute inset-y-0 right-0 flex h-full w-full max-w-md flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-base font-semibold text-primary">
                {filtersCopy.title || "Filtreler"}
              </h2>
              <button
                type="button"
                onClick={handleCloseFilters}
                className="rounded-full border border-border px-3 py-1 text-sm text-secondary hover:bg-surface-hover"
              >
                {filtersCopy.close || "Kapat"}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ShopPageFilter
                categoryTree={categoryTree}
                selectedCategory={pendingFilterValues.category}
                onCategoryChange={(category) =>
                  setDraftFilters((prev) => ({
                    ...(prev || {}),
                    category: category.id,
                  }))
                }
                colors={availableColors}
                selectedColor={pendingFilterValues.color}
                onColorChange={(value) =>
                  setDraftFilters((prev) => ({
                    ...(prev || {}),
                    color: value,
                  }))
                }
                sizes={availableSizes}
                selectedSize={pendingFilterValues.size}
                onSizeChange={(value) =>
                  setDraftFilters((prev) => ({
                    ...(prev || {}),
                    size: value,
                  }))
                }
                priceRange={priceRange}
                selectedPrice={pendingFilterValues.price}
                onPriceChange={(value) =>
                  setDraftFilters((prev) => ({
                    ...(prev || {}),
                    price: value,
                  }))
                }
                onReset={handleDraftReset}
                labels={filtersCopy}
              />
            </div>
            <div className="flex items-center gap-3 border-t border-border/60 px-4 py-3">
              <button
                type="button"
                onClick={handleDraftReset}
                className="flex-1 rounded-full border border-border px-4 py-2 text-sm font-semibold text-secondary hover:bg-surface-hover"
              >
                {filtersCopy.reset || "Sıfırla"}
              </button>
              <button
                type="button"
                onClick={handleApplyDraftFilters}
                className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              >
                {filtersCopy.apply || "Uygula"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function extractMessage(error) {
  if (!error) return "";
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return parsed.message;
    } catch {
      /* ignore */
    }
    return error.message;
  }
  return String(error);
}

function mapSetsToCards(
  sets,
  { includesMoreLabel = "+{count}", untitledLabel = "İsimsiz Set" } = {}
) {
  return (Array.isArray(sets) ? sets : []).map((set) => {
    const image = set?.images?.[0]?.url || "/set-placeholder.jpg";
    const title = set?.name || untitledLabel || "İsimsiz Set";
    const desc = set?.description || "";
    const productNames = (set?.products || [])
      .map((entry) => entry?.product?.name)
      .filter(Boolean);
    const includes = productNames.length
      ? productNames.slice(0, 3).join(", ") +
        (productNames.length > 3
          ? formatStaticText(includesMoreLabel || "+{count}", {
              count: productNames.length - 3,
            })
          : "")
      : "";

    const rawId = set?._id?.toString?.() || set?.id || set?.slug || "";
    const slugOrId = set?.slug || rawId;
    const to = slugOrId ? `/set/${slugOrId}` : "#";

    const price = Number(set?.price ?? 0);
    const finalPrice = Number(set?.finalPrice ?? price);
    const discount = set?.discount?.percentage;

    return {
      id: rawId || slugOrId || to,
      image,
      title,
      desc,
      includes,
      to,
      price,
      finalPrice,
      discount,
    };
  });
}

function findCategoryById(tree = [], targetId) {
  if (!targetId || !tree?.length) return null;
  const stack = [...tree];
  while (stack.length) {
    const node = stack.pop();
    if (String(node.id) === String(targetId)) return node;
    if (node.children?.length) {
      stack.push(...node.children);
    }
  }
  return null;
}
