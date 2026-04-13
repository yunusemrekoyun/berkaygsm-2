import { Suspense } from "react";
import AdminGateClient from "../../components/admin/AdminGateClient.jsx";
import { getSiteModeSnapshot } from "../../server/services/siteModeService.js";

export const dynamic = "force-dynamic";

export default async function AdminRootLayout({ children }) {
  const siteMode = await getSiteModeSnapshot();

  return (
    <Suspense fallback={null}>
      <AdminGateClient
        maintenanceModeEnabled={Boolean(siteMode?.maintenanceModeEnabled)}
      >
        {children}
      </AdminGateClient>
    </Suspense>
  );
}
