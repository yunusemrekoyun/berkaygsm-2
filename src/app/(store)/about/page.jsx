import { Suspense } from "react";
import AboutPage from "../../../screens/AboutPage.jsx";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AboutPage />
    </Suspense>
  );
}
