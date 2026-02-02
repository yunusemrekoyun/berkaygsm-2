import { Suspense } from "react";
import RootLayout from "../../components/layout/RootLayout.jsx";
import RouteMemory from "../../components/RouteMemory.jsx";

export default function StoreLayout({ children }) {
  return (
    <RootLayout>
      <RouteMemory />
      <Suspense fallback={null}>{children}</Suspense>
    </RootLayout>
  );
}
