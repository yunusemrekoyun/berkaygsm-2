import { Suspense } from "react";
import SetsPage from "../../../screens/SetsPage.jsx";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SetsPage />
    </Suspense>
  );
}
