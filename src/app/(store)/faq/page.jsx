import { Suspense } from "react";
import FAQPage from "../../../screens/FAQPage.jsx";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FAQPage />
    </Suspense>
  );
}
