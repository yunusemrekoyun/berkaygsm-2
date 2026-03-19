import { useState } from "react";
import { X } from "lucide-react";

export default function TagInput({
  label,
  values = [],
  onChange,
  placeholder = "",
  disabled = false,
  helper,
  id,
}) {
  const [draft, setDraft] = useState("");

  const normalisedId = id || `tag-input-${label?.replace(/\s+/g, "-") ?? "field"}`;

  const addTag = (value) => {
    const next = value.trim();
    if (!next) return;
    if (values.some((tag) => tag.toLowerCase() === next.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange?.([...values, next]);
    setDraft("");
  };

  const removeTagAt = (index) => {
    onChange?.(values.filter((_, valueIndex) => valueIndex !== index));
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (["Enter", ",", "Tab"].includes(event.key)) {
      event.preventDefault();
      addTag(draft);
    }
    if (event.key === "Backspace" && !draft && values.length) {
      event.preventDefault();
      removeTagAt(values.length - 1);
    }
  };

  return (
    <div className="block">
      {label && (
        <label
          htmlFor={normalisedId}
          className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]"
        >
          {label}
        </label>
      )}
      <div
        className={`flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl border bg-[var(--color-bg-card)] px-3 py-2 transition ${
          disabled
            ? "border-[var(--color-border-admin)]/60 opacity-70"
            : "border-[var(--color-border-admin)] focus-within:border-[var(--color-text-admin)]"
        }`}
      >
        {values.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-hover)] px-3 py-1 text-sm text-[var(--color-text-admin)]"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeTagAt(index);
                }}
                className="text-[var(--color-text-admin-muted)] hover:text-[var(--color-text-admin)]"
                aria-label={`${tag} etiketini kaldır`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
        <input
          id={normalisedId}
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (!disabled) addTag(draft);
          }}
          placeholder={values.length ? "" : placeholder}
          className="flex-1 min-w-[120px] border-0 bg-transparent text-sm text-[var(--color-text-admin)] outline-none placeholder:text-[var(--color-text-admin-muted)]"
        />
      </div>
      {helper && (
        <p className="mt-1 text-xs text-[var(--color-text-admin-muted)]">{helper}</p>
      )}
    </div>
  );
}
