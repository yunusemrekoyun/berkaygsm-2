import { Suspense } from "react";
import CheckoutPage from "../../../screens/CheckoutPage.jsx";

// RequireAuth kaldırıldı: CheckoutPage kendi içinde auth durumunu yönetiyor
// (authenticated / guest-choice / guest akışı). RequireAuth burada misafir
// ödeme seçeneğini login sayfasına yönlendirerek engelliyordu.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <CheckoutPage />
    </Suspense>
  );
}
