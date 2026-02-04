// src/components/layout/Header.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import MegaMenu from "./MegaMenu";
import { categoryApi } from "../../api/categories";
import { mapCategoryTree } from "../../utils/catalog";
import { useCart } from "../../hooks/useCart";
import { useStorefrontLang } from "../../context/LangContext.jsx";
import { useStaticTranslation } from "../../i18n/staticContent.js";

export default function Header() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [categoryTree, setCategoryTree] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [navError, setNavError] = useState(null);
  const { lang } = useStorefrontLang();
  const t = useStaticTranslation();
  const { totalItems } = useCart();

  const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  useEffect(() => {
    let mounted = true;
    setLoadingCategories(true);
    (async () => {
      try {
        const tree = await categoryApi.tree(lang);
        if (!mounted) return;
        const normalized = normalizeTree(mapCategoryTree(tree) || []);
        setCategoryTree(normalized);
        setNavError(null);
      } catch (error) {
        if (mounted) setNavError(error);
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lang]);

  useEffect(() => {
    setExpandedNodes(new Set());
  }, [categoryTree]);

  const navigationItems = useMemo(() => {
    return (categoryTree || []).map((node) => ({
      id: node.id,
      label: node.name,
      hasChildren: node.children && node.children.length > 0,
      menu: buildMegaMenuData(node),
    }));
  }, [categoryTree]);

  const runSearch = () => {
    const query = q.trim();
    navigate(query ? `/shop?q=${encodeURIComponent(query)}` : "/shop");
  };

  const onSearchSubmit = (event) => {
    event.preventDefault();
    runSearch();
  };

  const toggleCategoryNode = (id) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCategoryNavigate = (categoryId) => {
    if (!categoryId) return;
    navigate(`/shop?category=${categoryId}`);
    setMobileCategoryOpen(false);
  };

  const handleSaleNavigate = () => {
    navigate("/shop?sale=true");
    setMobileCategoryOpen(false);
  };

  const saleCtaTitle =
    t("header.saleCtaTitle") || "Discover current deals";
  const saleCtaDescription =
    t("header.saleCtaDescription") ||
    "Browse discounted collections curated for you.";

  const renderMobileCategoryList = (nodes = [], depth = 0) => {
    if (!nodes?.length) return null;
    return (
      <ul className="space-y-1">
        {nodes.map((node) => {
          const hasChildren = node.children?.length > 0;
          const expanded = expandedNodes.has(node.id);
          return (
            <li key={node.id}>
              <div
                className="group flex items-center rounded-xl px-3 py-2 text-sm text-primary transition hover:bg-surface"
                style={{ paddingLeft: depth * 16 + 6 }}
              >
                <button
                  type="button"
                  onClick={() => handleCategoryNavigate(node.id)}
                  className="flex-1 text-left font-medium text-primary"
                >
                  {node.name}
                </button>
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleCategoryNode(node.id)}
                    className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-secondary hover:border-primary hover:text-primary"
                    aria-label={
                      expanded
                        ? t("header.collapse") || "Daralt"
                        : t("header.expand") || "Genişlet"
                    }
                  >
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${
                        expanded ? "rotate-90 text-primary" : ""
                      }`}
                    />
                  </button>
                ) : (
                  <span className="ml-2 text-secondary">•</span>
                )}
              </div>
              {hasChildren ? (
                <div
                  className={`overflow-hidden pl-3 transition-all duration-200 ${
                    expanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  {renderMobileCategoryList(node.children, depth + 1)}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-[70]">
        <div className="rounded-t-2xl border-b border-border bg-white/95 backdrop-blur">
          {/* Mobile top */}
          <div className="md:hidden border-b border-border/70 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMobileCategoryOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-primary shadow-sm"
                aria-label={t("header.categories") || "Kategoriler"}
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link
                to="/"
                className="inline-flex flex-1 items-center justify-center gap-2"
                aria-label="Berkay GSM"
              >
                <img
                  src="/logo.png"
                  alt=""
                  className="h-8 w-8 object-contain"
                  draggable="false"
                />
                <span className="font-serif text-2xl font-bold text-primary">
                  Berkay GSM
                </span>
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  to="/cart"
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-secondary hover:text-primary"
                >
                  <ShoppingBag className="h-5 w-5" />
                  {totalItems > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-[10px] text-white">
                      {totalItems}
                    </span>
                  )}
                </Link>
                <Link
                  to="/account"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-secondary hover:text-primary"
                >
                  <User className="h-5 w-5" />
                </Link>
              </div>
            </div>
            <form
              onSubmit={onSearchSubmit}
              className="mt-3 flex items-center gap-3"
            >
              <div className="flex flex-1 items-center rounded-full border border-border bg-white px-3 py-2 shadow-sm">
                <Search className="h-4 w-4 text-secondary" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("header.searchPlaceholder")}
                  className="ml-2 w-full border-none text-sm outline-none placeholder:text-secondary/60"
                />
              </div>
            </form>
          </div>

          {/* Desktop top */}
          <div className="hidden md:block">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="grid h-20 grid-cols-[auto_1fr_auto] items-center gap-4">
                <div className="flex items-center">
                  <Link to="/" className="group inline-flex items-center gap-3">
                    <img
                      src="/logo.png"
                      alt="Berkay GSM"
                      className="h-16 w-16 object-contain"
                      draggable="false"
                    />
                    <span className="font-serif text-3xl font-extrabold tracking-tight text-primary">
                      Berkay GSM
                    </span>
                  </Link>
                </div>
                <div className="flex justify-center">
                  <form
                    onSubmit={onSearchSubmit}
                    className="flex w-full max-w-lg items-center rounded-full border border-border bg-white pl-3 pr-2 py-2 shadow-sm"
                  >
                    <Search className="h-4 w-4 text-secondary" />
                    <input
                      type="text"
                      placeholder={t("header.searchPlaceholder")}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      className="ml-2 w-full border-none text-sm outline-none placeholder:text-secondary/60"
                    />
                  </form>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <Link
                    to="/cart"
                    className="relative inline-flex rounded-full p-2 hover:bg-surface-hover"
                  >
                    <ShoppingBag className="h-6 w-6 text-secondary" />
                    {totalItems > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] text-white">
                        {totalItems}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/account?tab=Wishlist"
                    className="inline-flex rounded-full p-2 hover:bg-surface-hover"
                  >
                    <Heart className="h-6 w-6 text-secondary" />
                  </Link>
                  <Link
                    to="/account"
                    className="inline-flex rounded-full p-2 hover:bg-surface-hover"
                  >
                    <User className="h-6 w-6 text-secondary" />
                  </Link>
                </div>
              </div>
            </div>
            <div className="border-t border-border/70 bg-white">
              <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <nav
                  className="
                    flex h-14 items-center justify-center gap-6
                    text-sm font-medium
                    overflow-x-auto no-scrollbar
                  "
                >
                  {loadingCategories && (
                    <span className="text-sm text-secondary">
                      {t("header.loadingCategories")}
                    </span>
                  )}
                  {!loadingCategories && navError && (
                    <span className="text-sm text-secondary">
                      {t("header.categoriesUnavailable")}
                    </span>
                  )}
                  {!loadingCategories &&
                    !navError &&
                    navigationItems.map((item) =>
                      item.hasChildren ? (
                        <MegaMenu
                          key={item.id}
                          label={item.label}
                          data={item.menu}
                          onRootClick={() =>
                            navigate(`/shop?category=${item.id}`)
                          }
                        />
                      ) : (
                        <Link
                          key={item.id}
                          to={`/shop?category=${item.id}`}
                          className="shrink-0 hover:text-accent"
                        >
                          {item.label}
                        </Link>
                      )
                    )}
                  <Link
                    to="/shop?sale=true"
                    className="shrink-0 text-accent hover:text-accent-hover"
                  >
                    {t("header.sale")}
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </header>

      {mobileCategoryOpen && (
        <div className="fixed inset-0 z-[80] bg-black/50 md:hidden">
          <div
            className="absolute inset-0"
            onClick={() => setMobileCategoryOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex h-full w-full max-w-xs flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-4">
              <div>
                <p className="text-base font-semibold text-primary">
                  {t("header.categories") || "Kategoriler"}
                </p>
                <p className="text-xs text-secondary">
                  {t("header.categoriesHint") ||
                    "Ana kategoriyi seç ve alt başlıkları keşfet"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileCategoryOpen(false)}
                className="rounded-full p-2 text-secondary hover:bg-surface-hover"
                aria-label={t("header.closeMenu") || "Kapat"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
              <div className="sticky top-0 z-10 mb-4 rounded-2xl border border-accent/30 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                  {t("header.sale")}
                </p>
                <p className="mt-1 text-sm font-semibold text-primary">
                  {saleCtaTitle}
                </p>
                <p className="mt-1 text-xs text-secondary">
                  {saleCtaDescription}
                </p>
                <button
                  type="button"
                  onClick={handleSaleNavigate}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-accent/40 bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90"
                >
                  {t("header.sale")}
                </button>
              </div>
              {loadingCategories ? (
                <p className="text-sm text-secondary">
                  {t("header.loadingCategories")}
                </p>
              ) : !categoryTree.length ? (
                <p className="text-sm text-secondary">
                  {t("header.categoriesUnavailable")}
                </p>
              ) : (
                renderMobileCategoryList(categoryTree)
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function normalizeTree(nodes = [], prefix = "cat") {
  return nodes.map((node, index) => {
    const safeId =
      node?.id ??
      node?._id ??
      node?.slug ??
      `${prefix}-${index}-${node?.name || "node"}`;
    return {
      ...node,
      id: safeId,
      children: normalizeTree(node.children || [], `${safeId}-child`),
    };
  });
}

function buildMegaMenuData(node) {
  const children = node.children || [];
  if (!children.length) return [];

  return [
    {
      title: `View all ${node.name}`,
      to: `/shop?category=${node.id}`,
      key: `${node.id}-all`,
      children: [],
    },
    ...children.map((child) => ({
      title: child.name,
      to: `/shop?category=${child.id}`,
      key: child.id,
      image: child.image,
      children: (child.children || []).map((grand) => ({
        title: grand.name,
        to: `/shop?category=${grand.id}`,
        key: grand.id,
        image: grand.image,
      })),
    })),
  ];
}
