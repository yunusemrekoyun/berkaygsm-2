import { Suspense } from "react";
import TermsPage from "../../../screens/TermsPage.jsx";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TermsPage />
    </Suspense>
  );
}
