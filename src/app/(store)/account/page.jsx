import { Suspense } from "react";
import AuthSelector from "../../../components/auth/AuthSelector.jsx";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AuthSelector />
    </Suspense>
  );
}
