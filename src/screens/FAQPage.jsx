// src/pages/FAQPage.jsx
import { useEffect, useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import BreadCrumb from "../components/shop/BreadCrumb";
import { faqApi } from "../api/faq";
import { useStorefrontLang } from "../context/LangContext.jsx";

export default function FAQPage() {
  const [data, setData] = useState(null); // { heroTitle, heroIntro, sections: [...], isActive }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { lang } = useStorefrontLang();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const res = await faqApi.public(lang); // GET /faq
        if (!mounted) return;
        setData(res || null);
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

  const title = data?.heroTitle?.trim() || "Sıkça Sorulan Sorular";
  const intro = data?.heroIntro?.trim() || "";
  const sections = Array.isArray(data?.sections) ? data.sections : [];
  const isActive = data?.isActive !== false; // undefined ise aktif say

  return (
    <main className="store-page bg-surface-light/60">
      <section className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6">
        <BreadCrumb items={[{ label: "Ana Sayfa", to: "/" }, { label: "SSS" }]} />
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pb-14 sm:px-6">
        <div className="glass-surface rounded-2xl border border-border bg-white/90 p-8 shadow-sm sm:p-12">
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent">
              <HelpCircle className="h-6 w-6" />
            </span>

            {/* Loading / Error / Title */}
            {loading ? (
              <>
                <div className="h-8 w-72 animate-pulse rounded bg-surface" />
                <div className="mt-3 h-5 w-[600px] max-w-full animate-pulse rounded bg-surface" />
              </>
            ) : error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
                {error}
              </div>
            ) : (
              <>
                <h1 className="font-serif text-4xl font-extrabold tracking-tight text-primary">
                  {title}
                </h1>
                {intro ? (
                  <p className="mt-3 max-w-3xl text-secondary">{intro}</p>
                ) : (
                  <p className="mt-3 max-w-3xl text-secondary">
                    Sipariş, kargo, iade ve ürün kullanımıyla ilgili sık
                    sorulan soruların yanıtlarını burada bulabilirsiniz. Daha
                    fazla yardım için{" "}
                    <a href="/contact" className="text-accent underline">
                      iletişim sayfamıza
                    </a>
                    göz atın.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Body */}
          <div className="mt-10 space-y-8">
            {loading ? (
              // skeleton
              Array.from({ length: 3 }).map((_, si) => (
                <div key={si}>
                  <div className="h-6 w-56 animate-pulse rounded bg-surface" />
                  <div className="glass-surface-soft mt-4 rounded-2xl border border-border bg-surface-light p-4">
                    {Array.from({ length: 2 }).map((_, qi) => (
                      <div key={qi} className="mb-4 last:mb-0">
                        <div className="h-5 w-full animate-pulse rounded bg-white" />
                        <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-white/80" />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : !isActive ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
                SSS sayfası şu anda aktif değil.
              </div>
            ) : sections.length === 0 ? (
              <div className="glass-surface-soft rounded-xl border border-border bg-surface p-6 text-center text-secondary">
                Henüz SSS içeriği yok.
              </div>
            ) : (
              sections.map((section) => (
                <FAQSection
                  key={section.id || section.title}
                  section={section}
                />
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function FAQSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : [];
  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold text-primary">
        {section.title || "Başlıksız bölüm"}
      </h2>

      {/* sabit border ve divide -> tıklamada kayma yok */}
      <div className="glass-surface mt-4 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-surface-light">
        {items.length ? (
          items.map((item) => (
            <FAQItem key={item.id || item.question} item={item} />
          ))
        ) : (
          <div className="px-4 py-4 text-sm text-secondary">
            Bu bölümde soru yok.
          </div>
        )}
      </div>
    </section>
  );
}

function FAQItem({ item }) {
  const [open, setOpen] = useState(false);
  const q = item?.question || "Başlıksız soru";
  const a = item?.answer || "";

  const contentId = `faq-${hashKey(q)}`;

  return (
    <div data-open={open ? "true" : "false"}>
      {/* başlık satırı: border/padding sabit -> layout stabil */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-primary transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className="font-medium">{q}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 text-accent" : "text-secondary"
          }`}
        />
      </button>

      {/* içerik: sabit dış padding, iç wrapper animasyonlu -> kayma hissi yok */}
      <div
        id={contentId}
        role="region"
        aria-hidden={!open}
        className="px-4 pb-4 sm:px-6"
      >
        <div
          className={`overflow-hidden transition-all duration-200 ${
            open ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="pb-1 text-sm text-secondary">
            {a || <em className="text-secondary/70">Henüz cevap yok.</em>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** küçük, stabil bir key üretici (UI için yeterli) */
function hashKey(s = "") {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function extractMessage(err) {
  if (!err) return "Beklenmeyen hata";
  try {
    const parsed = JSON.parse(String(err.message || err));
    if (parsed?.message) return parsed.message;
  } catch {
    // ignore
  }
  return err.message || String(err);
}
