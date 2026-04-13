"use client";

import dynamic from "next/dynamic";

// SuccessPage, useLocation() (React Router) ile URL query params'larını okur.
// React Router SSR sırasında location.search'ü bilmez → server "Teşekkürler!"
// render eder, client "Ödeme alındı, sipariş kontrol ediliyor" render eder
// → React hydration error #418.
// ssr: false ile bu bileşen yalnızca client'ta render edilir, hydration mismatch olmaz.
const SuccessPage = dynamic(
  () => import("../../../../screens/SuccessPage.jsx"),
  { ssr: false }
);

export default function Page() {
  return <SuccessPage />;
}
