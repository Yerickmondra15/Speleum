"use client";

import Image from "next/image";
import { X } from "lucide-react";
import type { CharacterOption } from "../gameConfig";
import { localizeCharacterOption } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type MatchmakingScreenProps = {
  selectedCharacter: CharacterOption;
  onCancel: () => void;
};

export function MatchmakingScreen({
  selectedCharacter,
  onCancel,
}: MatchmakingScreenProps) {
  const { locale, messages } = useLanguage();
  const localizedCharacter = localizeCharacterOption(locale, selectedCharacter);
  return (
    <section className="relative z-10 flex min-h-screen items-center justify-center px-4 sm:px-5">
      <button
        type="button"
        onClick={onCancel}
        className="theme-text-secondary absolute left-4 top-4 inline-flex min-h-11 items-center gap-2 text-sm transition hover:text-[var(--text-primary)] sm:left-5 sm:top-5"
      >
        <X className="h-4 w-4" />
        {messages.common.cancel}
      </button>

      <div className="relative flex h-96 w-[24rem] max-w-full items-center justify-center sm:h-136 sm:w-136">
        <div className="theme-border absolute inset-0 rounded-full border bg-[radial-gradient(circle,var(--glow-main),var(--glow-accent)_32%,transparent_64%)]" />
        <div className="theme-border absolute inset-12 animate-ping rounded-full border" />
        <div className="theme-border absolute inset-24 rounded-full border" />
        <div className="theme-border absolute h-px w-full bg-[var(--border-soft)]" />
        <div className="theme-border absolute h-full w-px bg-[var(--border-soft)]" />

        <div className="relative text-center">
          <div className="theme-icon-shell mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full sm:h-24 sm:w-24">
            <Image
              src={selectedCharacter.imageGame}
              alt={localizedCharacter.name}
              width={62}
              height={62}
              className="h-14 w-14 object-contain sm:h-16 sm:w-16"
            />
          </div>
          <p className="theme-text-muted mt-7 text-xs tracking-[0.36em]">
            {messages.play.descending}
          </p>
          <h1 className="theme-text-primary mt-4 text-2xl font-semibold tracking-[0.12em] sm:text-3xl sm:tracking-[0.18em]">
            {messages.play.searchingTitle}
          </h1>
          <p className="theme-text-muted mt-4 text-sm">{localizedCharacter.name}</p>

          <div className="theme-text-secondary mt-10 grid gap-3 text-sm">
            {messages.play.searchingPhrases.map((phrase, index) => (
              <div
                key={phrase}
                className="flex items-center justify-center gap-3"
                style={{ opacity: 1 - index * 0.14 }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)] shadow-[0_0_12px_var(--glow-main)]" />
                {phrase}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
