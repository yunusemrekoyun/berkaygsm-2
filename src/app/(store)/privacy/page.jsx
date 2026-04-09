import { Suspense } from "react";
import PrivacyPolicyPage from "../../../screens/PrivacyPolicyPage.jsx";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PrivacyPolicyPage />
    </Suspense>
  );
}
