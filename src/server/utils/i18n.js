export const SUPPORTED_LANGS = ["tr", "en", "de"];
export const DEFAULT_LANG = "tr";

const ID_KEYS = ["_id", "id"];

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;

  // 🔴 ÖNEMLİ: Mongo ObjectId / BSON objelerini "plain object" gibi ele alma
  if (typeof value.toHexString === "function") return false;
  if (value._bsontype === "ObjectID") return false;

  return Object.prototype.toString.call(value) === "[object Object]";
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item));
  }
  if (value instanceof Date) {
    return new Date(value);
  }

  // 🔴 ObjectId ve benzeri BSON objeleri hiç dokunma, referans olarak bırak
  if (
    typeof value?.toHexString === "function" ||
    value?._bsontype === "ObjectID"
  ) {
    return value;
  }

  if (isPlainObject(value)) {
    const out = {};
    Object.keys(value).forEach((key) => {
      out[key] = cloneValue(value[key]);
    });
    return out;
  }
  return value;
}

function mergeArray(baseValue, sourceValue) {
  if (!Array.isArray(sourceValue)) return baseValue;
  if (!Array.isArray(baseValue)) return cloneValue(sourceValue);
  if (!sourceValue.length) return baseValue;
  if (!baseValue.length) return cloneValue(sourceValue);

  const baseIsObject = baseValue.every((item) => isPlainObject(item));
  const sourceIsObject = sourceValue.every((item) => isPlainObject(item));

  if (baseIsObject && sourceIsObject) {
    const sourceById = new Map();
    sourceValue.forEach((item, index) => {
      let key;
      for (const idKey of ID_KEYS) {
        if (item && item[idKey] != null) {
          key = String(item[idKey]);
          break;
        }
      }
      if (key) {
        sourceById.set(key, item);
      } else {
        sourceById.set(`__idx_${index}`, item);
      }
    });

    return baseValue.map((item, index) => {
      const cloned = cloneValue(item);
      let candidate = null;
      for (const idKey of ID_KEYS) {
        if (item && item[idKey] != null) {
          candidate = sourceById.get(String(item[idKey]));
          if (candidate) break;
        }
      }
      if (!candidate) {
        candidate = sourceById.get(`__idx_${index}`);
      }
      if (!candidate) return cloned;
      return mergeLocalized(cloned, candidate);
    });
  }

  return cloneValue(sourceValue);
}

function mergeLocalized(target, source) {
  if (!isPlainObject(source)) return target;

  Object.keys(source).forEach((key) => {
    if (key === "translations") return;
    const sourceValue = source[key];
    if (sourceValue === undefined) return;

    const targetValue = target[key];
    if (Array.isArray(sourceValue)) {
      target[key] = mergeArray(
        Array.isArray(targetValue) ? targetValue : [],
        sourceValue
      );
      return;
    }
    if (isPlainObject(sourceValue)) {
      if (isPlainObject(targetValue)) {
        target[key] = mergeLocalized(cloneValue(targetValue), sourceValue);
      } else {
        target[key] = mergeLocalized({}, sourceValue);
      }
      return;
    }
    target[key] = sourceValue;
  });

  return target;
}

export function normalizeLang(lang) {
  if (typeof lang !== "string") return DEFAULT_LANG;
  const lower = lang.trim().toLowerCase();
  return SUPPORTED_LANGS.includes(lower) ? lower : DEFAULT_LANG;
}

export function resolveTranslation(doc, lang = DEFAULT_LANG) {
  if (!doc) return doc;
  const base =
    typeof doc.toObject === "function"
      ? doc.toObject({ virtuals: true })
      : cloneValue(doc);

  const translations = cloneValue(base.translations || {});
  const fallback = translations[DEFAULT_LANG] || {};
  const requestedLang = normalizeLang(lang);
  const localized = translations[requestedLang] || {};

  const merged = mergeLocalized(cloneValue(base), fallback);
  const withPreferred = mergeLocalized(merged, localized);
  withPreferred.translations = translations;
  return withPreferred;
}

export function resolveMany(docs, lang = DEFAULT_LANG) {
  if (!Array.isArray(docs)) return [];
  return docs.map((doc) => resolveTranslation(doc, lang));
}

export function mergeIncomingTranslations(existing = {}, incoming = {}) {
  const result = cloneValue(existing || {});
  if (!isPlainObject(incoming)) return result;

  Object.keys(incoming).forEach((langKey) => {
    const normalized = normalizeLang(langKey);
    if (!SUPPORTED_LANGS.includes(normalized)) return;
    const existingLang = result[normalized] || {};
    result[normalized] = mergeLocalized(
      cloneValue(existingLang),
      incoming[langKey]
    );
  });

  return result;
}

export function pickLocalizedPayload(body = {}) {
  if (!isPlainObject(body)) return {};
  let incoming = body.translations;
  if (typeof incoming === "string") {
    try {
      incoming = JSON.parse(incoming);
    } catch {
      incoming = null;
    }
  }
  if (!isPlainObject(incoming)) return {};
  return incoming;
}

export function syncDocTranslations(
  doc,
  incomingTranslations,
  buildTrSnapshot,
  applyTrUpdate
) {
  const normalizedIncoming = isPlainObject(incomingTranslations)
    ? incomingTranslations
    : {};

  if (
    typeof applyTrUpdate === "function" &&
    isPlainObject(normalizedIncoming[DEFAULT_LANG])
  ) {
    applyTrUpdate(doc, normalizedIncoming[DEFAULT_LANG]);
  }

  const baseTranslations =
    doc?.translations?.toObject?.() ?? doc?.translations ?? {};

  const merged = mergeIncomingTranslations(
    baseTranslations,
    normalizedIncoming
  );

  const finalTranslations = mergeIncomingTranslations(merged, {
    [DEFAULT_LANG]: buildTrSnapshot(doc),
  });

  if (typeof doc?.set === "function") {
    doc.set("translations", finalTranslations, { strict: false });
  } else {
    doc.translations = finalTranslations;
  }

  return finalTranslations;
}

export function composeResponseTranslations(doc, buildTrSnapshot) {
  const baseTranslations =
    doc?.translations?.toObject?.() ?? doc?.translations ?? {};
  return mergeIncomingTranslations(baseTranslations, {
    [DEFAULT_LANG]: buildTrSnapshot(doc),
  });
}
