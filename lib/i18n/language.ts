import {
  defaultLocale,
  languageStorageKey,
  supportedLocales,
  type Locale,
} from "@/lib/i18n/messages";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function isLocale(value: string | null): value is Locale {
  return supportedLocales.includes(value as Locale);
}

export function resolveLocale(
  applied: string | null,
  stored: string | null,
): Locale {
  if (isLocale(applied)) return applied;
  return isLocale(stored) ? stored : defaultLocale;
}

export function readStoredLocale(storage?: Pick<Storage, "getItem">) {
  if (!storage) return defaultLocale;
  try {
    const stored = storage.getItem(languageStorageKey);
    return isLocale(stored) ? stored : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

export function persistLocale(locale: Locale, storage?: StorageLike) {
  if (!storage) return;
  try {
    storage.setItem(languageStorageKey, locale);
  } catch {
    // The active document language still changes when storage is unavailable.
  }
}
