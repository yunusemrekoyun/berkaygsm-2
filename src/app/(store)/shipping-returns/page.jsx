import { Suspense } from "react";
import ShippingReturnsPage from "../../../screens/ShippingReturnsPage.jsx";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ShippingReturnsPage />
    </Suspense>
  );
}
