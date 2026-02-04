export const SUPPORTED_LANGS = ["tr"];
export const DEFAULT_LANG = "tr";

export function normalizeLang(value) {
  if (typeof value !== "string") return DEFAULT_LANG;
  const normalized = value.trim().toLowerCase();
  return SUPPORTED_LANGS.includes(normalized) ? normalized : DEFAULT_LANG;
}

export const TRANSLATION_LANGS = SUPPORTED_LANGS.filter(
  (lang) => lang !== DEFAULT_LANG
).map((lang) => ({
  value: lang,
  label: lang.toUpperCase(),
}));

export const HAS_TRANSLATIONS = TRANSLATION_LANGS.length > 0;
