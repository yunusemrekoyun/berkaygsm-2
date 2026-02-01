import { useEffect, useMemo, useState } from "react";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  Loader2,
  AlertCircle,
} from "lucide-react";
import BreadCrumb from "../components/shop/BreadCrumb";
import { contactPageApi, contactMessageApi } from "../api/contact";
import { useStorefrontLang } from "../context/LangContext.jsx";
import { useStaticTranslation } from "../i18n/staticContent.js";

const makeBlock = (title = "", lines = []) => ({
  title,
  lines,
});

const clone = (value) =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

function buildDefaultConfig(copy = {}) {
  const hero = copy.heroFallback || {};
  const blocks = copy.defaultBlocks || {};
  const form = copy.form || {};
  return {
    heroTitle: hero.title || "We're here to help",
    heroSubtitle:
      hero.subtitle ||
      "Our customer care team is available Monday to Friday, 09:00–18:00 CET. Send us a note and we'll respond within one business day.",
    heroImage: null,
    addressBlock: makeBlock(
      blocks.addressTitle || "Visit our European studio",
      blocks.addressLines || [
        "Kurfürstendamm 45, 10719 Berlin",
        "Showroom & click-and-collect (appointment recommended)",
      ]
    ),
    hoursBlock: makeBlock(
      blocks.hoursTitle || "Opening hours (CET)",
      blocks.hoursLines || [
        "Mon – Fri: 09:00 – 18:00",
        "Sat: 10:00 – 16:00 (showroom only)",
        "Sun & public holidays: closed",
      ]
    ),
    emailBlock: makeBlock(
      blocks.emailTitle || "Customer service",
      blocks.emailLines || [
        "support@evimstil.com",
        "Average response time: < 24 h",
      ]
    ),
    phoneBlock: makeBlock(
      blocks.phoneTitle || "Phone",
      blocks.phoneLines || [
        "+49 (0) 30 234 567 89",
        "WhatsApp & Signal available on the same number",
      ]
    ),
    formEnabled: true,
    successMessage:
      form.success ||
      "Thank you for your message. We have received your enquiry and will reply via e-mail shortly. If you need immediate assistance, call us on the number below.",
  };
}

const asString = (value, fallback = "") =>
  value === undefined || value === null ? fallback : String(value);

const mergeBlock = (block, fallback) => {
  const safeFallback =
    fallback && typeof fallback === "object" ? fallback : makeBlock("", []);
  if (!block || typeof block !== "object")
    return makeBlock(safeFallback.title, [...safeFallback.lines]);
  return makeBlock(
    asString(block.title, safeFallback.title),
    Array.isArray(block.lines)
      ? block.lines.map((line) => asString(line))
      : [...safeFallback.lines]
  );
};

const mergeConfig = (raw, defaults) => {
  const base = clone(defaults || {});
  if (!raw) return base;
  const merged = clone(base);
  merged.heroTitle = asString(raw.heroTitle, merged.heroTitle);
  merged.heroSubtitle = asString(raw.heroSubtitle, merged.heroSubtitle);
  merged.formEnabled =
    raw.formEnabled === undefined
      ? merged.formEnabled
      : Boolean(raw.formEnabled);
  merged.successMessage = asString(raw.successMessage, merged.successMessage);
  merged.addressBlock = mergeBlock(raw.addressBlock, base.addressBlock);
  merged.hoursBlock = mergeBlock(raw.hoursBlock, base.hoursBlock);
  merged.emailBlock = mergeBlock(raw.emailBlock, base.emailBlock);
  merged.phoneBlock = mergeBlock(raw.phoneBlock, base.phoneBlock);
  merged.heroImage =
    raw.heroImage && raw.heroImage.url
      ? {
          url: raw.heroImage.url,
          publicId: raw.heroImage.publicId || "",
          width: raw.heroImage.width,
          height: raw.heroImage.height,
          format: raw.heroImage.format,
        }
      : base.heroImage || null;
  return merged;
};

const initialFormState = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: "",
  hp: "",
};

const getErrorMessage = (err) => {
  if (!err) return "Unexpected error";
  if (typeof err === "string") return err;
  if (err.message) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed?.message) return parsed.message;
    } catch {
      /* noop */
    }
    return err.message;
  }
  return String(err);
};

export default function ContactPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const { lang } = useStorefrontLang();
  const t = useStaticTranslation();
  const breadcrumbs = t("breadcrumbs") || {};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const contactCopy = useMemo(() => t("contactPage") || {}, [lang]); // gerekiyorsa [lang, t]
  const formCopy = useMemo(() => contactCopy.form || {}, [contactCopy]);
  const formFields = useMemo(() => formCopy.fields || {}, [formCopy]);
  const baseConfig = useMemo(() => buildDefaultConfig(contactCopy), [lang]);

  const [config, setConfig] = useState(() => mergeConfig(null, baseConfig));
  useEffect(() => {
    setConfig(mergeConfig(null, baseConfig));
  }, [lang]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const response = await contactPageApi.get(lang);
        if (!active) return;
        setConfig(mergeConfig(response, baseConfig));
        setLoadError(null);
      } catch (err) {
        if (!active) return;
        const message = getErrorMessage(err);
        const fallbackMsg = formCopy?.loadError || "";
        setLoadError(message || fallbackMsg);
        setConfig(mergeConfig(null, baseConfig));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [lang]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (submitted) setSubmitted(false);
    if (submitError) setSubmitError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!config.formEnabled || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await contactMessageApi.submit({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        subject: formData.subject,
        message: formData.message,
        hp: formData.hp,
      });
      setSubmitted(true);
      setFormData(initialFormState);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const blockItems = useMemo(
    () => [
      { icon: MapPin, ...config.addressBlock },
      { icon: Clock, ...config.hoursBlock },
      { icon: Mail, ...config.emailBlock },
      { icon: Phone, ...config.phoneBlock },
    ],
    [config]
  );

  return (
    <main className="bg-surface-light/60">
      <section className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6">
        <BreadCrumb
          items={[
            { label: breadcrumbs.home || "Home", to: "/" },
            { label: breadcrumbs.contact || "Contact" },
          ]}
        />
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pb-12 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-white/90 shadow-sm">
          {config.heroImage?.url ? (
            <div className="relative h-60 w-full sm:h-72">
              <img
                src={config.heroImage.url}
                alt={config.heroTitle}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-6 pb-6 text-white sm:px-10">
                <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                  {config.heroTitle}
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-white/80 sm:text-base">
                  {config.heroSubtitle}
                </p>
              </div>
            </div>
          ) : (
            <div className="px-6 pb-6 pt-10 sm:px-10 sm:pt-12">
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
                {config.heroTitle}
              </h1>
              <p className="mt-3 max-w-3xl text-secondary">
                {config.heroSubtitle}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-0">
            <div className="lg:col-span-7 border-t border-border/70 p-6 sm:p-10 lg:border-t-0">
              {loadError ? (
                <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{loadError || formCopy.loadError || ""}</span>
                </div>
              ) : null}

              {submitted ? (
                <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
                  {config.successMessage}
                </div>
              ) : null}

              {!config.formEnabled ? (
                <div className="mb-6 rounded-xl border border-border bg-surface-light/70 p-5 text-sm text-secondary">
                  {formCopy.disabled ||
                    "Our contact form is temporarily unavailable. Please reach us via the email or phone numbers listed on this page."}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    label={formFields.nameLabel || "Full name"}
                    id="contact-name"
                    name="name"
                    required
                    placeholder={formFields.namePlaceholder || "Jane Doe"}
                    value={formData.name}
                    onChange={handleChange}
                    disabled={!config.formEnabled || submitting || loading}
                  />
                  <TextField
                    label={formFields.emailLabel || "Email"}
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    placeholder={
                      formFields.emailPlaceholder || "you@example.com"
                    }
                    value={formData.email}
                    onChange={handleChange}
                    disabled={!config.formEnabled || submitting || loading}
                  />
                </div>
                <TextField
                  label={formFields.phoneLabel || "Phone (optional)"}
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  placeholder={
                    formFields.phonePlaceholder || "+49 170 123 4567"
                  }
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={!config.formEnabled || submitting || loading}
                />
                <TextField
                  label={formFields.subjectLabel || "Subject"}
                  id="contact-subject"
                  name="subject"
                  required
                  placeholder={
                    formFields.subjectPlaceholder || "How can we support you?"
                  }
                  value={formData.subject}
                  onChange={handleChange}
                  disabled={!config.formEnabled || submitting || loading}
                />
                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-sm font-semibold text-primary"
                  >
                    {formFields.messageLabel || "Message"}
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={5}
                    placeholder={
                      formFields.messagePlaceholder ||
                      "Tell us a little more about your question, order or project."
                    }
                    value={formData.message}
                    onChange={handleChange}
                    disabled={!config.formEnabled || submitting || loading}
                    className="mt-2 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
                  />
                </div>

                <input
                  type="text"
                  name="hp"
                  value={formData.hp}
                  onChange={handleChange}
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                  autoComplete="off"
                />

                {submitError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                    {submitError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={!config.formEnabled || submitting || loading}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {formCopy.submitting || "Sending…"}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {formCopy.submit || "Send message"}
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-xs text-secondary">
                {formCopy.policyNote ||
                  "By submitting this form you acknowledge that we will process your data to answer your enquiry in line with our"}{" "}
                <a href="/privacy" className="text-accent underline">
                  {breadcrumbs.privacy || "Privacy Policy"}
                </a>
                .
              </p>
            </div>

            <aside className="lg:col-span-5 border-t border-border/70 bg-contact-bg/70 p-6 sm:p-10 lg:border-l lg:border-t-0">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                {blockItems.map((block, index) => (
                  <ContactBlock
                    key={`${block.title || "block"}-${index}`}
                    icon={block.icon}
                    title={block.title}
                    items={block.lines}
                  />
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function TextField({
  label,
  id,
  name,
  type = "text",
  required = false,
  placeholder,
  value,
  onChange,
  disabled,
}) {
  const inputId = id || name;
  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-sm font-semibold text-primary"
      >
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="mt-2 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
      />
    </div>
  );
}

function ContactBlock({ icon: IconComponent, title, items }) {
  const safeItems = Array.isArray(items) && items.length ? items : ["—"];
  return (
    <div className="rounded-2xl border border-border/70 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 text-primary">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent">
          {IconComponent ? <IconComponent className="h-5 w-5" /> : null}
        </span>
        <h3 className="font-serif text-lg font-semibold">
          {title || "Contact"}
        </h3>
      </div>
      <ul className="mt-4 space-y-1 text-sm text-secondary">
        {safeItems.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
