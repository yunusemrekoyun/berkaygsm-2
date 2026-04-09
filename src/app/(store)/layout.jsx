import { Suspense } from "react";
import RootLayout from "../../components/layout/RootLayout.jsx";
import MaintenanceModeScreen from "../../components/maintenance/MaintenanceModeScreen.jsx";
import RouteMemory from "../../components/RouteMemory.jsx";
import ConsentAwareVisitTracker from "../../components/analytics/ConsentAwareVisitTracker.jsx";
import { getStorefrontCategoryTree } from "../../server/services/storefrontPrefetchService.js";
import { getSiteModeSnapshot } from "../../server/services/siteModeService.js";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }) {
  const siteMode = await getSiteModeSnapshot();
  if (siteMode?.maintenanceModeEnabled) {
    return <MaintenanceModeScreen />;
  }

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
