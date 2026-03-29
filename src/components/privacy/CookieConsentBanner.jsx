"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, BarChart3, X } from "lucide-react";
import { useCookieConsent } from "../../context/CookieConsentContext.jsx";
import { useStaticTranslation } from "../../i18n/staticContent.js";

function SegmentedToggle({ enabled, disabled = false, labels, onChange }) {
  return (
    <div
      className={`inline-flex rounded-full border border-border/80 bg-white/75 p-1 ${
        disabled ? "opacity-80" : ""
      }`}
      role="group"
      aria-label="Analitik çerez tercihi"
    >
      <button
        type="button"
        onClick={disabled ? undefined : () => onChange(false)}
        disabled={disabled}
        aria-pressed={!enabled}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-4 ${
          !enabled
            ? "bg-primary text-white shadow-sm"
            : "text-secondary hover:text-primary"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {labels.inactive}
      </button>
      <button
        type="button"
        onClick={disabled ? undefined : () => onChange(true)}
        disabled={disabled}
        aria-pressed={enabled}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-4 ${
          enabled
            ? "bg-accent text-white shadow-sm"
            : "text-secondary hover:text-accent"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        {labels.active}
      </button>
    </div>
  );
}

export default function CookieConsentBanner() {
  const t = useStaticTranslation();
  const {
    consent,
    hydrated,
    bannerVisible,
    preferencesOpen,
    acceptAll,
    rejectOptional,
    savePreferences,
    closePreferences,
    openPreferences,
  } = useCookieConsent();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  const copy = useMemo(
    () =>
      t("cookieConsent") || {
        title: "Çerez tercihleri",
        description:
          "Zorunlu çerezlerin yanında site performansını ölçmek için analitik çerezler kullanmak istiyoruz. Analitik çerezler yalnızca onayınızla çalışır.",
        hint: "Tercihinizi daha sonra footer'daki Çerez Tercihleri bağlantısından değiştirebilirsiniz.",
        buttons: {
          acceptAll: "Hepsini kabul et",
          rejectAll: "Sadece zorunlu",
          manage: "Tercihleri yönet",
          save: "Seçimi kaydet",
          close: "Kapat",
        },
        categories: {
          necessary: {
            title: "Zorunlu",
            description:
              "Sepet, oturum ve temel sayfa işlevleri için gereklidir. Her zaman aktiftir.",
          },
          analytics: {
            title: "Analitik",
            description:
              "Ziyaret ve kullanım eğilimlerini ölçerek siteyi geliştirmemize yardımcı olur.",
          },
        },
        labels: {
          alwaysActive: "Her zaman aktif",
          active: "Açık",
          inactive: "Kapalı",
        },
        links: {
          privacy: "KVKK ve Gizlilik",
          terms: "Kullanım Koşulları",
        },
      },
    [t]
  );

  useEffect(() => {
    setAnalyticsEnabled(Boolean(consent?.preferences?.analytics));
  }, [consent, preferencesOpen]);

  const isVisible = hydrated && (bannerVisible || preferencesOpen);
  if (!isVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 sm:px-5 sm:pb-5">
      <section
        role="dialog"
        aria-live="polite"
        aria-label={copy.title}
        className="pointer-events-auto mx-auto w-full max-w-5xl rounded-[2rem] border border-border/80 bg-white/76 shadow-[0_24px_60px_rgba(12,74,110,0.16)] backdrop-blur-xl backdrop-saturate-150"
      >
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.95fr)] lg:items-start lg:gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/12 text-accent">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-primary sm:text-lg">
                        {copy.title}
                      </h2>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
                        {copy.description}
                      </p>
                    </div>
                    {preferencesOpen && !bannerVisible ? (
                      <button
                        type="button"
                        onClick={closePreferences}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-white/70 text-secondary transition hover:border-accent/40 hover:text-accent"
                        aria-label={copy.buttons.close}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-secondary/80">
                    {copy.hint}{" "}
                    <a href="/privacy" className="font-medium text-accent underline">
                      {copy.links.privacy}
                    </a>{" "}
                    ·{" "}
                    <a href="/terms" className="font-medium text-accent underline">
                      {copy.links.terms}
                    </a>
                  </p>
                </div>
              </div>

              {preferencesOpen ? (
                <div className="grid gap-3">
                  <article className="glass-surface-soft rounded-[1.5rem] border border-border/80 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-accent" />
                          <h3 className="text-sm font-semibold text-primary">
                            {copy.categories.necessary.title}
                          </h3>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-secondary">
                          {copy.categories.necessary.description}
                        </p>
                      </div>
                      <span className="self-start rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[11px] font-semibold text-accent">
                        {copy.labels.alwaysActive}
                      </span>
                    </div>
                  </article>

                  <article className="glass-surface-soft rounded-[1.5rem] border border-border/80 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-accent" />
                          <h3 className="text-sm font-semibold text-primary">
                            {copy.categories.analytics.title}
                          </h3>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-secondary">
                          {copy.categories.analytics.description}
                        </p>
                      </div>
                      <SegmentedToggle
                        enabled={analyticsEnabled}
                        onChange={setAnalyticsEnabled}
                        labels={copy.labels}
                      />
                    </div>
                  </article>
                </div>
              ) : null}
            </div>

            <div className="flex w-full flex-col gap-2 lg:max-w-[340px] lg:justify-end">
              {!preferencesOpen ? (
                <>
                  <button
                    type="button"
                    onClick={acceptAll}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
                  >
                    {copy.buttons.acceptAll}
                  </button>
                  <button
                    type="button"
                    onClick={rejectOptional}
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-border/80 bg-white/75 px-5 py-3 text-sm font-semibold text-primary transition hover:border-accent/35 hover:text-accent"
                  >
                    {copy.buttons.rejectAll}
                  </button>
                  <button
                    type="button"
                    onClick={openPreferences}
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-border/80 bg-transparent px-5 py-3 text-sm font-semibold text-secondary transition hover:border-accent/35 hover:text-accent"
                  >
                    {copy.buttons.manage}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => savePreferences({ analytics: analyticsEnabled })}
                    className="inline-flex flex-1 items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover"
                  >
                    {copy.buttons.save}
                  </button>
                  <button
                    type="button"
                    onClick={rejectOptional}
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-border/80 bg-white/75 px-5 py-3 text-sm font-semibold text-primary transition hover:border-accent/35 hover:text-accent"
                  >
                    {copy.buttons.rejectAll}
                  </button>
                  <button
                    type="button"
                    onClick={acceptAll}
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-accent/30 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent transition hover:bg-accent/15"
                  >
                    {copy.buttons.acceptAll}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
