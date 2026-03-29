"use client";

// src/pages/HomePage.jsx
import { useEffect, useMemo, useState } from "react";
import Hero from "../components/Hero";
import Categories from "../components/categories/Categories";
import HomeProducts from "../components/home-products/HomeProducts";
import HomeProductComments from "../components/home-comments/HomeProductComments";
import HomeCampaigns from "../components/home-campaigns/HomeCampaigns";
import HomeContact from "../components/home-contact/HomeContact";
import HomeSets from "../components/home-sets/HomeSets";
import { productApi } from "../api/products";
import { setApi } from "../api/sets";
import { heroApi } from "../api/heroes";
import { campaignApi } from "../api/campaigns";
import { reviewApi } from "../api/reviews";
import { useStorefrontLang } from "../context/LangContext.jsx";
import { useStaticTranslation } from "../i18n/staticContent.js";
import { DEFAULT_LANG } from "../constants/lang.js";

function normalizeInitialData(initialData) {
  return {
    heroes: Array.isArray(initialData?.heroes) ? initialData.heroes : [],
    featuredProducts: Array.isArray(initialData?.featuredProducts)
      ? initialData.featuredProducts
      : [],
    sets: Array.isArray(initialData?.sets) ? initialData.sets : [],
    campaigns: Array.isArray(initialData?.campaigns) ? initialData.campaigns : [],
    homeReviews: Array.isArray(initialData?.homeReviews)
      ? initialData.homeReviews
      : [],
    categoryItems: Array.isArray(initialData?.categoryItems)
      ? initialData.categoryItems
      : [],
  };
}

export default function HomePage({
  initialData = null,
  initialLang = DEFAULT_LANG,
}) {
  const { lang } = useStorefrontLang();
  const t = useStaticTranslation();
  const normalizedInitialData = useMemo(
    () => normalizeInitialData(initialData),
    [initialData]
  );
  const hasInitialData = initialData !== null;
  const shouldUseInitialData = hasInitialData && lang === initialLang;
  const fallbackCampaigns = useMemo(
    () => t("homePage.fallbackCampaigns") || [],
    [t]
  );
  const fallbackComments = useMemo(
    () => t("homePage.fallbackComments") || [],
    [t]
  );
  const heroFallback = useMemo(() => t("homePage.heroFallback") || [], [t]);
  const sectionCopy = useMemo(() => t("homePage.sections") || {}, [t]);
  const allTabLabel = useMemo(() => t("homeSets.tabsAll") || "Tümü", [t]);
  const campaignCopy = useMemo(() => t("homeCampaigns") || {}, [t]);
  const sectionUntitledSet = sectionCopy.untitledSet;
  const sectionIncludesMore = sectionCopy.includesMore;
  const initialSetCards = useMemo(
    () =>
      mapSetsToCards(normalizedInitialData.sets, {
        untitledSet: sectionUntitledSet,
        includesMoreLabel: sectionIncludesMore,
      }),
    [normalizedInitialData.sets, sectionIncludesMore, sectionUntitledSet]
  );

  // HERO (dinamik)
  const [heroes, setHeroes] = useState(normalizedInitialData.heroes);
  const [, setLoadingHeroes] = useState(!hasInitialData);

  // Products
  const [featuredProducts, setFeaturedProducts] = useState(
    normalizedInitialData.featuredProducts
  );
  const [loadingProducts, setLoadingProducts] = useState(!hasInitialData);

  // Sets
  const [sets, setSets] = useState(initialSetCards);
  const [loadingSets, setLoadingSets] = useState(!hasInitialData);

  // Campaigns
  const [campaigns, setCampaigns] = useState(normalizedInitialData.campaigns);
  const [loadingCampaigns, setLoadingCampaigns] = useState(!hasInitialData);

  // Reviews
  const [homeReviews, setHomeReviews] = useState(normalizedInitialData.homeReviews);
  // eslint-disable-next-line no-unused-vars
  const [loadingHomeReviews, setLoadingHomeReviews] = useState(!hasInitialData);

  // error
  const [error, setError] = useState(null);

  // HERO fetch
  useEffect(() => {
    let mounted = true;
    if (shouldUseInitialData) {
      setHeroes(normalizedInitialData.heroes);
      setLoadingHeroes(false);
      return () => {
        mounted = false;
      };
    }
    setLoadingHeroes(true);
    (async () => {
      try {
        const list = await heroApi.list({}, lang);
        if (!mounted) return;
        setHeroes(list || []);
      } catch (err) {
        if (mounted) setError(extractMessage(err));
      } finally {
        if (mounted) setLoadingHeroes(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lang, normalizedInitialData.heroes, shouldUseInitialData]);

  // Products fetch
  useEffect(() => {
    let mounted = true;
    if (shouldUseInitialData) {
      setFeaturedProducts(normalizedInitialData.featuredProducts);
      setLoadingProducts(false);
      return () => {
        mounted = false;
      };
    }
    setLoadingProducts(true);
    (async () => {
      try {
        const data = await productApi.list({ limit: 6, view: "card" }, lang);
        if (!mounted) return;
        setFeaturedProducts(data.products || []);
      } catch (err) {
        if (mounted) setError(extractMessage(err));
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lang, normalizedInitialData.featuredProducts, shouldUseInitialData]);

  // Sets fetch
  useEffect(() => {
    let mounted = true;
    if (shouldUseInitialData) {
      setSets(initialSetCards);
      setLoadingSets(false);
      return () => {
        mounted = false;
      };
    }
    setLoadingSets(true);
    (async () => {
      try {
        const data = await setApi.list({ view: "card" }, lang);
        const rawSets = Array.isArray(data) ? data : data?.sets || [];
        if (!mounted) return;
        setSets(
          mapSetsToCards(rawSets, {
            untitledSet: sectionUntitledSet,
            includesMoreLabel: sectionIncludesMore,
          })
        );
      } catch (e) {
        if (mounted) setError(extractMessage(e));
      } finally {
        if (mounted) setLoadingSets(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [
    initialSetCards,
    lang,
    sectionIncludesMore,
    sectionUntitledSet,
    shouldUseInitialData,
  ]);

  // Campaign fetch
  useEffect(() => {
    let mounted = true;
    if (shouldUseInitialData) {
      setCampaigns(normalizedInitialData.campaigns);
      setLoadingCampaigns(false);
      return () => {
        mounted = false;
      };
    }
    setLoadingCampaigns(true);
    (async () => {
      try {
        const list = await campaignApi.listHome(lang);
        if (!mounted) return;
        setCampaigns(list || []);
      } catch (err) {
        if (mounted) {
          setError((prev) => prev || extractMessage(err));
        }
      } finally {
        if (mounted) setLoadingCampaigns(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lang, normalizedInitialData.campaigns, shouldUseInitialData]);

  // Home Reviews fetch
  useEffect(() => {
    let mounted = true;
    if (shouldUseInitialData) {
      setHomeReviews(normalizedInitialData.homeReviews);
      setLoadingHomeReviews(false);
      return () => {
        mounted = false;
      };
    }
    (async () => {
      try {
        const list = await reviewApi.homeFeatured(3); // 3 kart
        if (!mounted) return;
        setHomeReviews(list || []);
      } catch (err) {
        console.error(err);

        // hata bandını bozmayalım; zaten başka yerlerde error gösteriyorsun
      } finally {
        if (mounted) setLoadingHomeReviews(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [normalizedInitialData.homeReviews, shouldUseInitialData]);

  const commentsToRender = useMemo(() => {
    const list =
      Array.isArray(homeReviews) && homeReviews.length
        ? homeReviews
        : fallbackComments;
    return list.slice(0, 3);
  }, [homeReviews, fallbackComments]);

  const newArrivalCards = useMemo(
    () => mapProductsToHomeCards(featuredProducts.slice(0, 3)),
    [featuredProducts]
  );
  const bestsellerCards = useMemo(
    () => mapProductsToHomeCards(featuredProducts.slice(3, 6)),
    [featuredProducts]
  );
  const setTabs = useMemo(() => {
    const tagSet = new Set();
    (sets || []).forEach((s) => (s.tags || []).forEach((tag) => tagSet.add(tag)));
    return [allTabLabel, ...Array.from(tagSet)];
  }, [sets, allTabLabel]);

  const campaignItems = useMemo(() => {
    if (!campaigns.length) return [];
    return mapCampaignsToHomeCards(campaigns.slice(0, 4), {
      fallbackTitle: campaignCopy.fallbackTitle,
      fallbackCta: campaignCopy.cta,
    });
  }, [campaigns, campaignCopy.fallbackTitle, campaignCopy.cta]);

  const campaignsToRender =
    campaignItems.length > 0 ? campaignItems : fallbackCampaigns;

  // Hero slaytlarına fallback
  const heroSlides = heroes.length ? heroes : heroFallback;

  return (
    <>
      {/* Hata bandı (error state'i aktif kullanımı) */}
      {error && (
        <div className="app-section app-section--tight pt-6">
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        </div>
      )}
      {/* Dinamik HERO */}
      <Hero slides={heroSlides} imageAutoMs={6000} />
      <Categories
        items={hasInitialData ? normalizedInitialData.categoryItems : undefined}
        initialLang={initialLang}
      />
      <section className="app-section app-section--tight">
        <div className="glass-surface rounded-xl bg-surface shadow-sm">
          <HomeProducts
            variant="merge-top"
            title={sectionCopy.newArrivalsTitle || "Yeni Gelenler"}
            items={newArrivalCards}
            loading={loadingProducts && !newArrivalCards.length}
            className="rounded-t-xl"
          />
          <HomeProducts
            variant="merge-bottom"
            title={sectionCopy.bestsellersTitle || "En Çok Satanlar"}
            items={bestsellerCards}
            loading={loadingProducts && !bestsellerCards.length}
            className="rounded-b-xl"
          />
        </div>
      </section>
      <HomeSets
        variant="compact"
        title={sectionCopy.setsTitle}
        subtitle={sectionCopy.setsSubtitle}
        tabs={setTabs}
        items={sets}
        viewAllHref="/sets"
        loading={loadingSets}
      />
      <HomeProductComments items={commentsToRender} />
      <HomeCampaigns items={campaignsToRender} loading={loadingCampaigns} />
      <HomeContact />
    </>
  );
}

function mapProductsToHomeCards(products) {
  if (!products?.length) return [];
  return products.map((product) => ({
    image: product.images?.[0]?.url || "/shop-1.jpg",
    title: product.name,
    subtitle: product.category?.name || "",
    price: product.price,
    finalPrice: product.finalPrice ?? product.price,
    discount: product.discount?.percentage,
    to: product.slug ? `/product/${product.slug}` : `/product/${product.id}`,
  }));
}

function mapSetsToCards(sets, { untitledSet, includesMoreLabel } = {}) {
  return (sets || []).map((s) => {
    const image = s.images?.[0]?.url || "/set-placeholder.jpg";
    const title = s.name || untitledSet || "İsimsiz Set";
    const desc = s.description || "";
    const to = `/set/${s.slug || s.id}`;
    const price = Number(s.price ?? 0);
    const finalPrice = Number(s.finalPrice ?? price);
    const discount = s.discount?.percentage;
    const productNames = (s.products || [])
      .map((p) => p?.product?.name)
      .filter(Boolean);
    const includes =
      productNames.length > 0
        ? productNames.slice(0, 3).join(", ") +
          (productNames.length > 3
            ? ` ${String(includesMoreLabel || "+{count}").replace(
                "{count}",
                productNames.length - 3
              )}`
            : "")
        : "";
    const tags = Array.from(
      new Set(
        (s.products || [])
          .map((p) => p?.product?.category?.name)
          .filter(Boolean)
      )
    );
    return {
      image,
      title,
      desc,
      includes,
      tags,
      to,
      price,
      finalPrice,
      discount,
    };
  });
}

function mapCampaignsToHomeCards(list, { fallbackTitle, fallbackCta } = {}) {
  return (list || []).map((campaign) => ({
    id: campaign.id,
    to: campaign.computedLink || "/shop",
    image: campaign.image?.url || "/cmp-1.jpg",
    title: campaign.name || fallbackTitle || "Kampanya",
    subtitle: campaign.description || "",
    badge: campaign.badge || "",
    ctaText: campaign.ctaText || fallbackCta || "Alışverişe Başla",
    variant: mapLayoutToVariant(campaign.layout),
  }));
}

function mapLayoutToVariant(layout) {
  const normalized = String(layout || "").toUpperCase();
  if (normalized === "BIG") return "big";
  if (normalized === "WIDE") return "wide";
  return "small";
}

function extractMessage(error) {
  if (!error) return "Beklenmeyen hata";
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return parsed.message;
    } catch {
      // ignore
    }
    return error.message;
  }
  return String(error);
}
