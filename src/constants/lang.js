export const SUPPORTED_LANGS = ["tr", "en", "de"];
export const DEFAULT_LANG = "tr";

export function normalizeLang(value) {
  if (typeof value !== "string") return DEFAULT_LANG;
  const normalized = value.trim().toLowerCase();
  return SUPPORTED_LANGS.includes(normalized) ? normalized : DEFAULT_LANG;
}
