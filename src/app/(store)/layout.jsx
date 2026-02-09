import { Suspense } from "react";
import RootLayout from "../../components/layout/RootLayout.jsx";
import RouteMemory from "../../components/RouteMemory.jsx";
import VisitTracker from "../../components/analytics/VisitTracker.jsx";

export default function StoreLayout({ children }) {
  return (
    <RootLayout>
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
