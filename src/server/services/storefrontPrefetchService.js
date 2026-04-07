import { unstable_cache } from "next/cache";
import { connectDB } from "../config/db.js";
import Hero from "../models/Hero.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import SetModel from "../models/Set.js";
import Campaign from "../models/Campaign.js";
import Review from "../models/Review.js";
import "../models/User.js";
import UserDetails from "../models/UserDetails.js";
import { shapeProduct } from "../utils/productHelpers.js";
import { hydrateProductsWithInventory } from "../utils/stockItemHelpers.js";
import {
  fetchActiveDiscounts,
  computeProductDiscountMap,
  mapDiscountsToSets,
  applyDiscount,
} from "../utils/discountHelpers.js";
import {
  DEFAULT_LANG,
  normalizeLang,
  resolveTranslation,
} from "../utils/i18n.js";

const HOME_REVALIDATE_SECONDS = 60;
const SHOP_REVALIDATE_SECONDS = 300;
const PRODUCT_REVALIDATE_SECONDS = 300;
const CATEGORY_REVALIDATE_SECONDS = 300;

function toClientSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function resolveId(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value._id) {
    const resolved =
      typeof value._id.toString === "function"
        ? value._id.toString()
        : value._id;
    if (resolved) return String(resolved);
  }
  if (value.id) {
    const resolved = typeof value.id === "function" ? value.id() : value.id;
    if (resolved) return String(resolved);
  }
  return null;
}

function toPlainMedia(media) {
  return media
    ? {
        url: media.url,
        publicId: media.publicId,
        posterUrl: media.posterUrl || null,
        width: media.width,
        height: media.height,
        format: media.format,
      }
    : null;
}

function formatCategoryTree(categories = [], lang = DEFAULT_LANG) {
  const byId = new Map();

  categories.forEach((category) => {
    const localized = resolveTranslation(category, lang);
    const id = resolveId(category);
    if (!id) return;

    byId.set(id, {
      id,
      name: localized.name,
      slug: localized.slug,
      parent: category.parent ? String(category.parent) : null,
      level: Number(category.level || 0),
      image: toPlainMedia(localized.image || category.image),
      sortOrder: Number(category.sortOrder || 0),
      children: [],
    });
  });

  const roots = [];
  byId.forEach((category) => {
    if (category.parent) {
      const parent = byId.get(category.parent);
      if (parent) {
        parent.children.push(category);
        return;
      }
    }
    roots.push(category);
  });

  const sortChildren = (nodes = []) =>
    nodes
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return String(a.name || "").localeCompare(String(b.name || ""), "tr");
      })
      .map((node) => ({
        id: node.id,
        name: node.name,
        slug: node.slug,
        parent: node.parent,
        level: node.level,
        image: node.image,
        sortOrder: node.sortOrder,
        children: sortChildren(node.children || []),
      }));

  return sortChildren(roots);
}
function mapCategoryItems(tree = []) {
  return tree.map((node) => ({
    id: node.id,
    title: node.name,
    image: node.image || null,
    to: `/shop?category=${encodeURIComponent(node.id)}`,
  }));
}

function shapeHeroSlide(hero, lang = DEFAULT_LANG) {
  const localized = resolveTranslation(hero, lang);
  const id = resolveId(hero);

  let computedLink = "/shop";
  if (hero.target?.type === "CATEGORIES" && hero.target?.categories?.length) {
    computedLink = `/shop?category=${encodeURIComponent(
      String(hero.target.categories[0]),
    )}`;
  }

  return {
    id,
    title: localized.title,
    subtitle: localized.subtitle,
    buttonText: localized.buttonText || "",
    image: toPlainMedia(localized.image || hero.image),
    video: localized.video
      ? {
          ...toPlainMedia(localized.video),
          duration: localized.video.duration,
        }
      : hero.video
        ? {
            ...toPlainMedia(hero.video),
            duration: hero.video.duration,
          }
        : null,
    computedLink,
    isActive: !!hero.isActive,
    sortOrder: Number(hero.sortOrder || 0),
  };
}

function shapeCampaignPreview(campaign, lang = DEFAULT_LANG) {
  const localized = resolveTranslation(campaign, lang);
  const id = resolveId(campaign);
  const targetType = campaign.target?.type || "PRODUCTS";

  return {
    id,
    name: localized.name,
    description: localized.description || "",
    badge: localized.badge || "",
    ctaText: localized.ctaText || "",
    layout: localized.layout || campaign.layout || "SMALL",
    image: toPlainMedia(localized.image || campaign.image),
    computedLink:
      targetType === "SETS"
        ? `/sets?campaign=${encodeURIComponent(id)}`
        : `/shop?campaign=${encodeURIComponent(id)}`,
    isActive: !!campaign.isActive,
    sortOrder: Number(campaign.sortOrder || 0),
  };
}

function shapeCatalogProductCard(
  product,
  lang = DEFAULT_LANG,
  discount = null,
) {
  const localized = resolveTranslation(product, lang);
  if (product.category && typeof product.category === "object") {
    localized.category = resolveTranslation(product.category, lang);
  }
  const shaped = shapeProduct(localized, { discount });
  return {
    id: shaped.id,
    name: shaped.name,
    slug: shaped.slug,
    price: shaped.price,
    finalPrice: shaped.finalPrice,
    discount: shaped.discount,
    hasDiscount: shaped.hasDiscount,
    images: shaped.images,
    colors: shaped.colors,
    sizes: shaped.sizes,
    showColors: shaped.showColors,
    showSizes: shaped.showSizes,
    category: shaped.category,
    createdAt: shaped.createdAt,
    updatedAt: shaped.updatedAt,
  };
}

function shapeHomeSet(setDoc, lang = DEFAULT_LANG, discountMap = new Map()) {
  const localized = resolveTranslation(setDoc, lang);
  const id = resolveId(setDoc);
  const basePrice = Number(localized.price ?? setDoc.price ?? 0) || 0;
  const { finalPrice, discount } = applyDiscount(
    basePrice,
    discountMap.get(id) || null,
  );

  return {
    id,
    slug: localized.slug || setDoc.slug || id,
    name: localized.name,
    description: localized.description || "",
    price: basePrice,
    finalPrice,
    discount,
    hasDiscount: Boolean(discount) && basePrice !== finalPrice,
    images: localized.images || setDoc.images || [],
    products: (setDoc.products || []).map((entry) => {
      const localizedProduct = entry?.product
        ? resolveTranslation(entry.product, lang)
        : null;
      const localizedCategory =
        localizedProduct?.category &&
        typeof localizedProduct.category === "object"
          ? resolveTranslation(localizedProduct.category, lang)
          : localizedProduct?.category || null;
      return {
        quantity: Number(entry?.quantity || 1),
        product: localizedProduct
          ? {
              id: resolveId(entry.product),
              name: localizedProduct.name,
              slug: localizedProduct.slug,
              category: localizedCategory
                ? {
                    id: resolveId(localizedCategory),
                    name: localizedCategory.name,
                    slug: localizedCategory.slug,
                  }
                : null,
            }
          : null,
      };
    }),
  };
}

async function fetchCategoryTreeData(lang = DEFAULT_LANG) {
  await connectDB();
  const categories = await Category.find()
    .sort({ level: 1, sortOrder: 1, name: 1 })
    .lean();

  return toClientSafe(formatCategoryTree(categories, lang));
}

const getCachedCategoryTree = unstable_cache(
  async (lang = DEFAULT_LANG) => {
    const normalizedLang = normalizeLang(lang);
    return fetchCategoryTreeData(normalizedLang);
  },
  ["storefront-category-tree"],
  {
    revalidate: CATEGORY_REVALIDATE_SECONDS,
    tags: ["storefront-category-tree"],
  },
);
const getCachedHomePageData = unstable_cache(
  async (lang = DEFAULT_LANG) => {
    const normalizedLang = normalizeLang(lang);
    await connectDB();

    const [
      heroes,
      categoryTree,
      products,
      sets,
      campaigns,
      reviews,
      discounts,
    ] = await Promise.all([
      Hero.find({ isActive: true })
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean(),
      getCachedCategoryTree(normalizedLang),
      Product.find({ isActive: true, listedInCatalog: true })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate("category")
        .lean(),
      SetModel.find({ show: true })
        .sort({ createdAt: -1 })
        .populate({
          path: "products.product",
          populate: { path: "category" },
        })
        .lean(),
      Campaign.find({ isActive: true })
        .sort({ sortOrder: 1, createdAt: -1 })
        .limit(4)
        .lean(),
      Review.find({ approved: true })
        .sort({ rating: -1, createdAt: -1 })
        .limit(3)
        .populate([
          { path: "user", select: "firstName lastName email" },
          { path: "product", select: "name slug" },
          { path: "set", select: "name slug" },
        ])
        .lean(),
      fetchActiveDiscounts(),
    ]);

    await hydrateProductsWithInventory(products);

    const setProducts = [];
    sets.forEach((setDoc) => {
      (setDoc.products || []).forEach((entry) => {
        if (entry?.product) setProducts.push(entry.product);
      });
    });
    await hydrateProductsWithInventory(setProducts);

    const productDiscountMap = computeProductDiscountMap(discounts, products);
    const setDiscountMap = mapDiscountsToSets(
      discounts,
      sets.map((setDoc) => resolveId(setDoc)).filter(Boolean),
    );

    const userIds = Array.from(
      new Set(reviews.map((review) => resolveId(review.user)).filter(Boolean)),
    );

    const detailRows =
      userIds.length > 0
        ? await UserDetails.find({ user: { $in: userIds } })
            .select("user avatar")
            .lean()
        : [];

    const avatarsByUser = new Map(
      detailRows
        .filter((detail) => detail.avatar?.url)
        .map((detail) => [
          String(detail.user),
          {
            url: detail.avatar.url,
            publicId: detail.avatar.publicId,
            width: detail.avatar.width,
            height: detail.avatar.height,
            format: detail.avatar.format,
          },
        ]),
    );

    return toClientSafe({
      heroes: heroes.map((hero) => shapeHeroSlide(hero, normalizedLang)),
      featuredProducts: products.map((product) => {
        const localized = resolveTranslation(product, normalizedLang);
        if (product.category && typeof product.category === "object") {
          localized.category = resolveTranslation(
            product.category,
            normalizedLang,
          );
        }
        return shapeProduct(localized, {
          discount: productDiscountMap.get(resolveId(product)) || null,
        });
      }),
      sets: sets.map((setDoc) =>
        shapeHomeSet(setDoc, normalizedLang, setDiscountMap),
      ),
      campaigns: campaigns.map((campaign) =>
        shapeCampaignPreview(campaign, normalizedLang),
      ),
      homeReviews: reviews.map((review) => {
        const userId = resolveId(review.user);
        const firstName = review.user?.firstName || "";
        const lastName = review.user?.lastName
          ? ` ${review.user.lastName}`
          : "";

        return {
          name: `${firstName}${lastName}`.trim() || "Müşteri",
          quote: review.body || review.title || "",
          rating: Number(review.rating) || 0,
          avatar: userId ? avatarsByUser.get(userId) || null : null,
        };
      }),
      categoryItems: mapCategoryItems(categoryTree),
    });
  },
  ["storefront-home-page"],
  {
    revalidate: HOME_REVALIDATE_SECONDS,
    tags: ["storefront-home-page"],
  },
);

const getCachedShopPageData = unstable_cache(
  async (lang = DEFAULT_LANG) => {
    const normalizedLang = normalizeLang(lang);
    await connectDB();

    const [categoryTree, products, discounts] = await Promise.all([
      getCachedCategoryTree(normalizedLang),
      Product.find({ isActive: true, listedInCatalog: true })
        .sort({ createdAt: -1 })
        .limit(200)
        .populate({
          path: "category",
          select:
            "name slug ancestors image level parent sortOrder translations",
        })
        .lean(),
      fetchActiveDiscounts(),
    ]);

    const productDiscountMap = computeProductDiscountMap(discounts, products);

    return toClientSafe({
      categoryTree,
      products: products.map((product) =>
        shapeCatalogProductCard(
          product,
          normalizedLang,
          productDiscountMap.get(resolveId(product)) || null,
        ),
      ),
    });
  },
  ["storefront-shop-page"],
  { revalidate: SHOP_REVALIDATE_SECONDS },
);

const getCachedProductPageData = unstable_cache(
  async (slug, lang = DEFAULT_LANG) => {
    const normalizedLang = normalizeLang(lang);
    if (!slug) return null;

    await connectDB();

    const product = await Product.findOne({
      slug,
      isActive: true,
      listedInCatalog: true,
    })
      .populate({
        path: "category",
        select: "name slug ancestors image level parent sortOrder translations",
      })
      .lean();

    if (!product) return null;

    await hydrateProductsWithInventory([product]);
    const discounts = await fetchActiveDiscounts();
    const productDiscountMap = computeProductDiscountMap(discounts, [product]);
    const localizedProduct = resolveTranslation(product, normalizedLang);
    if (product.category && typeof product.category === "object") {
      localizedProduct.category = resolveTranslation(
        product.category,
        normalizedLang,
      );
    }

    const categoryId = resolveId(product.category);
    let similar = [];

    if (categoryId) {
      const relatedProducts = await Product.find({
        _id: { $ne: product._id },
        isActive: true,
        listedInCatalog: true,
        category: categoryId,
      })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate({
          path: "category",
          select:
            "name slug ancestors image level parent sortOrder translations",
        })
        .lean();

      const relatedDiscountMap = computeProductDiscountMap(
        discounts,
        relatedProducts,
      );
      similar = relatedProducts
        .map((relatedProduct) =>
          shapeCatalogProductCard(
            relatedProduct,
            normalizedLang,
            relatedDiscountMap.get(resolveId(relatedProduct)) || null,
          ),
        )
        .filter((item) => item.slug !== localizedProduct.slug)
        .slice(0, 4);
    }

    return toClientSafe({
      product: shapeProduct(localizedProduct, {
        discount: productDiscountMap.get(resolveId(product)) || null,
      }),
      similar,
    });
  },
  ["storefront-product-page"],
  { revalidate: PRODUCT_REVALIDATE_SECONDS },
);

export async function getStorefrontCategoryTree(lang = DEFAULT_LANG) {
  return getCachedCategoryTree(normalizeLang(lang));
}

export async function getHomePageData(lang = DEFAULT_LANG) {
  return getCachedHomePageData(normalizeLang(lang));
}

export async function getShopPageData(lang = DEFAULT_LANG) {
  return getCachedShopPageData(normalizeLang(lang));
}

export async function getProductPageData(slug, lang = DEFAULT_LANG) {
  return getCachedProductPageData(String(slug || ""), normalizeLang(lang));
}
