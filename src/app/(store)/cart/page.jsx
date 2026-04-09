import { Suspense } from "react";
import CartPage from "../../../screens/CartPage.jsx";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CartPage />
    </Suspense>
  );
}
