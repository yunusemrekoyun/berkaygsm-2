"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { clearAnalyticsTrackingStorage } from "../utils/analyticsTrackingStorage.js";
import {
  createCookieConsent,
  hasAnalyticsConsent,
  readStoredCookieConsent,
  writeStoredCookieConsent,
  COOKIE_CONSENT_STORAGE_KEY,
} from "../utils/cookieConsent.js";

const CookieConsentContext = createContext({
  consent: null,
  hydrated: false,
  analyticsEnabled: false,
  bannerVisible: false,
  preferencesOpen: false,
  acceptAll: () => {},
  rejectOptional: () => {},
  savePreferences: () => {},
  openPreferences: () => {},
  closePreferences: () => {},
});

export function CookieConsentProvider({ children }) {
  const [consent, setConsent] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const syncConsent = () => {
      const nextConsent = readStoredCookieConsent(window.localStorage);
      setConsent(nextConsent);
      if (!nextConsent) clearAnalyticsTrackingStorage();
      setHydrated(true);
    };

    const handleStorage = (event) => {
      if (event.key && event.key !== COOKIE_CONSENT_STORAGE_KEY) return;
      syncConsent();
    };

    syncConsent();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const persistConsent = useCallback((nextConsent) => {
    if (typeof window === "undefined") return;

    writeStoredCookieConsent(nextConsent, window.localStorage);
    setConsent(nextConsent);
    setPreferencesOpen(false);

    if (!hasAnalyticsConsent(nextConsent)) {
      clearAnalyticsTrackingStorage();
    }
  }, []);

  const acceptAll = useCallback(() => {
    persistConsent(createCookieConsent({ analytics: true, status: "accepted" }));
  }, [persistConsent]);

  const rejectOptional = useCallback(() => {
    persistConsent(createCookieConsent({ analytics: false, status: "rejected" }));
  }, [persistConsent]);

  const savePreferences = useCallback(
    ({ analytics = false } = {}) => {
      persistConsent(createCookieConsent({ analytics, status: "customized" }));
    },
    [persistConsent]
  );

  const openPreferences = useCallback(() => {
    setPreferencesOpen(true);
  }, []);

  const closePreferences = useCallback(() => {
    setPreferencesOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      consent,
      hydrated,
      analyticsEnabled: hydrated && hasAnalyticsConsent(consent),
      bannerVisible: hydrated && !consent,
      preferencesOpen,
      acceptAll,
      rejectOptional,
      savePreferences,
      openPreferences,
      closePreferences,
    }),
    [
      acceptAll,
      closePreferences,
      consent,
      hydrated,
      openPreferences,
      preferencesOpen,
      rejectOptional,
      savePreferences,
    ]
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  return useContext(CookieConsentContext);
}
