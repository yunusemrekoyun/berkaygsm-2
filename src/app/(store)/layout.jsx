import { Suspense } from "react";
import RootLayout from "../../components/layout/RootLayout.jsx";
import RouteMemory from "../../components/RouteMemory.jsx";
import VisitTracker from "../../components/analytics/VisitTracker.jsx";
import { getStorefrontCategoryTree } from "../../server/services/storefrontPrefetchService.js";

export default async function StoreLayout({ children }) {
  const initialCategoryTree = await getStorefrontCategoryTree();

  return (
    <RootLayout initialCategoryTree={initialCategoryTree}>
      <Suspense fallback={null}>
        <RouteMemory />
      </Suspense>
      <Suspense fallback={null}>
        <VisitTracker />
      </Suspense>
      <Suspense fallback={null}>{children}</Suspense>
    </RootLayout>
  );
}
