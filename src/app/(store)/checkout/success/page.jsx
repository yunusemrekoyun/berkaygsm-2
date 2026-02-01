"use client";

import SuccessPage from "../../../../screens/SuccessPage.jsx";
import RequireAuth from "../../../../components/auth/RequireAuth.jsx";

export default function Page() {
  return (
    <RequireAuth>
      <SuccessPage />
    </RequireAuth>
  );
}
