export const supportedThemes = ["dark", "light"] as const;

export type Theme = (typeof supportedThemes)[number];

export const defaultTheme: Theme = "dark";
export const themeStorageKey = "speleum.theme.v1";

export function isTheme(value: string | null): value is Theme {
  return supportedThemes.includes(value as Theme);
}

export function resolveTheme(applied: string | null, stored: string | null): Theme {
  if (isTheme(applied)) return applied;
  return isTheme(stored) ? stored : defaultTheme;
}

export function readStoredTheme(storage?: Pick<Storage, "getItem">) {
  if (!storage) return defaultTheme;
  try {
    return resolveTheme(null, storage.getItem(themeStorageKey));
  } catch {
    return defaultTheme;
  }
}

export function persistTheme(theme: Theme, storage?: Pick<Storage, "setItem">) {
  if (!storage) return;
  try {
    storage.setItem(themeStorageKey, theme);
  } catch {
    // The document theme still applies when storage is unavailable.
  }
}
