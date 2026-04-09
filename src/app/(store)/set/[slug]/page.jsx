import { Suspense } from "react";
import SetDetailsPage from "../../../../screens/SetDetailsPage.jsx";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SetDetailsPage />
    </Suspense>
  );
}
