import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BreadCrumb from "../components/shop/BreadCrumb";
import SetsSets from "../components/sets-sets/SetsSets";
import { setApi } from "../api/sets";
import { campaignApi } from "../api/campaigns";
import { useStorefrontLang } from "../context/LangContext.jsx";
import {
  useStaticTranslation,
  formatStaticText,
} from "../i18n/staticContent.js";
import { DEFAULT_LANG } from "../constants/lang.js";

export default function SetsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [campaignContext, setCampaignContext] = useState(null);
  const [campaignError, setCampaignError] = useState("");
  const { lang } = useStorefrontLang();
  const t = useStaticTranslation();
  const breadcrumbs = useMemo(() => t("breadcrumbs") || {}, [t]);
  const setsCopy = useMemo(() => t("setsPage") || {}, [t]);
  const bannerCopy = useMemo(
    () => setsCopy.campaignBanner || {},
    [setsCopy.campaignBanner]
  );
  const ctaCopy = useMemo(() => setsCopy.cta || {}, [setsCopy.cta]);
  const cardCopy = useMemo(() => setsCopy.cards || {}, [setsCopy.cards]);
  const gridCopy = useMemo(() => setsCopy.grid || {}, [setsCopy.grid]);
  const cardIncludesMore = cardCopy.includesMore || "+{count}";
  const cardUntitled = cardCopy.untitled || "İsimsiz Set";

  const campaignId = searchParams.get("campaign");

  useEffect(() => {
    if (campaignId) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setCampaignContext(null);
        setCampaignError("");

        let res = await setApi.list({}, lang);
        let sets = normalizeSetsResponse(res);

        if (!sets.length) {
          const res2 = await setApi.list({ includeHidden: true }, lang);
          sets = normalizeSetsResponse(res2);
        }

        if (!sets.length && lang !== DEFAULT_LANG) {
          let fallback = await setApi.list({}, DEFAULT_LANG);
          sets = normalizeSetsResponse(fallback);
          if (!sets.length) {
            const fallbackHidden = await setApi.list(
              { includeHidden: true },
              DEFAULT_LANG
            );
            sets = normalizeSetsResponse(fallbackHidden);
          }
        }

        const mapped = mapSetsToCards(sets, {
          includesMoreLabel: cardIncludesMore,
          untitledLabel: cardUntitled,
        });
        if (mounted) setItems(mapped);
      } catch (e) {
        console.error("SETS PAGE - fetch error:", e);
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [campaignId, lang, cardIncludesMore, cardUntitled]);

  useEffect(() => {
    if (!campaignId) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setCampaignError("");
        const data = await campaignApi.resolve(campaignId, lang);
        if (!mounted) return;
        if (data.targetType === "PRODUCTS") {
          navigate(`/shop?campaign=${campaignId}`, { replace: true });
          return;
        }
        setCampaignContext(data);
        const mapped = mapSetsToCards(data.items || [], {
          includesMoreLabel: cardIncludesMore,
          untitledLabel: cardUntitled,
        });
        setItems(mapped);
      } catch (e) {
        if (!mounted) return;
        setCampaignContext(null);
        setItems([]);
        setCampaignError(extractMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [campaignId, lang, navigate, cardIncludesMore, cardUntitled]);

  const tabs = useMemo(() => {
    const tagSet = new Set();
    for (const s of items) (s.tags || []).forEach((t) => tagSet.add(String(t)));
    return [setsCopy.tabsAll || "Tümü", ...Array.from(tagSet)];
  }, [items, setsCopy.tabsAll]);

  const activeCampaign = campaignContext?.campaign || null;

  const handleClearCampaign = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("campaign");
    setSearchParams(params);
  };

  return (
    <>
      <section className="store-page border-b border-border bg-surface-light/60">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-8">
          <BreadCrumb
            items={[
              { label: breadcrumbs.home || "Ana Sayfa", to: "/" },
              { label: setsCopy.breadcrumb || "Aksesuar Paketleri" },
            ]}
          />
          {/* <div className="mt-4 text-center">
            <h1 className="text-4xl font-serif font-extrabold tracking-tight text-primary">
              {setsCopy.title || "Aksesuar Paketleri"}
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-secondary">
              {setsCopy.subtitle ||
                "Curated bundles for protection, power, and everyday carry — built to match your device and style."}
            </p>
          </div> */}
        </div>
      </section>

      {campaignError && (
        <div className="mx-auto mt-6 max-w-[1400px] px-4 sm:px-6">
          <div className="glass-surface-soft flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span>{campaignError}</span>
            <button
              type="button"
              onClick={handleClearCampaign}
              className="text-rose-700 underline underline-offset-4 hover:text-rose-800"
            >
              {bannerCopy.errorAction || "Kampanya filtresini temizle"}
            </button>
          </div>
        </div>
      )}

      {activeCampaign && !campaignError && (
        <div className="mx-auto mt-6 max-w-[1400px] px-4 sm:px-6">
          <div className="glass-surface-soft flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
            <div>
              {bannerCopy.prefix || "Gösterilen kampanya"}{" "}
              <span className="font-semibold">“{activeCampaign.name}”</span>
              {activeCampaign.description
                ? ` — ${activeCampaign.description}`
                : ""}
            </div>
            <button
              type="button"
              onClick={handleClearCampaign}
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              {bannerCopy.clear || "Temizle"}
            </button>
          </div>
        </div>
      )}

      <SetsSets
        title={setsCopy.listTitle || setsCopy.title || "Aksesuar Paketleri"}
        subtitle={setsCopy.listSubtitle || setsCopy.subtitle}
        tabs={tabs}
        items={items}
        loading={loading}
        emptyLabel={gridCopy.empty || "Bu filtreye uygun paket bulunamadı."}
        cardCopy={cardCopy}
        allLabel={setsCopy.tabsAll || "Tümü"}
      />

      <section className="mx-auto mb-12 max-w-[1400px] px-4 sm:px-6">
        <div className="glass-surface rounded-xl border border-border bg-contact-bg p-6 text-center">
          <h3 className="text-xl font-semibold text-primary">
            {ctaCopy.heading || "Set seçerken yardıma mı ihtiyacınız var?"}
          </h3>
          <p className="mt-1 text-secondary">
            {ctaCopy.text ||
              "Ekibimiz cihazınıza uygun aksesuarları eşleştirmenize yardımcı olur."}
          </p>
          <div className="mt-4">
            <a
              href="/contact"
              className="inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              {ctaCopy.button || "Uzmanla görüş"}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

/** Response’u esnek şekilde normalize et */
function normalizeSetsResponse(res) {
  // Bazı client’larda res direkt dizi olabilir; bazılarında { sets }, bazılarında { data: { sets } }
  const maybe = res?.sets || res?.data?.sets || res;
  return Array.isArray(maybe) ? maybe : [];
}

/** backend set -> kart */
function mapSetsToCards(
  sets,
  { includesMoreLabel = "+{count}", untitledLabel = "İsimsiz Set" } = {}
) {
  return (sets || []).map((s) => {
    const image = s?.images?.[0]?.url || "/set-placeholder.jpg";
    const title = s?.name || untitledLabel || "İsimsiz Set";
    const desc = s?.description || "";

    const productNames = (s?.products || [])
      .map((p) => p?.product?.name)
      .filter(Boolean);

    const includes =
      productNames.length > 0
        ? productNames.slice(0, 3).join(", ") +
          (productNames.length > 3
            ? formatStaticText(includesMoreLabel || "+{count}", {
                count: productNames.length - 3,
              })
            : "")
        : "";

    const tags = Array.from(
      new Set(
        (s?.products || [])
          .map((p) => p?.product?.category?.name)
          .filter(Boolean)
      )
    );

    const slugOrId = s?.slug || s?.id || s?._id;
    const to = slugOrId ? `/set/${slugOrId}` : "#";

    const price = Number(s?.price ?? 0);
    const finalPrice = Number(s?.finalPrice ?? price);
    const discount = s?.discount?.percentage;

    return { image, title, desc, includes, tags, to, price, finalPrice, discount };
  });
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
