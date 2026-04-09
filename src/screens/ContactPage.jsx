"use client";

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
import AppImage from "../components/ui/AppImage.jsx";
import TurnstileWidget from "../components/ui/TurnstileWidget.jsx";
import {
  formatTrPhoneForInput,
  formatTrPhoneForSubmit,
} from "../utils/phoneMask.js";
import {
  OFFICIAL_ADDRESS,
  OFFICIAL_ADDRESS_NOTE,
  OFFICIAL_PHONE,
  OFFICIAL_PHONE_NOTE,
  OFFICIAL_SUPPORT_EMAIL,
  OFFICIAL_SUPPORT_RESPONSE_NOTE,
} from "../config/siteContact.js";

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

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
    heroTitle: hero.title || "Size yardımcı olmak için buradayız",
    heroSubtitle:
      hero.subtitle ||
      "Müşteri hizmetlerimiz hafta içi 09:00–18:00 arasında hizmet verir. Mesaj bırakın, en kısa sürede dönüş yapalım.",
    heroImage: null,
    addressBlock: makeBlock(
      blocks.addressTitle || "Mağazamızı ziyaret edin",
      blocks.addressLines || [OFFICIAL_ADDRESS, OFFICIAL_ADDRESS_NOTE]
    ),
    hoursBlock: makeBlock(
      blocks.hoursTitle || "Çalışma saatleri",
      blocks.hoursLines || [
        "Pzt – Cum: 09:00 – 18:00",
        "Cmt: 10:00 – 16:00",
        "Paz ve resmi tatiller: kapalı",
      ]
    ),
    emailBlock: makeBlock(
      blocks.emailTitle || "Müşteri hizmetleri",
      blocks.emailLines || [OFFICIAL_SUPPORT_EMAIL, OFFICIAL_SUPPORT_RESPONSE_NOTE]
    ),
    phoneBlock: makeBlock(
      blocks.phoneTitle || "Telefon",
      blocks.phoneLines || [OFFICIAL_PHONE, OFFICIAL_PHONE_NOTE]
    ),
    formEnabled: true,
    security: { captchaEnabled: false },
    successMessage:
      form.success ||
      "Mesajınız için teşekkürler. Talebinizi aldık, en kısa sürede e‑posta ile dönüş yapacağız. Acil durumlarda aşağıdaki numaradan bize ulaşabilirsiniz.",
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
  merged.security = {
    captchaEnabled: Boolean(raw?.security?.captchaEnabled),
  };
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
  if (!err) return "Beklenmeyen hata";
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
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetCounter, setCaptchaResetCounter] = useState(0);
  const { lang } = useStorefrontLang();
  const t = useStaticTranslation();
  const breadcrumbs = t("breadcrumbs") || {};
  const contactCopy = useMemo(() => t("contactPage") || {}, [t]);
  const formCopy = useMemo(() => contactCopy.form || {}, [contactCopy]);
  const formFields = useMemo(() => formCopy.fields || {}, [formCopy]);
  const baseConfig = useMemo(
    () => buildDefaultConfig(contactCopy),
    [contactCopy]
  );

  const [config, setConfig] = useState(() => mergeConfig(null, baseConfig));
  useEffect(() => {
    setConfig(mergeConfig(null, baseConfig));
  }, [baseConfig]);

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
        setLoadError(message);
        setConfig(mergeConfig(null, baseConfig));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [lang, baseConfig]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "phone" ? formatTrPhoneForInput(value) : value,
    }));
    if (submitted) setSubmitted(false);
    if (submitError) setSubmitError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!config.formEnabled || submitting) return;
    if (config.security?.captchaEnabled && !captchaToken) {
      setSubmitError("Lütfen doğrulama adımını tamamlayın.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await contactMessageApi.submit({
        name: formData.name,
        email: formData.email,
        phone: formatTrPhoneForSubmit(formData.phone),
        subject: formData.subject,
        message: formData.message,
        hp: formData.hp,
        turnstileToken: captchaToken,
      });
      setSubmitted(true);
      setFormData(initialFormState);
      setCaptchaToken("");
      setCaptchaResetCounter((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(getErrorMessage(err));
      setCaptchaToken("");
      setCaptchaResetCounter((prev) => prev + 1);
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
    <main className="store-page bg-surface-light/60">
      <section className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6">
        <BreadCrumb
          items={[
            { label: breadcrumbs.home || "Ana Sayfa", to: "/" },
            { label: breadcrumbs.contact || "İletişim" },
          ]}
        />
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pb-12 sm:px-6">
        <div className="glass-surface overflow-hidden rounded-2xl border border-border bg-white/90 shadow-sm">
          {config.heroImage?.url ? (
            <div className="relative h-60 w-full sm:h-72">
              <AppImage
                src={config.heroImage.url}
                alt={config.heroTitle}
                fill
                sizes="(max-width: 640px) 100vw, 1400px"
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
                <div className="glass-surface-soft mb-6 rounded-xl border border-border bg-surface-light/70 p-5 text-sm text-secondary">
                  {formCopy.disabled ||
                    "İletişim formu geçici olarak kullanılamıyor. Bu sayfadaki e‑posta veya telefon üzerinden bize ulaşabilirsiniz."}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    label={formFields.nameLabel || "Ad Soyad"}
                    id="contact-name"
                    name="name"
                    required
                    placeholder={formFields.namePlaceholder || "Ayla Yılmaz"}
                    value={formData.name}
                    onChange={handleChange}
                    disabled={!config.formEnabled || submitting || loading}
                  />
                  <TextField
                    label={formFields.emailLabel || "E-posta"}
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    placeholder={
                      formFields.emailPlaceholder || "ornek@eposta.com"
                    }
                    value={formData.email}
                    onChange={handleChange}
                    disabled={!config.formEnabled || submitting || loading}
                  />
                </div>
                <TextField
                  label={formFields.phoneLabel || "Telefon (opsiyonel)"}
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder={
                    formFields.phonePlaceholder || "+90 5xx xxx xx xx"
                  }
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={!config.formEnabled || submitting || loading}
                />
                <TextField
                  label={formFields.subjectLabel || "Konu"}
                  id="contact-subject"
                  name="subject"
                  required
                  placeholder={
                    formFields.subjectPlaceholder || "Size nasıl yardımcı olabiliriz?"
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
                    {formFields.messageLabel || "Mesaj"}
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={5}
                    placeholder={
                      formFields.messagePlaceholder ||
                      "Sorunuz, siparişiniz veya talebiniz hakkında kısaca bilgi verin."
                    }
                    value={formData.message}
                    onChange={handleChange}
                    disabled={!config.formEnabled || submitting || loading}
                    className="glass-input mt-2 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
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

                {config.security?.captchaEnabled ? (
                  <TurnstileWidget
                    siteKey={TURNSTILE_SITE_KEY}
                    resetSignal={captchaResetCounter}
                    onTokenChange={(token) => {
                      setCaptchaToken(token);
                      if (submitError) setSubmitError(null);
                    }}
                    onError={(message) => {
                      setCaptchaToken("");
                      setSubmitError(message);
                    }}
                  />
                ) : null}

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
                      {formCopy.submitting || "Gönderiliyor…"}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {formCopy.submit || "Mesajı gönder"}
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-xs text-secondary">
                {formCopy.policyNote ||
                  "Bu formu göndererek talebinizi yanıtlamak için verilerinizi politikamız doğrultusunda işleyeceğimizi kabul etmiş olursunuz."}{" "}
                <a href="/privacy" className="text-accent underline">
                  {breadcrumbs.privacy || "Gizlilik Politikası"}
                </a>
                .
              </p>
            </div>

            <aside className="glass-surface-soft lg:col-span-5 border-t border-border/70 bg-contact-bg/70 p-6 sm:p-10 lg:border-l lg:border-t-0">
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
  inputMode,
  autoComplete,
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
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="glass-input mt-2 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
      />
    </div>
  );
}

function ContactBlock({ icon: IconComponent, title, items }) {
  const safeItems = Array.isArray(items) && items.length ? items : ["—"];
  return (
    <div className="glass-surface rounded-2xl border border-border/70 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 text-primary">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent">
          {IconComponent ? <IconComponent className="h-5 w-5" /> : null}
        </span>
        <h3 className="font-serif text-lg font-semibold">
          {title || "İletişim"}
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
