// src/components/auth/RequireAuth.jsx
import { Navigate, useLocation } from "react-router-dom";
import { getUser } from "../../api/client";

export default function RequireAuth({ children }) {
  const user = getUser();
  const location = useLocation();

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/account?view=login&redirect=${redirect}`} replace />;
  }
  return children;
}
