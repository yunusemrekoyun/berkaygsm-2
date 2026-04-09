import { Suspense } from "react";
import ProductDetailPage from "../../../../screens/ProductDetailPage.jsx";
import { DEFAULT_LANG } from "../../../../constants/lang.js";
import { getProductPageData } from "../../../../server/services/storefrontPrefetchService.js";

export default async function Page({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";
  const initialData = slug ? await getProductPageData(slug, DEFAULT_LANG) : null;

  return (
    <Suspense fallback={null}>
      <ProductDetailPage
        initialSlug={slug}
        initialProduct={initialData?.product || null}
        initialSimilar={initialData?.similar || []}
        initialError={initialData?.product ? null : "Ürün bulunamadı"}
        initialLang={DEFAULT_LANG}
      />
    </Suspense>
  );
}
