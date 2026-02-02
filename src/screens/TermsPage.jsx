// src/pages/TermsPage.jsx
import { useEffect, useState, useMemo } from "react";
import BreadCrumb from "../components/shop/BreadCrumb";
import { termsApi } from "../api/terms";
import { useStorefrontLang } from "../context/LangContext.jsx";

export default function TermsPage() {
  const [data, setData] = useState(null); // { heroTitle, heroIntro, sections, footerNote, isActive }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { lang } = useStorefrontLang();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const res = await termsApi.public(lang); // GET /terms
        if (!mounted) return;
        setData(safeIncoming(res));
        setError("");
      } catch (e) {
        if (!mounted) return;
        setError(extractMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lang]);

  // Fallback başlık/intro — stil korunur
  const title = useMemo(
    () =>
      data?.heroTitle?.trim() ? data.heroTitle.trim() : "Terms of Service",
    [data]
  );
  const intro =
    data?.heroIntro?.trim() ||
    "Please read these terms carefully before placing an order. They outline your rights and obligations when shopping with Berkay GSM.";
  const sections = Array.isArray(data?.sections) ? data.sections : [];
  const footerNote =
    typeof data?.footerNote === "string" && data.footerNote.trim()
      ? data.footerNote
      : "Last updated: 8 October 2025. We may revise these terms from time to time. The version displayed here is always the most current.";
  const isActive = data?.isActive !== false; // kayıt yoksa aktif varsay

  return (
    <main className="bg-surface-light/60">
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pt-6">
        <BreadCrumb
          items={[{ label: "Home", to: "/" }, { label: "Terms of Service" }]}
        />
      </section>

      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-14">
        <div className="rounded-2xl border border-border bg-white/90 p-8 sm:p-12 shadow-sm">
          {/* Header */}
          <header className="text-center">
            {loading ? (
              <>
                <div className="mx-auto h-10 w-72 max-w-full animate-pulse rounded bg-surface" />
                <div className="mx-auto mt-3 h-5 w-[620px] max-w-full animate-pulse rounded bg-surface" />
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

          {/* Body */}
          <div className="mt-10 space-y-8">
            {loading ? (
              // Basit skeleton
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="h-6 w-64 animate-pulse rounded bg-surface" />
                  <div className="h-4 w-full animate-pulse rounded bg-surface" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-surface" />
                </div>
              ))
            ) : !isActive ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
                The Terms of Service page is currently not active.
              </div>
            ) : sections.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-6 text-center text-secondary">
                No Terms content yet.
              </div>
            ) : (
              sections.map((section, si) => (
                <SectionBlock
                  key={section.id || section.title || si}
                  section={section}
                />
              ))
            )}
          </div>

          {/* Footer Note */}
          <footer className="mt-10 rounded-2xl border border-border bg-contact-bg/70 p-6 text-sm text-secondary">
            {loading ? (
              <div className="h-4 w-72 animate-pulse rounded bg-surface" />
            ) : (
              footerNote
            )}
          </footer>
        </div>
      </section>
    </main>
  );
}

/** ---------- Item renderer ---------- */
function SectionBlock({ section }) {
  const title = section?.title?.trim() || "Untitled section";
  const paragraphs = Array.isArray(section?.paragraphs)
    ? section.paragraphs
    : [];
  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold text-primary">
        {title}
      </h2>
      {(paragraphs.length ? paragraphs : [""]).map((text, idx) => (
        <p key={idx} className="mt-3 text-secondary">
          {String(text || "").trim()}
        </p>
      ))}
    </section>
  );
}

/** ---------- Helpers ---------- */
function safeIncoming(doc) {
  // Backend'in döndürdüğü terms objesini güvenli hale getir
  if (!doc) return null;
  return {
    heroTitle: String(doc.heroTitle ?? "").trim(),
    heroIntro: String(doc.heroIntro ?? "").trim(),
    sections: Array.isArray(doc.sections)
      ? doc.sections.map((s) => ({
          id: s?.id,
          title: String(s?.title ?? "").trim(),
          paragraphs: Array.isArray(s?.paragraphs)
            ? s.paragraphs.map((p) => String(p ?? ""))
            : [],
        }))
      : [],
    footerNote: String(doc.footerNote ?? ""),
    isActive: doc.isActive !== false,
    seo: {
      title: String(doc?.seo?.title ?? ""),
      description: String(doc?.seo?.description ?? ""),
      keywords: Array.isArray(doc?.seo?.keywords) ? doc.seo.keywords : [],
    },
  };
}

function extractMessage(err) {
  if (!err) return "Unexpected error";
  try {
    const parsed = JSON.parse(String(err.message || err));
    if (parsed?.message) return parsed.message;
  } catch {
    // ignore
  }
  return err.message || String(err);
}
