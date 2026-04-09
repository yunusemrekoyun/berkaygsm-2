import { Suspense } from "react";
import ContactPage from "../../../screens/ContactPage.jsx";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ContactPage />
    </Suspense>
  );
}
