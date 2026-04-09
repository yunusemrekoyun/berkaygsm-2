import { Suspense } from "react";
import RootLayout from "../../components/layout/RootLayout.jsx";
import RouteMemory from "../../components/RouteMemory.jsx";
import ConsentAwareVisitTracker from "../../components/analytics/ConsentAwareVisitTracker.jsx";
import { getStorefrontCategoryTree } from "../../server/services/storefrontPrefetchService.js";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }) {
  const initialCategoryTree = await getStorefrontCategoryTree();

  return (
    <RootLayout initialCategoryTree={initialCategoryTree}>
      <Suspense fallback={null}>
        <RouteMemory />
      </Suspense>
      <Suspense fallback={null}>
        <ConsentAwareVisitTracker />
      </Suspense>
      <Suspense fallback={null}>{children}</Suspense>
    </RootLayout>
  );
}
