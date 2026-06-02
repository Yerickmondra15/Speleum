"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function LanguageSwitcher() {
  const { locale, setLocale, messages } = useLanguage();

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-2 py-2 text-xs text-zinc-300 backdrop-blur-md">
      <Languages className="h-4 w-4 text-zinc-500" />
      <button
        type="button"
        onClick={() => setLocale("es")}
        className={`rounded-full px-2.5 py-1 transition ${
          locale === "es" ? "bg-white text-black" : "hover:bg-white/10"
        }`}
        aria-pressed={locale === "es"}
      >
        {messages.common.spanish}
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-full px-2.5 py-1 transition ${
          locale === "en" ? "bg-white text-black" : "hover:bg-white/10"
        }`}
        aria-pressed={locale === "en"}
      >
        {messages.common.english}
      </button>
    </div>
  );
}
