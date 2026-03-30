// src/pages/ShippingReturnsPage.jsx
import { useEffect, useMemo, useState } from "react";
import BreadCrumb from "../components/shop/BreadCrumb";
import { shippingReturnsApi } from "../api/shippingReturns";
import { useStorefrontLang } from "../context/LangContext.jsx";
import { OFFICIAL_SUPPORT_EMAIL } from "../config/siteContact.js";
import { replaceLegacyContactText } from "../utils/officialContactText.js";
import { sanitizeRichHtml } from "../utils/sanitizeHtml.js";

export default function ShippingReturnsPage() {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const { lang } = useStorefrontLang();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const data = await shippingReturnsApi.get(lang);
        if (!mounted) return;
        setPage(normalize(data));
        setErr(null);
      } catch (e) {
        if (!mounted) return;
        setErr(extractMessage(e) || "Kargo & İade sayfası yüklenemedi.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lang]);

  const heroTitle = useMemo(
    () => page?.heroTitle || "Kargo & İade",
    [page]
  );
  const heroSubtitle = useMemo(
    () =>
      page?.heroSubtitle ||
      "Şeffaf teslimat süreleri, kolay iade ve zahmetsiz değişim süreçleri.",
    [page]
  );

  return (
    <main className="store-page bg-surface-light/60">
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pt-6">
        <BreadCrumb
          items={[{ label: "Ana Sayfa", to: "/" }, { label: "Kargo & İade" }]}
        />
      </section>

      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-14">
        <div className="glass-surface rounded-2xl border border-border bg-white/90 p-8 sm:p-12 shadow-sm">
          {/* Error / inactive */}
          {err ? (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm">
              {err}
            </div>
          ) : null}
          {page && page.isActive === false ? (
            <header className="mb-4 text-center">
              <h1 className="font-serif text-4xl font-extrabold tracking-tight text-primary">
                {heroTitle}
              </h1>
              <p className="mt-3 text-secondary">
                Bu sayfa şu anda kullanılamıyor.
              </p>
            </header>
          ) : null}

          {/* Header */}
          {!err && (
            <header className="text-center">
              <h1 className="font-serif text-4xl font-extrabold tracking-tight text-primary">
                {heroTitle}
              </h1>
              <p className="mt-3 text-secondary">{heroSubtitle}</p>
            </header>
          )}

          {/* Skeleton */}
          {loading ? (
            <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-7 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-2xl bg-surface-hover"
                  />
                ))}
              </div>
              <aside className="lg:col-span-5">
                <div className="h-72 animate-pulse rounded-2xl bg-surface-hover" />
              </aside>
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
              {/* Left content (sections) */}
              <article className="lg:col-span-7 space-y-8">
                {(page?.sections || []).length ? (
                  page.sections.map((s, idx) => (
                    <Section
                      key={`${s.title}-${idx}`}
                      title={s.title}
                      paragraphs={s.paragraphs}
                      list={s.list?.items?.length ? s.list : null}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-secondary">
                    Henüz içerik yok.
                  </div>
                )}
              </article>

              {/* Sidebar */}
              <aside className="lg:col-span-5">
                <div className="glass-surface-soft space-y-6 rounded-2xl border border-border bg-contact-bg/80 p-6 sm:p-8">
                  <h2 className="font-serif text-2xl font-semibold text-primary">
                    Hızlı bilgiler
                  </h2>
                  <ul className="space-y-4 text-sm text-secondary">
                    {(page?.sidebar?.quickFacts || []).length ? (
                      page.sidebar.quickFacts.map((item, i) => (
                        <li key={`${item}-${i}`}>• {item}</li>
                      ))
                    ) : (
                      <li className="text-secondary/70">Hızlı bilgi yok.</li>
                    )}
                  </ul>

                  <div
                    className="glass-surface-soft rounded-2xl border border-border/70 bg-white p-5 text-sm text-secondary"
                    // Yardım kutusu HTML destekli geliyor (admin sayfasında yazılıyor)
                    dangerouslySetInnerHTML={{
                      __html:
                        sanitizeRichHtml(
                          replaceLegacyContactText(page?.sidebar?.helpBoxHtml || "")
                        ) ||
                        `Desteğe mi ihtiyacınız var? <a href="mailto:${OFFICIAL_SUPPORT_EMAIL}" class="text-accent underline">${OFFICIAL_SUPPORT_EMAIL}</a> adresinden bize ulaşabilirsiniz.`,
                    }}
                  />
                </div>
              </aside>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Section({ title, paragraphs = [], list }) {
  return (
    <section>
      {title ? (
        <h2 className="font-serif text-xl font-semibold text-primary">
          {title}
        </h2>
      ) : null}
      {(paragraphs || []).map((text, i) => (
        <p key={`${text}-${i}`} className="mt-3 text-secondary">
          {text}
        </p>
      ))}
      {list ? (
        <div className="glass-surface-soft mt-4 rounded-2xl border border-border bg-surface-light p-4 text-sm text-secondary">
          {list.heading ? (
            <p className="font-medium text-primary">{list.heading}</p>
          ) : null}
          <ul className="mt-2 space-y-2">
            {(list.items || []).map((item, i) => (
              <li key={`${item}-${i}`}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/* ---------- utils ---------- */
function normalize(data) {
  const safe = { ...(data || {}) };
  safe.heroTitle = String(safe.heroTitle || "");
  safe.heroSubtitle = String(safe.heroSubtitle || "");
  safe.sections = Array.isArray(safe.sections) ? safe.sections : [];
  safe.sidebar = {
    quickFacts: Array.isArray(safe.sidebar?.quickFacts)
      ? safe.sidebar.quickFacts
      : [],
    helpBoxHtml: sanitizeRichHtml(String(safe.sidebar?.helpBoxHtml || "")),
  };
  safe.isActive = Boolean(safe.isActive ?? true);
  return safe;
}

function extractMessage(error) {
  if (!error) return "";
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return parsed.message;
    } catch {
      // ignore
    }
    return error.message;
  }
  return String(error);
}
