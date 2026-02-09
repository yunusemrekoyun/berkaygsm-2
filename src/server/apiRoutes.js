import {
  register,
  login,
  refresh,
  logout,
  me,
} from "./controllers/authController.js";
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  listProductSets,
} from "./controllers/productController.js";
import {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deleteCategory,
  getCategoryTree,
} from "./controllers/categoryController.js";
import {
  listActiveCampaigns,
  listCampaignsAdmin,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  reorderCampaigns,
  resolveCampaign,
  getCampaign,
} from "./controllers/campaignController.js";
import {
  listDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
} from "./controllers/discountController.js";
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  applyCoupon,
} from "./controllers/couponController.js";
import {
  listSets,
  createSet,
  getSet,
  updateSet,
  deleteSet,
} from "./controllers/setController.js";
import {
  listUsers,
  getUser,
  updateUser,
  softDeleteUser,
  restoreUser,
} from "./controllers/userController.js";
import {
  getMyDetails,
  updateMyDetails,
  uploadAvatar,
  createAddress,
  updateAddress,
  deleteAddress,
  getFavorites,
  toggleFavorite,
} from "./controllers/userDetailsController.js";
import {
  createOrder,
  myOrders,
  getOrder,
  listOrders,
  adminGetOrder,
  updateOrderStatus,
} from "./controllers/orderController.js";
import {
  createPayPalCheckout,
  capturePayPalCheckout,
} from "./controllers/paymentController.js";
import {
  listHeroes,
  createHero,
  getHero,
  updateHero,
  deleteHero,
  reorderHeroes,
} from "./controllers/heroController.js";
import {
  getShippingConfig,
  updateShippingConfig,
} from "./controllers/shippingController.js";
import {
  listStocks,
  listByOwner,
  upsertStock,
  updateStock,
  deleteStock,
  syncOwnerStocks,
  getStockSummary,
} from "./controllers/stockController.js";
import {
  listApprovedForProduct,
  productReviewStats,
  createReview,
  listPendingReviews,
  approveReview,
  deleteReview,
  listAdminReviews,
  reviewSummary,
  listApprovedForSet,
  setReviewStats,
  listHomeFeaturedReviews,
} from "./controllers/reviewController.js";
import {
  getAbout,
  updateAbout,
} from "./controllers/aboutController.js";
import {
  getContact,
  updateContact,
  submitMessage,
  listMessages,
  updateMessageStatus,
  deleteMessage,
} from "./controllers/contactController.js";
import {
  getFaqPublic,
  getFaqManage,
  upsertFaq,
} from "./controllers/faqController.js";
import {
  getPublicShippingReturns,
  getManageShippingReturns,
  upsertShippingReturns,
} from "./controllers/shippingReturnsController.js";
import {
  getPublicPrivacy,
  getManagePrivacy,
  upsertPrivacy,
} from "./controllers/privacyController.js";
import {
  getPublicTerms,
  getManageTerms,
  upsertTerms,
} from "./controllers/termsController.js";
import {
  getPublicTheme,
  getManageTheme,
  upsertTheme,
} from "./controllers/themeController.js";
import {
  getCloudinaryUsage,
  listCloudinaryResources,
  deleteCloudinaryResource,
  createUploadSignature,
  uploadMediaAsset,
} from "./controllers/mediaController.js";
import {
  getAdminAnalyticsOverview,
  getAdminVisitAnalyticsOverview,
  trackVisit,
} from "./controllers/analyticsController.js";

import { requireAuth } from "./middleware/auth.js";
import { requireRole } from "./middleware/roles.js";
import { validateBody } from "./middleware/validate.js";
import {
  orderCreateSchema,
  paypalCreateSchema,
  paypalCaptureSchema,
  stockUpsertSchema,
  stockUpdateSchema,
  stockSyncSchema,
} from "./validation/schemas.js";

import {
  generalLimiter,
  strictLimiter,
  refreshLimiter,
  mediaUploadLimiter,
} from "./rateLimiters.js";

const healthHandler = (req, res) => res.json({ ok: true });

const uploadDefaultLimits = {
  maxFileSizeMb: 5,
};

const heroUploadLimits = {
  maxFileSizeMb: Number(process.env.HERO_MAX_FILE_MB || 80),
  allowedMime: (mime) => mime.startsWith("image/") || mime.startsWith("video/"),
};

function route(method, path, handlers, options = {}) {
  return { method, path, handlers, options };
}

export const routes = [
  // health
  route("GET", ["health"], [healthHandler]),

  // auth
  route("POST", ["auth", "register"], [strictLimiter, register]),
  route("POST", ["auth", "login"], [strictLimiter, login]),
  route("POST", ["auth", "refresh"], [refreshLimiter, refresh]),
  route("POST", ["auth", "logout"], [refreshLimiter, logout]),
  route("GET", ["auth", "me"], [requireAuth, me]),

  // products
  route("GET", ["products"], [listProducts]),
  route(
    "POST",
    ["products"],
    [requireAuth, requireRole("admin"), createProduct],
    {
      body: "form",
      upload: { type: "array", field: "images", limits: { ...uploadDefaultLimits, maxFiles: 8 } },
    }
  ),
  route("GET", ["products", ":idOrSlug", "sets"], [listProductSets]),
  route("GET", ["products", ":idOrSlug"], [getProduct]),
  route(
    "PUT",
    ["products", ":idOrSlug"],
    [requireAuth, requireRole("admin"), updateProduct],
    {
      body: "form",
      upload: { type: "array", field: "images", limits: { ...uploadDefaultLimits, maxFiles: 8 } },
    }
  ),
  route(
    "DELETE",
    ["products", ":idOrSlug"],
    [requireAuth, requireRole("admin"), deleteProduct]
  ),

  // categories
  route("GET", ["categories"], [listCategories]),
  route("GET", ["categories", "tree"], [getCategoryTree]),
  route("GET", ["categories", ":idOrSlug"], [getCategory]),
  route(
    "POST",
    ["categories"],
    [requireAuth, requireRole("admin"), createCategory],
    {
      body: "form",
      upload: { type: "single", field: "image", limits: uploadDefaultLimits },
    }
  ),
  route(
    "PATCH",
    ["categories", ":idOrSlug"],
    [requireAuth, requireRole("admin"), updateCategory],
    {
      body: "form",
      upload: { type: "single", field: "image", limits: uploadDefaultLimits },
    }
  ),
  route(
    "DELETE",
    ["categories", ":idOrSlug"],
    [requireAuth, requireRole("admin"), deleteCategory]
  ),

  // media
  route("GET", ["media", "usage"], [requireAuth, requireRole("admin"), getCloudinaryUsage]),
  route("GET", ["media", "resources"], [requireAuth, requireRole("admin"), listCloudinaryResources]),
  route(
    "DELETE",
    ["media", "resources", ":publicId"],
    [requireAuth, requireRole("admin"), deleteCloudinaryResource]
  ),
  route("POST", ["media", "signature"], [requireAuth, createUploadSignature]),
  route(
    "POST",
    ["media", "upload"],
    [requireAuth, requireRole("admin"), mediaUploadLimiter, uploadMediaAsset],
    {
      body: "form",
      upload: { type: "single", field: "file", limits: uploadDefaultLimits },
    }
  ),

  // sets
  route("GET", ["sets"], [listSets]),
  route(
    "POST",
    ["sets"],
    [requireAuth, requireRole("admin"), createSet],
    {
      body: "form",
      upload: { type: "array", field: "images", limits: { ...uploadDefaultLimits, maxFiles: 8 } },
    }
  ),
  route("GET", ["sets", ":idOrSlug"], [getSet]),
  route(
    "PUT",
    ["sets", ":idOrSlug"],
    [requireAuth, requireRole("admin"), updateSet],
    {
      body: "form",
      upload: { type: "array", field: "images", limits: { ...uploadDefaultLimits, maxFiles: 8 } },
    }
  ),
  route(
    "DELETE",
    ["sets", ":idOrSlug"],
    [requireAuth, requireRole("admin"), deleteSet]
  ),

  // users (admin)
  route("GET", ["users"], [requireAuth, requireRole("admin"), listUsers]),
  route("GET", ["users", ":idOrKey"], [requireAuth, requireRole("admin"), getUser]),
  route("PATCH", ["users", ":idOrKey"], [requireAuth, requireRole("admin"), updateUser]),
  route("POST", ["users", ":idOrKey", "soft-delete"], [requireAuth, requireRole("admin"), softDeleteUser]),
  route("POST", ["users", ":idOrKey", "restore"], [requireAuth, requireRole("admin"), restoreUser]),

  // analytics tracking (public)
  route("POST", ["analytics", "track-visit"], [trackVisit]),

  // analytics (admin)
  route(
    "GET",
    ["analytics", "overview"],
    [requireAuth, requireRole("admin"), getAdminAnalyticsOverview]
  ),
  route(
    "GET",
    ["analytics", "visits-overview"],
    [requireAuth, requireRole("admin"), getAdminVisitAnalyticsOverview]
  ),

  // user details (auth)
  route("GET", ["user-details"], [requireAuth, getMyDetails]),
  route("GET", ["user-details", "me"], [requireAuth, getMyDetails]),
  route("PUT", ["user-details", "me"], [requireAuth, updateMyDetails]),
  route(
    "PATCH",
    ["user-details", "me", "avatar"],
    [requireAuth, uploadAvatar],
    { body: "form", upload: { type: "single", field: "avatar", limits: uploadDefaultLimits } }
  ),
  route("POST", ["user-details", "addresses"], [requireAuth, createAddress]),
  route("PUT", ["user-details", "addresses", ":addressId"], [requireAuth, updateAddress]),
  route("DELETE", ["user-details", "addresses", ":addressId"], [requireAuth, deleteAddress]),
  route("GET", ["user-details", "favorites"], [requireAuth, getFavorites]),
  route("POST", ["user-details", "favorites", "toggle"], [requireAuth, toggleFavorite]),

  // orders
  route(
    "POST",
    ["orders", "paypal", "create"],
    [requireAuth, validateBody(paypalCreateSchema), createPayPalCheckout]
  ),
  route(
    "POST",
    ["orders", "paypal", "capture"],
    [requireAuth, validateBody(paypalCaptureSchema), capturePayPalCheckout]
  ),
  route(
    "POST",
    ["orders"],
    [requireAuth, validateBody(orderCreateSchema), createOrder]
  ),
  route("GET", ["orders", "mine"], [requireAuth, myOrders]),
  route("GET", ["orders", "admin"], [requireAuth, requireRole("admin"), listOrders]),
  route("GET", ["orders", "admin", ":id"], [requireAuth, requireRole("admin"), adminGetOrder]),
  route(
    "PATCH",
    ["orders", "admin", ":id", "status"],
    [requireAuth, requireRole("admin"), updateOrderStatus]
  ),
  route("GET", ["orders", ":id"], [requireAuth, getOrder]),

  // heroes
  route("GET", ["heroes"], [listHeroes]),
  route(
    "POST",
    ["heroes"],
    [requireAuth, requireRole("admin"), createHero],
    { body: "form", upload: { type: "single", field: "media", limits: heroUploadLimits } }
  ),
  route(
    "GET",
    ["heroes", ":id"],
    [requireAuth, requireRole("admin"), getHero]
  ),
  route(
    "PUT",
    ["heroes", ":id"],
    [requireAuth, requireRole("admin"), updateHero],
    { body: "form", upload: { type: "single", field: "media", limits: heroUploadLimits } }
  ),
  route(
    "DELETE",
    ["heroes", ":id"],
    [requireAuth, requireRole("admin"), deleteHero]
  ),
  route(
    "POST",
    ["heroes", "reorder"],
    [requireAuth, requireRole("admin"), reorderHeroes]
  ),

  // shipping
  route("GET", ["shipping"], [getShippingConfig]),
  route("PUT", ["shipping"], [requireAuth, requireRole("admin"), updateShippingConfig]),

  // discounts
  route("GET", ["discounts"], [requireAuth, requireRole("admin"), listDiscounts]),
  route("POST", ["discounts"], [requireAuth, requireRole("admin"), createDiscount]),
  route("PATCH", ["discounts", ":id"], [requireAuth, requireRole("admin"), updateDiscount]),
  route("DELETE", ["discounts", ":id"], [requireAuth, requireRole("admin"), deleteDiscount]),

  // coupons
  route("POST", ["coupons", "apply"], [applyCoupon]),
  route("GET", ["coupons"], [requireAuth, requireRole("admin"), listCoupons]),
  route("POST", ["coupons"], [requireAuth, requireRole("admin"), createCoupon]),
  route("PATCH", ["coupons", ":id"], [requireAuth, requireRole("admin"), updateCoupon]),
  route("DELETE", ["coupons", ":id"], [requireAuth, requireRole("admin"), deleteCoupon]),

  // campaigns
  route("GET", ["campaigns"], [listActiveCampaigns]),
  route("GET", ["campaigns", ":id", "resolve"], [resolveCampaign]),
  route("GET", ["campaigns", "manage"], [requireAuth, requireRole("admin"), listCampaignsAdmin]),
  route("GET", ["campaigns", ":id"], [requireAuth, requireRole("admin"), getCampaign]),
  route(
    "POST",
    ["campaigns"],
    [requireAuth, requireRole("admin"), createCampaign],
    { body: "form", upload: { type: "single", field: "image", limits: uploadDefaultLimits } }
  ),
  route(
    "PUT",
    ["campaigns", ":id"],
    [requireAuth, requireRole("admin"), updateCampaign],
    { body: "form", upload: { type: "single", field: "image", limits: uploadDefaultLimits } }
  ),
  route(
    "DELETE",
    ["campaigns", ":id"],
    [requireAuth, requireRole("admin"), deleteCampaign]
  ),
  route(
    "POST",
    ["campaigns", "reorder"],
    [requireAuth, requireRole("admin"), reorderCampaigns]
  ),

  // reviews
  route("GET", ["reviews", "product", ":idOrSlug", "stats"], [productReviewStats]),
  route("GET", ["reviews", "product", ":idOrSlug"], [listApprovedForProduct]),
  route("GET", ["reviews", "set", ":idOrSlug", "stats"], [setReviewStats]),
  route("GET", ["reviews", "set", ":idOrSlug"], [listApprovedForSet]),
  route("GET", ["reviews", "home"], [listHomeFeaturedReviews]),
  route("POST", ["reviews"], [requireAuth, createReview]),
  route("GET", ["reviews", "summary"], [requireAuth, requireRole("admin"), reviewSummary]),
  route("GET", ["reviews", "pending"], [requireAuth, requireRole("admin"), listPendingReviews]),
  route("GET", ["reviews"], [requireAuth, requireRole("admin"), listAdminReviews]),
  route("PATCH", ["reviews", ":id", "approve"], [requireAuth, requireRole("admin"), approveReview]),
  route("DELETE", ["reviews", ":id"], [requireAuth, requireRole("admin"), deleteReview]),

  // about
  route("GET", ["about"], [getAbout]),
  route(
    "PUT",
    ["about"],
    [requireAuth, requireRole("admin"), updateAbout],
    {
      body: "form",
      upload: {
        type: "fields",
        fields: [
          { name: "heroImage" },
          { name: "leftImage" },
          { name: "materialsImage" },
        ],
        limits: uploadDefaultLimits,
      },
    }
  ),
  route(
    "PATCH",
    ["about"],
    [requireAuth, requireRole("admin"), updateAbout],
    {
      body: "form",
      upload: {
        type: "fields",
        fields: [
          { name: "heroImage" },
          { name: "leftImage" },
          { name: "materialsImage" },
        ],
        limits: uploadDefaultLimits,
      },
    }
  ),

  // contact
  route("GET", ["contact"], [getContact]),
  route("POST", ["contact", "messages"], [submitMessage]),
  route(
    "PUT",
    ["contact"],
    [requireAuth, requireRole("admin"), updateContact],
    { body: "form", upload: { type: "single", field: "heroImage", limits: uploadDefaultLimits } }
  ),
  route("GET", ["contact", "messages"], [requireAuth, requireRole("admin"), listMessages]),
  route(
    "PATCH",
    ["contact", "messages", ":id"],
    [requireAuth, requireRole("admin"), updateMessageStatus]
  ),
  route(
    "DELETE",
    ["contact", "messages", ":id"],
    [requireAuth, requireRole("admin"), deleteMessage]
  ),

  // faq
  route("GET", ["faq"], [getFaqPublic]),
  route("GET", ["faq", "manage"], [requireAuth, requireRole("admin"), getFaqManage]),
  route("PUT", ["faq"], [requireAuth, requireRole("admin"), upsertFaq]),

  // shipping-returns
  route("GET", ["shipping-returns"], [getPublicShippingReturns]),
  route(
    "GET",
    ["shipping-returns", "manage"],
    [requireAuth, requireRole("admin"), getManageShippingReturns]
  ),
  route(
    "PUT",
    ["shipping-returns"],
    [requireAuth, requireRole("admin"), upsertShippingReturns]
  ),

  // privacy
  route("GET", ["privacy"], [getPublicPrivacy]),
  route("GET", ["privacy", "manage"], [requireAuth, requireRole("admin"), getManagePrivacy]),
  route("PUT", ["privacy"], [requireAuth, requireRole("admin"), upsertPrivacy]),

  // terms
  route("GET", ["terms"], [getPublicTerms]),
  route("GET", ["terms", "manage"], [requireAuth, requireRole("admin"), getManageTerms]),
  route("PUT", ["terms"], [requireAuth, requireRole("admin"), upsertTerms]),

  // theme
  route("GET", ["theme"], [getPublicTheme]),
  route("GET", ["theme", "manage"], [requireAuth, requireRole("admin"), getManageTheme]),
  route("PUT", ["theme"], [requireAuth, requireRole("admin"), upsertTheme]),

  // stocks
  route("GET", ["stocks"], [requireAuth, requireRole("admin"), listStocks]),
  route(
    "GET",
    ["stocks", "by-owner", ":ownerModel", ":owner"],
    [requireAuth, requireRole("admin"), listByOwner]
  ),
  route("GET", ["stocks", "summary"], [requireAuth, requireRole("admin"), getStockSummary]),
  route(
    "POST",
    ["stocks"],
    [requireAuth, requireRole("admin"), validateBody(stockUpsertSchema), upsertStock]
  ),
  route(
    "PATCH",
    ["stocks", ":id"],
    [requireAuth, requireRole("admin"), validateBody(stockUpdateSchema), updateStock]
  ),
  route(
    "DELETE",
    ["stocks", ":id"],
    [requireAuth, requireRole("admin"), deleteStock]
  ),
  route(
    "PUT",
    ["stocks", "sync"],
    [requireAuth, requireRole("admin"), validateBody(stockSyncSchema), syncOwnerStocks]
  ),
];

export function findRoute(method, pathSegments) {
  const segments = Array.isArray(pathSegments) ? pathSegments : [];

  for (const routeEntry of routes) {
    if (routeEntry.method !== method) continue;
    if (routeEntry.path.length !== segments.length) continue;

    const params = {};
    let matched = true;
    for (let i = 0; i < routeEntry.path.length; i += 1) {
      const token = routeEntry.path[i];
      const segment = segments[i];
      if (token.startsWith(":")) {
        params[token.slice(1)] = segment;
        continue;
      }
      if (token !== segment) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;
    return { ...routeEntry, params };
  }

  return null;
}
