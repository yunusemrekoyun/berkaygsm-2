import { useEffect, useState } from "react";
import BreadCrumb from "../components/shop/BreadCrumb";
import { Link } from "react-router-dom";
import { aboutApi } from "../api/about";
import { Loader2 } from "lucide-react";
import { useStorefrontLang } from "../context/LangContext.jsx";

export default function AboutPage() {
  const [about, setAbout] = useState(null);
  const [loading, setLoading] = useState(true);
  const { lang } = useStorefrontLang();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const res = await aboutApi.get(lang);
        if (mounted) setAbout(res.about);
      } catch (err) {
        console.error("About fetch error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [lang]);

  if (loading)
    return (
      <main className="flex h-[70vh] items-center justify-center text-secondary">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );

  if (!about)
    return (
      <main className="flex h-[70vh] items-center justify-center text-secondary">
        <p>Hakkımızda içeriği bulunamadı.</p>
      </main>
    );

  const {
    heroTitle,
    heroSubtitle,
    heroImage,
    leftImage,
    dotBlocks = [],
    stats = [],
    materialsTitle,
    materialsText,
    materialsBullets = [],
    materialsImage,
    ctaTitle,
    ctaSubtitle,
    ctas = [],
  } = about;

  return (
    <main className="store-page bg-surface-light/60">
      {/* Breadcrumb */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pt-6">
        <BreadCrumb
          items={[{ label: "Ana Sayfa", to: "/" }, { label: "Hakkımızda" }]}
        />
      </section>

      {/* Hero */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-10">
        <div className="glass-surface rounded-2xl border border-border bg-white/80 p-8 sm:p-12 text-center">
          <h1 className="font-serif text-4xl sm:text-5xl font-extrabold tracking-tight text-primary">
            {heroTitle}
          </h1>
          <p className="mx-auto mt-3 max-w-3xl text-secondary">
            {heroSubtitle}
          </p>

          {heroImage?.url && (
            <div className="mt-8 overflow-hidden rounded-xl ring-1 ring-border">
              <img
                src={heroImage.url}
                alt="Hakkımızda görseli"
                className="h-[340px] w-full object-cover"
                draggable="false"
              />
            </div>
          )}
        </div>
      </section>

      {/* Story + Vision + Values */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-14">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          {leftImage?.url && (
            <div className="md:col-span-5">
              <div className="glass-surface overflow-hidden rounded-2xl border border-border bg-white">
                <img
                  src={leftImage.url}
                  alt="Mağaza"
                  className="h-full w-full object-cover md:h-[560px]"
                  draggable="false"
                />
              </div>
            </div>
          )}

          <div className="md:col-span-7">
            <div className="glass-surface rounded-2xl border border-border bg-contact-bg p-6 sm:p-8">
              {dotBlocks.map((block, i) => (
                <div key={i}>
                  <DotBlock title={block.title} text={block.text} />
                  {i < dotBlocks.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      {stats.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-12">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s, i) => (
              <Stat key={i} value={s.value} label={s.label} />
            ))}
          </div>
        </section>
      )}

      {/* Materials */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-14">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="md:col-span-7">
            <div className="glass-surface rounded-2xl border border-border bg-white p-6 sm:p-8">
              <h2 className="font-serif text-2xl font-extrabold text-primary">
                {materialsTitle}
              </h2>
              <p className="mt-2 text-secondary">{materialsText}</p>

              {materialsBullets.length > 0 && (
                <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                  {materialsBullets.map((b, i) => (
                    <li
                      key={i}
                      className="glass-surface-soft rounded-lg border border-border bg-contact-bg p-3"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {materialsImage?.url && (
            <div className="md:col-span-5">
              <div className="overflow-hidden rounded-2xl border border-border">
                <img
                  src={materialsImage.url}
                  alt="Fabric"
                  className="h-full w-full object-cover md:h-[360px]"
                  draggable="false"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      {(ctaTitle || ctaSubtitle) && (
        <section className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-16">
          <div className="glass-surface rounded-2xl border border-border bg-surface-light p-6 sm:p-8 text-center">
            <h3 className="font-serif text-2xl font-extrabold text-primary">
              {ctaTitle}
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-secondary">
              {ctaSubtitle}
            </p>

            {ctas.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {ctas.map((btn, i) => (
                  <Link
                    key={i}
                    to={btn.to}
                    className={`inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                      btn.variant === "secondary"
                        ? "border border-border text-primary hover:bg-surface-hover"
                        : "bg-accent text-white hover:bg-accent-hover"
                    }`}
                  >
                    {btn.text}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

/* ---------- tiny subcomponents ---------- */

function DotBlock({ title, text }) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-4">
      <span className="mt-1 inline-block h-3 w-3 rounded-full bg-accent" />
      <div>
        <h3 className="font-serif text-xl font-semibold text-primary">
          {title}
        </h3>
        <p className="mt-2 text-secondary">{text}</p>
      </div>
    </div>
  );
}

function Separator() {
  return <div className="my-6 h-px w-full bg-border" />;
}

function Stat({ value, label }) {
  return (
    <div className="glass-surface rounded-2xl border border-border bg-white p-5 text-center">
      <div className="font-serif text-3xl font-extrabold text-primary">
        {value}
      </div>
      <div className="mt-1 text-sm text-secondary">{label}</div>
    </div>
  );
}
