import { Suspense } from "react";
import ShopPage from "../../../screens/ShopPage.jsx";
import { DEFAULT_LANG } from "../../../constants/lang.js";
import { getShopPageData } from "../../../server/services/storefrontPrefetchService.js";

export default async function Page() {
  const initialData = await getShopPageData(DEFAULT_LANG);

  return (
    <Suspense fallback={null}>
      <ShopPage initialData={initialData} initialLang={DEFAULT_LANG} />
    </Suspense>
  );
}
