"use client";

import CheckoutPage from "../../../screens/CheckoutPage.jsx";
import RequireAuth from "../../../components/auth/RequireAuth.jsx";

export default function Page() {
  return (
    <RequireAuth>
      <CheckoutPage />
    </RequireAuth>
  );
}
