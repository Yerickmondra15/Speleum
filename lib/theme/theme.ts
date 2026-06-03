export const supportedThemes = ["dark", "light"] as const;

export type Theme = (typeof supportedThemes)[number];

export const defaultTheme: Theme = "dark";
export const themeStorageKey = "speleum.theme.v1";

export function isTheme(value: string | null): value is Theme {
  return supportedThemes.includes(value as Theme);
}
