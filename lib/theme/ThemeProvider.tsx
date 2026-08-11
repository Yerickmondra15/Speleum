"use client";

import {
  useCallback,
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { defaultTheme, persistTheme, resolveTheme, themeStorageKey, type Theme } from "./theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeChangeEvent = "speleum-theme-change";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function getClientTheme(): Theme {
  try {
    return resolveTheme(
      document.documentElement.dataset.theme ?? null,
      window.localStorage.getItem(themeStorageKey),
    );
  } catch {
    return defaultTheme;
  }
}

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(themeChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(themeChangeEvent, onStoreChange);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getClientTheme,
    () => defaultTheme,
  );
  const setTheme = useCallback((nextTheme: Theme) => {
    applyTheme(nextTheme);

    persistTheme(nextTheme, window.localStorage);

    window.dispatchEvent(new Event(themeChangeEvent));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
    }),
    [setTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return value;
}
