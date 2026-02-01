export function convertArrayToText(value) {
  if (!value) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "string") return value;
  return "";
}

export function splitTextToArray(value) {
  if (!value) return [];
  return String(value)
    .split(/\r?\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length);
}

export function normalizeOptionList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item) => item.length);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter((item) => item.length);
      }
    } catch {
      // fall back to delimiter split
    }
    return trimmed
      .split(/[,;\r?\n]+/)
      .map((item) => item.trim())
      .filter((item) => item.length);
  }
  return [];
}

export function normalizeDetailsList(details) {
  if (!details) return [];
  if (Array.isArray(details)) {
    return details
      .map((item) => String(item).trim())
      .filter((item) => item.length);
  }
  if (typeof details === "string") {
    const trimmed = details.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter((item) => item.length);
      }
    } catch {
      // fall back to newline split
    }
    return trimmed
      .split(/\r?\n+/)
      .map((item) => item.trim())
      .filter((item) => item.length);
  }
  return [];
}

export function buildProductState(product, inventory = []) {
  if (!product) return null;
  const rawId = product.id || product._id || null;
  const id = rawId != null ? String(rawId) : null;
  const normalizedDetails = normalizeDetailsList(product.details);
  const normalizedColors = normalizeOptionList(product.colors);
  const normalizedSizes = normalizeOptionList(product.sizes);
  const customAttr = product.customAttribute || {};
  const normalizedAttrValues = normalizeOptionList(customAttr.values);
  let categoryValue = "";
  if (typeof product.category === "string") {
    categoryValue = product.category;
  } else if (product.category && typeof product.category === "object") {
    categoryValue =
      product.category.id ||
      product.category._id ||
      product.category.value ||
      product.category.slug ||
      "";
  } else if (product.categoryId) {
    categoryValue = product.categoryId;
  }
  if (categoryValue && typeof categoryValue !== "string") {
    categoryValue = String(categoryValue);
  }

  return {
    id,
    slug: product.slug || "",
    name: product.name || "",
    price: product.price ?? "",
    isActive: product.isActive ?? true,
    listedInCatalog: product.listedInCatalog ?? true,
    description: product.description || "",
    careInstructions: product.careInstructions || "",
    details: normalizedDetails,
    colors: normalizedColors,
    sizes: normalizedSizes,
    showColors: product.showColors ?? true,
    showSizes: product.showSizes ?? true,
    customAttribute: {
      title: customAttr.title || "",
      values: normalizedAttrValues,
      show: customAttr.show ?? false,
    },
    category: categoryValue,
    images: product.images || product.media || [],
    translations: product.translations || {},
    inventory,
  };
}

export function createTranslationDrafts(product, langs = []) {
  const base = {};
  langs.forEach(({ value }) => {
    base[value] = {
      name: "",
      description: "",
      careInstructions: "",
      details: "",
      customAttributeTitle: "",
      customAttributeValues: "",
    };
  });

  if (!product) return base;
  const translations = product.translations || {};
  langs.forEach(({ value }) => {
    const t = translations[value] || {};
    const customAttr = t.customAttribute || {};
    base[value] = {
      name: t.name ?? "",
      description: t.description ?? "",
      careInstructions: t.careInstructions ?? "",
      details: convertArrayToText(t.details),
      customAttributeTitle: customAttr.title ?? "",
      customAttributeValues: convertArrayToText(customAttr.values),
    };
  });

  return base;
}

export function createBaseDraft(product) {
  if (!product) return null;
  const customAttr = product.customAttribute || {};
  return {
    name: product.name ?? "",
    description: product.description ?? "",
    careInstructions: product.careInstructions ?? "",
    details: convertArrayToText(product.details),
    customAttributeTitle: customAttr.title ?? "",
    customAttributeValues: convertArrayToText(customAttr.values),
  };
}
