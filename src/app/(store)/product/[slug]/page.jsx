import { Suspense } from "react";
import ProductDetailPage from "../../../../screens/ProductDetailPage.jsx";
import { DEFAULT_LANG } from "../../../../constants/lang.js";
import { getProductPageData } from "../../../../server/services/storefrontPrefetchService.js";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.ceplife.com";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug || "";
  const data = slug ? await getProductPageData(slug, DEFAULT_LANG) : null;
  const product = data?.product;

  if (!product) {
    return { title: "Ürün Bulunamadı" };
  }

  const title = product.name;
  const description =
    product.description
      ? String(product.description).replace(/<[^>]*>/g, "").trim().slice(0, 160)
      : `${product.name} — CepLife'da uygun fiyatla satın al.`;
  const image = product.images?.[0]?.url || product.image || null;
  const url = `${SITE_URL}/product/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      ...(image ? { images: [{ url: image, width: 800, height: 800, alt: title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

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
