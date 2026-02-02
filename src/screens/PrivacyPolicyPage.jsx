// src/pages/PrivacyPolicyPage.jsx
import { useEffect, useMemo, useState } from "react";
import BreadCrumb from "../components/shop/BreadCrumb";
import { privacyApi } from "../api/privacy";
import { useStorefrontLang } from "../context/LangContext.jsx";

export default function PrivacyPolicyPage() {
  const [data, setData] = useState(null); // { heroTitle, heroIntro, sections, footerHtml, seo, isActive }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { lang } = useStorefrontLang();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const res = await privacyApi.public(lang); // GET /privacy
        if (!mounted) return;
        setData(normalizeIncoming(res));
        setError("");
      } catch (e) {
        if (!mounted) return;
        setError(extractMessage(e) || "Failed to load privacy policy.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lang]);

  const title = data?.heroTitle || "Privacy Policy";
  const intro =
    data?.heroIntro ||
    "Your privacy matters. This policy explains how we process personal data in compliance with the EU General Data Protection Regulation (GDPR).";
  const sections = useMemo(
    () => (Array.isArray(data?.sections) ? data.sections : []),
    [data]
  );
  const isActive = data?.isActive !== false;

  return (
    <main className="bg-surface-light/60">
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pt-6">
        <BreadCrumb
          items={[{ label: "Home", to: "/" }, { label: "Privacy Policy" }]}
        />
      </section>

      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-14">
        <div className="rounded-2xl border border-border bg-white/90 p-8 sm:p-12 shadow-sm">
          {/* ----- Header ----- */}
          <header className="text-center">
            {loading ? (
              <>
                <div className="mx-auto h-9 w-72 max-w-full animate-pulse rounded bg-surface" />
                <div className="mx-auto mt-3 h-5 w-[680px] max-w-full animate-pulse rounded bg-surface" />
              </>
            ) : error ? (
              <div className="mx-auto max-w-2xl rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
                {error}
              </div>
            ) : (
              <>
                <h1 className="font-serif text-4xl font-extrabold tracking-tight text-primary">
                  {title}
                </h1>
                <p className="mt-3 text-secondary">{intro}</p>
              </>
            )}
          </header>

          {/* ----- TOC (İçindekiler) ----- */}
          <nav className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={`sk-${i}`}
                    className="h-9 rounded-2xl border border-border bg-surface-light"
                  />
                ))
              : sections.map((section) => (
                  <a
                    key={section.id || section.title}
                    href={`#${slugify(section.id || section.title)}`}
                    className="rounded-2xl border border-border bg-surface-light px-4 py-3 text-primary transition hover:border-accent hover:bg-white"
                  >
                    {section.title}
                  </a>
                ))}
          </nav>

          {/* ----- Body ----- */}
          <div className="mt-10 space-y-10">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={`body-skel-${i}`}>
                  <div className="h-6 w-72 max-w-full animate-pulse rounded bg-surface" />
                  <div className="mt-3 h-4 w-full animate-pulse rounded bg-surface" />
                  <div className="mt-2 h-4 w-10/12 animate-pulse rounded bg-surface" />
                  <div className="mt-2 h-4 w-8/12 animate-pulse rounded bg-surface" />
                </div>
              ))
            ) : !isActive ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
                Privacy policy page is currently not active.
              </div>
            ) : sections.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center text-secondary">
                No privacy content yet.
              </div>
            ) : (
              sections.map((section) => {
                const id = slugify(section.id || section.title);
                return (
                  <section key={id} id={id}>
                    <h2 className="font-serif text-2xl font-semibold text-primary">
                      {section.title}
                    </h2>
                    {(section.content || []).map((paragraph, idx) => (
                      <p key={`${id}-p-${idx}`} className="mt-3 text-secondary">
                        {paragraph}
                      </p>
                    ))}
                  </section>
                );
              })
            )}
          </div>

          {/* ----- Footer Box (HTML destekli) ----- */}
          {loading ? (
            <div className="mt-12 h-24 rounded-2xl border border-border bg-surface" />
          ) : data?.footerHtml ? (
            <footer className="mt-12 rounded-2xl border border-border bg-contact-bg/70 p-6 text-sm text-secondary">
              <div
                dangerouslySetInnerHTML={{ __html: safeHtml(data.footerHtml) }}
              />
            </footer>
          ) : (
            <footer className="mt-12 rounded-2xl border border-border bg-contact-bg/70 p-6 text-sm text-secondary">
              If you have questions about this policy or wish to exercise your
              data protection rights, e-mail us at{" "}
              <a
                href="mailto:privacy@berkaygsm.com"
                className="text-accent underline"
              >
                privacy@berkaygsm.com
              </a>{" "}
              or write to Berkay GSM GmbH, Kurfürstendamm 45, 10719
              Berlin, Germany.
            </footer>
          )}
        </div>
      </section>
    </main>
  );
}

/* ----------------- Helpers ----------------- */

function normalizeIncoming(v) {
  const d = v?.privacy || v || {};
  return {
    heroTitle: String(d.heroTitle || ""),
    heroIntro: String(d.heroIntro || ""),
    sections: Array.isArray(d.sections)
      ? d.sections.map((s) => ({
          id: String(s.id || s.title || "").trim(),
          title: String(s.title || "Untitled").trim(),
          content: Array.isArray(s.content)
            ? s.content.map((p) => String(p || ""))
            : [],
        }))
      : [],
    footerHtml: String(d.footerHtml || ""),
    seo: {
      title: String(d?.seo?.title || ""),
      description: String(d?.seo?.description || ""),
      keywords: Array.isArray(d?.seo?.keywords) ? d.seo.keywords : [],
    },
    isActive: d.isActive !== false,
  };
}

function extractMessage(err) {
  if (!err) return "";
  try {
    const parsed = JSON.parse(String(err.message || err));
    if (parsed?.message) return parsed.message;
  } catch {
    // ignore
  }
  return err.message || String(err);
}

function slugify(s = "") {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Basit HTML temizliği (link’lere rel ekler; script/style vb. yoksa yeterli).
 * Eğer daha sıkı güvenlik istiyorsan sunucuda sanitize et.
 */
function safeHtml(html) {
  if (!html) return "";
  // target blank linkler güvenli olsun:
  return String(html).replaceAll(
    /<a\s/gi,
    '<a rel="noopener noreferrer nofollow" target="_blank" '
  );
}
