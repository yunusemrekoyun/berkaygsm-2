import { Suspense } from "react";
import RequireAuth from "../../../../components/auth/RequireAuth.jsx";
import SuccessPage from "../../../../screens/SuccessPage.jsx";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RequireAuth>
        <SuccessPage />
      </RequireAuth>
    </Suspense>
  );
}
