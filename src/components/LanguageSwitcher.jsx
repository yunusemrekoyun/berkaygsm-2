import { useCallback } from "react";
import { useStorefrontLang } from "../context/LangContext.jsx";

const OPTIONS = [
  { value: "tr", label: "TR" },
  { value: "en", label: "EN" },
  { value: "de", label: "DE" },
];

export default function LanguageSwitcher({
  className = "",
  hideText = false,
  label = "Dil",
}) {
  const { lang, setLang } = useStorefrontLang();

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
