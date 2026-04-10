import { Suspense } from "react";
import SuccessPage from "../../../../screens/SuccessPage.jsx";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuccessPage />
    </Suspense>
  );
}
