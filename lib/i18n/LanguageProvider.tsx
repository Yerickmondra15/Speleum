"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  defaultLocale,
  languageStorageKey,
  translations,
  type Locale,
  type Messages,
} from "./messages";
import { persistLocale, resolveLocale } from "./language";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  messages: Messages;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const languageChangeEvent = "speleum-language-change";

function getClientLocale() {
  try {
    return resolveLocale(
      document.documentElement.lang,
      window.localStorage.getItem(languageStorageKey),
    );
  } catch {
    return resolveLocale(document.documentElement.lang, null);
  }
}

function subscribeToLocale(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(languageChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(languageChangeEvent, onStoreChange);
  };
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getClientLocale,
    () => defaultLocale,
  );
  const setLocaleState = useCallback((nextLocale: Locale) => {
    document.documentElement.lang = nextLocale;
    persistLocale(nextLocale, window.localStorage);
    window.dispatchEvent(new Event(languageChangeEvent));
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale: setLocaleState,
      messages: translations[locale],
    }),
    [locale, setLocaleState],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);

  if (!value) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }

  return value;
}
