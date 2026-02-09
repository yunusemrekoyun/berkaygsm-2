import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LANG,
  SUPPORTED_LANGS,
  normalizeLang,
} from "../constants/lang.js";

const STORAGE_KEYS = ["adminLang", "appLang"];

const LangContext = createContext(null);

function readInitialLang() {
  if (typeof window === "undefined") return DEFAULT_LANG;

  for (const key of STORAGE_KEYS) {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) return normalizeLang(stored);
    } catch {
      /* ignore */
    }
  }

  const browserLang =
    typeof navigator !== "undefined"
      ? normalizeLang(navigator.language?.slice(0, 2))
      : DEFAULT_LANG;
  return browserLang;
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setLangState(readInitialLang());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    STORAGE_KEYS.forEach((key) => {
      try {
        window.localStorage.setItem(key, lang);
      } catch {
        /* ignore */
      }
    });
  }, [lang]);

  const setLang = useCallback((nextLang) => {
    setLangState((prev) => {
      const normalized = normalizeLang(nextLang ?? prev);
      return normalized;
    });
  }, []);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      availableLangs: SUPPORTED_LANGS,
      defaultLang: DEFAULT_LANG,
    }),
    [lang, setLang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const context = useContext(LangContext);
  if (!context) {
    throw new Error("useLang must be used within a LangProvider");
  }
  return context;
}

export function useAdminLang() {
  const { lang, setLang, availableLangs, defaultLang } = useLang();
  return {
    adminLang: lang,
    setAdminLang: setLang,
    availableLangs,
    defaultLang,
  };
}

export function useStorefrontLang() {
  const { lang, setLang, availableLangs, defaultLang } = useLang();
  return {
    lang,
    setLang,
    availableLangs,
    defaultLang,
  };
}
