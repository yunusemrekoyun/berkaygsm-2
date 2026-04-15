import { Suspense } from "react";
import RootLayout from "../../components/layout/RootLayout.jsx";
import MaintenanceModeScreen from "../../components/maintenance/MaintenanceModeScreen.jsx";
import RouteMemory from "../../components/RouteMemory.jsx";
import ConsentAwareVisitTracker from "../../components/analytics/ConsentAwareVisitTracker.jsx";
import { getStorefrontCategoryTree } from "../../server/services/storefrontPrefetchService.js";
import { getSiteModeSnapshot } from "../../server/services/siteModeService.js";
import AnnouncementBanner from "../../server/models/AnnouncementBanner.js";
import { connectDB } from "../../server/config/db.js";

export const dynamic = "force-dynamic";

async function getAnnouncementBannerSnapshot() {
  try {
    await connectDB();
    const doc = await AnnouncementBanner.getSingleton();
    return {
      isEnabled: Boolean(doc.isEnabled),
      text: String(doc.text || ""),
      bgColor: String(doc.bgColor || "#0c4a6e"),
      textColor: String(doc.textColor || "#ffffff"),
    };
  } catch {
    return { isEnabled: false, text: "", bgColor: "#0c4a6e", textColor: "#ffffff" };
  }
}

export default async function StoreLayout({ children }) {
  const siteMode = await getSiteModeSnapshot();
  if (siteMode?.maintenanceModeEnabled) {
    return <MaintenanceModeScreen />;
  }

  const [initialCategoryTree, initialBanner] = await Promise.all([
    getStorefrontCategoryTree(),
    getAnnouncementBannerSnapshot(),
  ]);

  return (
    <RootLayout initialCategoryTree={initialCategoryTree} initialBanner={initialBanner}>
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
