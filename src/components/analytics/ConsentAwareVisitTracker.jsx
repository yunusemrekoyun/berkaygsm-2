"use client";

import VisitTracker from "./VisitTracker.jsx";
import { useCookieConsent } from "../../context/CookieConsentContext.jsx";

export default function ConsentAwareVisitTracker() {
  const { analyticsEnabled } = useCookieConsent();

  if (!analyticsEnabled) return null;
  return <VisitTracker />;
}
