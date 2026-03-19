import BreadCrumb from "../components/shop/BreadCrumb";
import Cart from "../components/cart/Cart";
import { useStaticTranslation } from "../i18n/staticContent.js";

export default function CartPage() {
  const t = useStaticTranslation();
  const breadcrumbs = t("breadcrumbs") || {};

  return (
    <section className="store-page bg-surface-light/60">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6">
        <BreadCrumb
          items={[
            { label: breadcrumbs.home || "Ana Sayfa", to: "/" },
            { label: breadcrumbs.cart || "Sepet" },
          ]}
        />
      </div>

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-32 md:pb-24 lg:pb-28">
        <Cart />
      </div>
    </section>
  );
}
