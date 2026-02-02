import { Suspense } from "react";
import RootLayout from "../../components/layout/RootLayout.jsx";

export default function StoreLayout({ children }) {
  return (
    <RootLayout>
      <Suspense fallback={null}>{children}</Suspense>
    </RootLayout>
  );
}
