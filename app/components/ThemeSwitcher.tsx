"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { PreferenceToggleGroup } from "./PreferenceToggleGroup";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { messages } = useLanguage();

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
