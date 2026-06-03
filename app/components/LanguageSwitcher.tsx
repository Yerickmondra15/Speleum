"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { PreferenceToggleGroup } from "./PreferenceToggleGroup";

export function LanguageSwitcher() {
  const { locale, setLocale, messages } = useLanguage();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-3) text-(--text-muted)">
        <Languages className="h-4 w-4" />
      </div>
      <PreferenceToggleGroup
        value={locale}
        onChange={setLocale}
        options={[
          { value: "es", label: messages.common.spanish },
          { value: "en", label: messages.common.english },
        ]}
      />
    </div>
  );
}
