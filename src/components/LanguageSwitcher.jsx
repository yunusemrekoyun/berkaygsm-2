import { useCallback } from "react";
import { useStorefrontLang } from "../context/LangContext.jsx";
import { SUPPORTED_LANGS } from "../constants/lang.js";

const OPTIONS = SUPPORTED_LANGS.map((value) => ({
  value,
  label: value.toUpperCase(),
}));

export default function LanguageSwitcher({
  className = "",
  hideText = false,
  label = "Dil",
}) {
  const { lang, setLang } = useStorefrontLang();
  if (SUPPORTED_LANGS.length <= 1) return null;

  const onChange = useCallback(
    (event) => {
      setLang(event.target.value);
    },
    [setLang]
  );

  return (
    <label
      className={[
        "inline-flex items-center gap-2 rounded-full border border-border/60 bg-white px-3 py-1.5 text-xs font-medium text-secondary shadow-sm transition",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={
          hideText ? "sr-only" : "hidden sm:inline text-secondary/70"
        }
      >
        {label}
      </span>
      <select
        value={lang}
        onChange={onChange}
        className="cursor-pointer border-none bg-transparent text-xs font-semibold uppercase outline-none focus:ring-0"
        aria-label="İçerik dili seçin"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
