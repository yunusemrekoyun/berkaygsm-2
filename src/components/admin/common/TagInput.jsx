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
    if (values.includes(next)) {
      setDraft("");
      return;
    }
    onChange?.([...values, next]);
    setDraft("");
  };

  const removeTag = (value) => {
    onChange?.(values.filter((tag) => tag !== value));
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (["Enter", ",", "Tab"].includes(event.key)) {
      event.preventDefault();
      addTag(draft);
    }
    if (event.key === "Backspace" && !draft && values.length) {
      event.preventDefault();
      removeTag(values[values.length - 1]);
    }
  };

  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-sm font-medium text-[var(--color-text-admin)]">
          {label}
        </span>
      )}
      <div
        className={`flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl border bg-[var(--color-bg-card)] px-3 py-2 transition ${
          disabled
            ? "border-[var(--color-border-admin)]/60 opacity-70"
            : "border-[var(--color-border-admin)] focus-within:border-[var(--color-text-admin)]"
        }`}
      >
        {values.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-hover)] px-3 py-1 text-sm text-[var(--color-text-admin)]"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-[var(--color-text-admin-muted)] hover:text-[var(--color-text-admin)]"
                aria-label={`Remove ${tag}`}
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
    </label>
  );
}
