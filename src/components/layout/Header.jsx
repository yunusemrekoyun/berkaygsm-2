// src/components/layout/Header.jsx
import { useEffect, useMemo, useRef, useState } from "react";
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
import AppImage from "../ui/AppImage.jsx";
import { categoryApi } from "../../api/categories";
import { mapCategoryTree } from "../../utils/catalog";
import { useCart } from "../../hooks/useCart";
import { useStorefrontLang } from "../../context/LangContext.jsx";
import { useStaticTranslation } from "../../i18n/staticContent.js";
import { DEFAULT_LANG } from "../../constants/lang.js";
import { resolveImageSrc } from "../../utils/imageSrc.js";

export default function Header({
  initialCategoryTree = null,
  initialLang = DEFAULT_LANG,
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const hasInitialCategoryTree = Array.isArray(initialCategoryTree);
  const normalizedInitialCategoryTree = useMemo(
    () => normalizeTree(initialCategoryTree || []),
    [initialCategoryTree]
  );
  const [categoryTree, setCategoryTree] = useState(normalizedInitialCategoryTree);
  const [loadingCategories, setLoadingCategories] = useState(
    !hasInitialCategoryTree
  );
  const [navError, setNavError] = useState(null);
  const { lang } = useStorefrontLang();
  const t = useStaticTranslation();
  const { totalItems } = useCart();

  const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [desktopNavHasOverflow, setDesktopNavHasOverflow] = useState(false);
  const [desktopNavDragging, setDesktopNavDragging] = useState(false);
  const desktopNavRef = useRef(null);
  const desktopDragStateRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    suppressClick: false,
  });

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    if (hasInitialCategoryTree && lang === initialLang) {
      setCategoryTree(normalizedInitialCategoryTree);
      setNavError(null);
      setLoadingCategories(false);
      return () => {
        mounted = false;
      };
    }
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
  }, [
    hasInitialCategoryTree,
    initialLang,
    lang,
    normalizedInitialCategoryTree,
  ]);

  useEffect(() => {
    setExpandedNodes(new Set());
  }, [categoryTree]);

  useEffect(() => {
    const container = desktopNavRef.current;
    if (!container) return undefined;

    const updateOverflow = () => {
      setDesktopNavHasOverflow(
        container.scrollWidth - container.clientWidth > 8
      );
    };

    updateOverflow();
    window.addEventListener("resize", updateOverflow);
    return () => window.removeEventListener("resize", updateOverflow);
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

  const handleDesktopNavPointerDown = (event) => {
    const container = desktopNavRef.current;
    if (!container || !desktopNavHasOverflow || event.button !== 0) return;
    desktopDragStateRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      suppressClick: false,
    };
    setDesktopNavDragging(true);
  };

  const handleDesktopNavPointerMove = (event) => {
    const container = desktopNavRef.current;
    const drag = desktopDragStateRef.current;
    if (!container || !drag.active) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 6) {
      drag.suppressClick = true;
    }
    container.scrollLeft = drag.startScrollLeft - delta;
  };

  const handleDesktopNavPointerUp = () => {
    if (!desktopDragStateRef.current.active) return;
    desktopDragStateRef.current.active = false;
    setDesktopNavDragging(false);
  };

  const handleDesktopNavClickCapture = (event) => {
    if (!desktopDragStateRef.current.suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    desktopDragStateRef.current.suppressClick = false;
  };

  const saleCtaTitle =
    t("header.saleCtaTitle") || "Güncel indirimleri keşfet";
  const saleCtaDescription =
    t("header.saleCtaDescription") ||
    "Sana özel seçilmiş indirimli koleksiyonları incele.";

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
      <header className="fixed left-0 right-0 top-0 z-[120]">
        <div className="rounded-t-2xl border-b border-border glass-surface glass-surface-strong">
          {/* Mobile top */}
          <div className="md:hidden border-b border-border/70 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMobileCategoryOpen(true)}
                className="glass-chip inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-primary shadow-sm"
                aria-label={t("header.categories") || "Kategoriler"}
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link
                to="/"
                className="inline-flex flex-1 items-center justify-center gap-2"
                aria-label="Berkay GSM"
              >
                <AppImage
                  src="/logo.png"
                  alt=""
                  width={64}
                  height={64}
                  sizes="64px"
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
                  className="glass-chip relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-secondary hover:text-primary"
                >
                  <ShoppingBag className="h-5 w-5" />
                  {hydrated && totalItems > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-[10px] text-white">
                      {totalItems}
                    </span>
                  )}
                </Link>
                <Link
                  to="/account"
                  className="glass-chip inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-secondary hover:text-primary"
                >
                  <User className="h-5 w-5" />
                </Link>
              </div>
            </div>
            <form
              onSubmit={onSearchSubmit}
              className="mt-3 flex items-center gap-3"
            >
              <div className="glass-input flex flex-1 items-center rounded-full border border-border px-3 py-2 shadow-sm">
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
                    <AppImage
                      src="/logo.png"
                      alt="Berkay GSM"
                      width={96}
                      height={96}
                      sizes="96px"
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
                    className="glass-input flex w-full max-w-lg items-center rounded-full border border-border pl-3 pr-2 py-2 shadow-sm"
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
                    className="glass-chip relative inline-flex rounded-full p-2 hover:bg-surface-hover"
                  >
                    <ShoppingBag className="h-6 w-6 text-secondary" />
                    {hydrated && totalItems > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] text-white">
                        {totalItems}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/account?tab=Wishlist"
                    className="glass-chip inline-flex rounded-full p-2 hover:bg-surface-hover"
                  >
                    <Heart className="h-6 w-6 text-secondary" />
                  </Link>
                  <Link
                    to="/account"
                    className="glass-chip inline-flex rounded-full p-2 hover:bg-surface-hover"
                  >
                    <User className="h-6 w-6 text-secondary" />
                  </Link>
                </div>
              </div>
            </div>
            <div className="glass-surface glass-surface-soft border-t border-border/70">
              <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <div
                  ref={desktopNavRef}
                  className={`overflow-x-auto no-scrollbar ${
                    desktopNavHasOverflow
                      ? desktopNavDragging
                        ? "cursor-grabbing select-none"
                        : "cursor-grab"
                      : ""
                  }`}
                  onMouseDown={handleDesktopNavPointerDown}
                  onMouseMove={handleDesktopNavPointerMove}
                  onMouseUp={handleDesktopNavPointerUp}
                  onMouseLeave={handleDesktopNavPointerUp}
                  onClickCapture={handleDesktopNavClickCapture}
                >
                  <div
                    className={`flex ${
                      desktopNavHasOverflow ? "justify-start" : "justify-center"
                    }`}
                  >
                    <nav className="flex h-14 min-w-max items-center gap-6 text-sm font-medium">
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
          </div>
        </div>
      </header>

      {mobileCategoryOpen && (
        <div className="fixed inset-0 z-[140] bg-black/50 md:hidden">
          <div
            className="absolute inset-0"
            onClick={() => setMobileCategoryOpen(false)}
          />
          <div className="glass-surface absolute inset-y-0 left-0 flex h-full w-full max-w-xs flex-col shadow-2xl">
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
                className="glass-chip rounded-full p-2 text-secondary hover:bg-surface-hover"
                aria-label={t("header.closeMenu") || "Kapat"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
              <div className="glass-surface glass-surface-soft sticky top-0 z-10 mb-4 rounded-2xl border border-accent/30 px-4 py-3 shadow-sm">
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

  const resolveCategoryImage = (category) => {
    if (!category) return null;
    const directImage = resolveImageSrc(category.image);
    if (directImage) return directImage;
    const stack = [...(category.children || [])];
    while (stack.length) {
      const current = stack.shift();
      if (!current) continue;
      const nestedImage = resolveImageSrc(current.image);
      if (nestedImage) return nestedImage;
      if (current.children?.length) stack.push(...current.children);
    }
    return null;
  };

  const fallbackImage = resolveCategoryImage(node) || "/cat-1.jpg";
  const resolveWithFallback = (category, fallback = fallbackImage) =>
    resolveCategoryImage(category) || fallback || "/cat-1.jpg";

  const viewAllChildren = children.map((child) => ({
    title: child.name,
    to: `/shop?category=${child.id}`,
    key: `${child.id}-viewall`,
    image: resolveWithFallback(child),
  }));

  return [
    {
      title: `Tüm ${node.name} ürünleri`,
      to: `/shop?category=${node.id}`,
      key: `${node.id}-all`,
      children: viewAllChildren,
      image: fallbackImage,
    },
    ...children.map((child) => ({
      title: child.name,
      to: `/shop?category=${child.id}`,
      key: child.id,
      image: resolveWithFallback(child),
      children: (child.children || []).map((grand) => ({
        title: grand.name,
        to: `/shop?category=${grand.id}`,
        key: grand.id,
        image: resolveWithFallback(grand, resolveWithFallback(child)),
      })),
    })),
  ];
}
