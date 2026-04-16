import { http, toQueryString } from "./client.js";
import { uploadAssets, appendAssetList } from "./uploads.js";
import { DEFAULT_LANG } from "../constants/lang.js";

const normalizeIdOrSlug = (value) => {
  if (!value) return "";

  if (typeof value === "object" && !Array.isArray(value)) {
    if (typeof value.slug === "string" && value.slug.trim()) {
      return value.slug.trim();
    }

    let raw =
      value.id ??
      value._id ??
      value.productId ??
      (value.product &&
        (value.product.id ||
          value.product._id ||
          (typeof value.product.toHexString === "function"
            ? value.product.toHexString()
            : null)));

    if (!raw) {
      if (typeof value.toHexString === "function") {
        raw = value.toHexString();
      } else if (
        typeof value.toString === "function" &&
        value.toString !== Object.prototype.toString
      ) {
        const str = value.toString();
        if (str && str !== "[object Object]") raw = str;
      }
    }

    if (!raw) return "";
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed && trimmed !== "[object Object]") return trimmed;
      return "";
    }
    if (typeof raw === "number") return String(raw);
    if (typeof raw === "object") {
      if (typeof raw._id === "string") return raw._id.trim();
      if (typeof raw.id === "string") return raw.id.trim();
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
    return fallback && fallback !== "[object Object]" ? fallback : "";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed !== "[object Object]" ? trimmed : "";
  }
  if (typeof value === "number") return String(value);
  const fallback = String(value).trim();
  return fallback && fallback !== "[object Object]" ? fallback : "";
};

const toJsonArray = (value) => {
  if (!value) return "[]";
  if (Array.isArray(value)) {
    const arr = value.map((item) => `${item}`.trim()).filter(Boolean);
    return JSON.stringify(arr);
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify([]);
};

const looksLikeProduct = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    Boolean(value._id) ||
    Boolean(value.id) ||
    Boolean(value.slug) ||
    Boolean(value.name) ||
    value.price !== undefined
  );
};

const extractProduct = (data) => {
  if (!data) return null;
  if (data.product) return data.product;
  if (data?.data?.product) return data.data.product;
  if (looksLikeProduct(data?.data)) return data.data;
  if (looksLikeProduct(data)) return data;
  return null;
};

const hasOwn = (value, key) =>
  Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);

export const productApi = {
  async list(params = {}, lang = DEFAULT_LANG) {
    const qs = toQueryString({ ...params, lang: lang ?? DEFAULT_LANG });
    const data = await http(`/products${qs}`, {
      auth: Boolean(params?.includeHidden),
    });
    return data; // { products, pagination, ... }
  },

  async get(
    idOrSlug,
    lang = DEFAULT_LANG,
    { auth = false, includeHidden = false } = {}
  ) {
    const identifier = normalizeIdOrSlug(idOrSlug);
    if (!identifier) {
      throw new Error(JSON.stringify({ message: "Ürün kimliği bulunamadı" }));
    }
    const qs = toQueryString({
      lang: lang ?? DEFAULT_LANG,
      includeHidden: includeHidden ? "true" : undefined,
    });
    const data = await http(`/products/${identifier}${qs}`, { auth });
    return extractProduct(data);
  },

  // payload = productPayload (stok HARİÇ!)
  async create(payload, lang = DEFAULT_LANG) {
    const form = new FormData();
    if (payload.name !== undefined) form.append("name", payload.name.trim());
    if (payload.price !== undefined)
      form.append("price", String(payload.price));
    if (payload.description)
      form.append("description", payload.description.trim());
    if (payload.careInstructions)
      form.append("careInstructions", payload.careInstructions.trim());
    if (payload.details) form.append("details", toJsonArray(payload.details));
    if (payload.colors) form.append("colors", toJsonArray(payload.colors));
    if (payload.sizes) form.append("sizes", toJsonArray(payload.sizes));
    if (payload.category) form.append("category", payload.category);

    if (payload.isActive !== undefined)
      form.append("isActive", payload.isActive ? "true" : "false");
    if (payload.showColors !== undefined)
      form.append("showColors", payload.showColors ? "true" : "false");
    if (payload.showSizes !== undefined)
      form.append("showSizes", payload.showSizes ? "true" : "false");
    if (payload.listedInCatalog !== undefined)
      form.append(
        "listedInCatalog",
        payload.listedInCatalog ? "true" : "false"
      );
    if (payload.customAttribute)
      form.append("customAttribute", JSON.stringify(payload.customAttribute));
    if (hasOwn(payload, "stockRows")) {
      form.append("stockRows", JSON.stringify(payload.stockRows || []));
    }

    // 🚫 Artık INVENTORY GÖNDERMEYİZ (stoklar ayrı endpoint ile yazılıyor)
    const uploadedImages = await uploadAssets(payload.images || [], {
      scope: "products",
    });
    appendAssetList(form, "images", uploadedImages);
    if (payload.imageOrder?.length)
      form.append("imageOrder", toJsonArray(payload.imageOrder));

    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/products${qs}`, {
      method: "POST",
      body: form,
      auth: true,
    });
    return extractProduct(data);
  },

  // payload = productPayload (stok HARİÇ!)
  async update(idOrSlug, payload, lang = DEFAULT_LANG) {
    const identifier = normalizeIdOrSlug(idOrSlug);
    if (!identifier) {
      throw new Error(JSON.stringify({ message: "Ürün kimliği bulunamadı" }));
    }
    const form = new FormData();
    if (payload.name !== undefined) form.append("name", payload.name.trim());
    if (payload.price !== undefined)
      form.append("price", String(payload.price));
    if (payload.description !== undefined)
      form.append("description", (payload.description || "").trim());
    if (payload.careInstructions !== undefined)
      form.append("careInstructions", (payload.careInstructions || "").trim());
    if (payload.details !== undefined)
      form.append("details", toJsonArray(payload.details));
    if (payload.colors !== undefined)
      form.append("colors", toJsonArray(payload.colors));
    if (payload.sizes !== undefined)
      form.append("sizes", toJsonArray(payload.sizes));
    if (payload.category !== undefined)
      form.append("category", payload.category || "");

    if (payload.isActive !== undefined)
      form.append("isActive", payload.isActive ? "true" : "false");
    if (payload.showColors !== undefined)
      form.append("showColors", payload.showColors ? "true" : "false");
    if (payload.showSizes !== undefined)
      form.append("showSizes", payload.showSizes ? "true" : "false");
    if (payload.listedInCatalog !== undefined)
      form.append(
        "listedInCatalog",
        payload.listedInCatalog ? "true" : "false"
      );
    if (payload.customAttribute !== undefined)
      form.append("customAttribute", JSON.stringify(payload.customAttribute));
    if (hasOwn(payload, "stockRows")) {
      form.append("stockRows", JSON.stringify(payload.stockRows || []));
    }

    const uploadedImages = await uploadAssets(payload.images || [], {
      scope: "products",
    });
    appendAssetList(form, "images", uploadedImages);
    if (payload.imageOrder?.length)
      form.append("imageOrder", toJsonArray(payload.imageOrder));
    if (payload.removeImagePublicIds?.length)
      form.append(
        "removeImagePublicIds",
        toJsonArray(payload.removeImagePublicIds)
      );

    // 🚫 INVENTORY YOK

    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/products/${identifier}${qs}`, {
      method: "PUT",
      body: form,
      auth: true,
    });
    return extractProduct(data);
  },

  async remove(idOrSlug, params = {}) {
    const identifier = normalizeIdOrSlug(idOrSlug);
    if (!identifier) {
      throw new Error(JSON.stringify({ message: "Ürün kimliği bulunamadı" }));
    }
    const qs = toQueryString(params);
    return http(`/products/${identifier}${qs}`, {
      method: "DELETE",
      auth: true,
    });
  },

  async bulkUpdatePrice({ scope, categoryIds, productIds, adjustType, value }) {
    return http("/products/bulk-price", {
      method: "PATCH",
      body: { scope, categoryIds, productIds, adjustType, value },
      auth: true,
    });
  },

  async sets(idOrSlug, lang = DEFAULT_LANG) {
    const identifier = normalizeIdOrSlug(idOrSlug);
    if (!identifier) {
      throw new Error(JSON.stringify({ message: "Ürün kimliği bulunamadı" }));
    }
    const qs = toQueryString({ lang: lang ?? DEFAULT_LANG });
    const data = await http(`/products/${identifier}/sets${qs}`, {
      auth: true,
    });
    return data?.sets || [];
  },
};
