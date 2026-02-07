import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BreadCrumb from "../components/shop/BreadCrumb";
import SetDetail from "../components/set-detail/SetDetail";
import SimilarSets from "../components/set-detail/SimilarSets";
import { setApi } from "../api/sets";
import { useStorefrontLang } from "../context/LangContext.jsx";
import { useStaticTranslation } from "../i18n/staticContent.js";

export default function SetDetailsPage() {
  const { slug } = useParams();
  const [setDoc, setSetDoc] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [error, setError] = useState(null);
  const { lang } = useStorefrontLang();
  const t = useStaticTranslation();
  const breadcrumbCopy = t("breadcrumbs") || {};
  const setPageCopy = t("setDetailPage") || {};
  const setDetailCopy = t("setDetail") || {};

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    setSimilar([]);

    (async () => {
      try {
        // ---- normalize get response
        const resp = await setApi.get(slug, lang);
        const detail = resp?.set ?? resp;
        if (!mounted) return;
        if (!detail) throw new Error("Set bulunamadı");
        setSetDoc(detail);

        // ---- similar
        setLoadingSimilar(true);
        try {
          const allResp = await setApi.list({}, lang);
          const allSets = Array.isArray(allResp)
            ? allResp
            : allResp?.sets || [];
          const currentTags = new Set(extractSetTags(detail));

          const candidates = allSets
            .filter((s) => (s.slug || s.id) !== (detail.slug || detail.id))
            .map((s) => {
              const tags = extractSetTags(s);
              return {
                id: s.id || s.slug,
                image: s.images?.[0]?.url,
                title: s.name,
                price: s.price,
                finalPrice: s.finalPrice ?? s.price,
                discount: s.discount?.percentage,
                slug: s.slug || s.id,
                tags,
              };
            })
            .map((s) => ({
              ...s,
              score: s.tags?.some((t) => currentTags.has(t)) ? 1 : 0,
            }))
            .sort((a, b) => b.score - a.score);

          if (mounted) setSimilar(candidates.slice(0, 4));
        } finally {
          if (mounted) setLoadingSimilar(false);
        }
      } catch (err) {
        if (mounted) setError(extractMessage(err));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [lang, slug]);

  const breadcrumbItems = useMemo(() => {
    const tags = extractSetTags(setDoc);
    const firstTag = tags?.[0];
    return [
      { label: breadcrumbCopy.home || "Ana Sayfa", to: "/" },
      firstTag
        ? {
            label: firstTag,
            to: `/sets?tag=${encodeURIComponent(firstTag)}`,
          }
        : null,
      {
        label: setDoc?.name || setDetailCopy.fallbackName || "Set",
      },
    ].filter(Boolean);
  }, [setDoc, breadcrumbCopy.home, setDetailCopy.fallbackName]);

  if (loading) {
    return (
      <section className="bg-surface-light/60">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-16">
          <div className="grid gap-6 md:grid-cols-12">
            <div className="md:col-span-5 space-y-4">
              <div className="h-[480px] animate-pulse rounded-xl bg-white/70" />
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="aspect-[4/5] animate-pulse rounded-xl bg-white/60"
                  />
                ))}
              </div>
            </div>
            <div className="md:col-span-7 space-y-4">
              <div className="h-8 w-2/3 animate-pulse rounded bg-white/70" />
              <div className="h-6 w-1/3 animate-pulse rounded bg-white/60" />
              <div className="h-40 animate-pulse rounded bg-white/50" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error || !setDoc) {
    return (
      <section className="bg-surface-light/60">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-16">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-center text-rose-700">
            {error || setPageCopy.notFound || "Set bulunamadı"}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-surface-light/60">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6">
        <BreadCrumb items={breadcrumbItems} />
      </div>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-12">
        <SetDetail setDoc={setDoc} />
      </div>

      {loadingSimilar
        ? null
        : similar.length > 0 && (
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-16">
              <SimilarSets items={similar} />
            </div>
          )}
    </section>
  );
}

function extractSetTags(s) {
  const list = Array.isArray(s?.products) ? s.products : [];
  return Array.from(
    new Set(list.map((p) => p?.product?.category?.name || null).filter(Boolean))
  );
}

function extractMessage(error) {
  if (!error) return "Unexpected error";
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return parsed.message;
    } catch {
      /* ignore */
    }
    return error.message;
  }
  return String(error);
}
