/* eslint-disable no-unused-vars */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BreadCrumb from "../components/shop/BreadCrumb";
import ProductDetail from "../components/product-detail/ProductDetail";
import SimilarProducts from "../components/product-detail/SimilarProducts";
import { productApi } from "../api/products";
import { useStorefrontLang } from "../context/LangContext.jsx";
import { useStaticTranslation } from "../i18n/staticContent.js";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { lang } = useStorefrontLang();
  const t = useStaticTranslation();
  const breadcrumbCopy = t("breadcrumbs") || {};
  const productPageCopy = t("productDetailPage") || {};
  const productCopy = t("productDetail") || {};

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    setSimilar([]);

    (async () => {
      try {
        const detail = await productApi.get(slug, lang);
        if (!mounted) return;
        setProduct(detail);

        if (detail?.category) {
          const related = await productApi.list({
            category: detail.category?.id || detail.category?._id || detail.category,
            limit: 8,
          }, lang);
          if (mounted && related?.products) {
            setSimilar(
              related.products
                .filter((item) => item.slug !== detail.slug)
                .slice(0, 4)
            );
          }
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

  if (loading) {
    return (
      <section className="store-page bg-surface-light/60">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-16">
          <div className="grid gap-6 md:grid-cols-12">
            <div className="md:col-span-5 space-y-4">
              <div className="glass-surface h-[480px] animate-pulse rounded-xl bg-white/70" />
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="glass-surface-soft aspect-[4/5] animate-pulse rounded-xl bg-white/60"
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

  if (error || !product) {
    return (
      <section className="store-page bg-surface-light/60">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-16">
          <div className="glass-surface-soft rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-center text-rose-700">
            {error || productPageCopy.notFound || "Ürün bulunamadı"}
          </div>
        </div>
      </section>
    );
  }

  const breadcrumbItems = [
    { label: breadcrumbCopy.home || "Ana Sayfa", to: "/" },
    product.category?.name
      ? {
          label: product.category.name,
          to: `/shop?category=${product.category.id || product.category._id}`,
        }
      : null,
    {
      label:
        product.name ||
        product.title ||
        productCopy.fallbackName ||
        "Ürün",
    },
  ].filter(Boolean);

  return (
    <section className="store-page bg-surface-light/60">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6">
        <BreadCrumb items={breadcrumbItems} />
      </div>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-12">
        <ProductDetail product={product} />
      </div>

      {similar.length > 0 && (
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-16">
          <SimilarProducts
            items={similar.map((item) => ({
              id: item.id || item.slug,
              image: item.images?.[0]?.url,
              title: item.name,
              price: item.price,
              finalPrice: item.finalPrice ?? item.price,
              discount: item.discount?.percentage,
              slug: item.slug,
            }))}
          />
        </div>
      )}
    </section>
  );
}

function extractMessage(error) {
  if (!error) return "Beklenmeyen hata";
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.message) return parsed.message;
    } catch (_) {
      /* ignore */
    }
    return error.message;
  }
  return String(error);
}
