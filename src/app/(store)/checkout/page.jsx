import { Suspense } from "react";
import CheckoutPage from "../../../screens/CheckoutPage.jsx";
import RequireAuth from "../../../components/auth/RequireAuth.jsx";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RequireAuth>
        <CheckoutPage />
      </RequireAuth>
    </Suspense>
  );
}
