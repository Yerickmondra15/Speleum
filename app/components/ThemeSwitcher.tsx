"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { PreferenceToggleGroup } from "./PreferenceToggleGroup";

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const { messages } = useLanguage();

  if (compact) {
    const nextTheme = theme === "dark" ? "light" : "dark";
    return (
      <button
        type="button"
        onClick={() => setTheme(nextTheme)}
        aria-label={nextTheme === "light" ? messages.common.lightTheme : messages.common.darkTheme}
        className="theme-button-secondary inline-flex h-10 w-10 items-center justify-center rounded-full"
      >
        {theme === "dark" ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-3) text-(--text-muted)">
        {theme === "dark" ? (
          <MoonStar className="h-4 w-4" />
        ) : (
          <SunMedium className="h-4 w-4" />
        )}
      </div>
      <PreferenceToggleGroup
        value={theme}
        onChange={setTheme}
        options={[
          { value: "dark", label: messages.common.darkTheme },
          { value: "light", label: messages.common.lightTheme },
        ]}
      />
    </div>
  );
}
