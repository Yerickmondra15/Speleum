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
        className="absolute left-4 top-4 inline-flex min-h-11 items-center gap-2 text-sm text-zinc-400 transition hover:text-white sm:left-5 sm:top-5"
      >
        <X className="h-4 w-4" />
        {messages.common.cancel}
      </button>

      <div className="relative flex h-96 w-[24rem] max-w-full items-center justify-center sm:h-136 sm:w-136">
        <div className="absolute inset-0 rounded-full border border-white/5 bg-[radial-gradient(circle,rgba(255,255,255,0.08),rgba(82,9,20,0.08)_32%,transparent_64%)]" />
        <div className="absolute inset-12 animate-ping rounded-full border border-white/10" />
        <div className="absolute inset-24 rounded-full border border-white/10" />
        <div className="absolute h-px w-full bg-white/5" />
        <div className="absolute h-full w-px bg-white/5" />

        <div className="relative text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-zinc-100/90 shadow-[0_0_38px_rgba(255,255,255,0.18)] sm:h-24 sm:w-24">
            <Image
              src={selectedCharacter.imageGame}
              alt={localizedCharacter.name}
              width={62}
              height={62}
              className="h-14 w-14 object-contain sm:h-16 sm:w-16"
            />
          </div>
          <p className="mt-7 text-xs tracking-[0.36em] text-zinc-500">
            {messages.play.descending}
          </p>
          <h1 className="mt-4 text-2xl font-semibold tracking-[0.12em] text-white sm:text-3xl sm:tracking-[0.18em]">
            {messages.play.searchingTitle}
          </h1>
          <p className="mt-4 text-sm text-zinc-500">{localizedCharacter.name}</p>

          <div className="mt-10 grid gap-3 text-sm text-zinc-400">
            {messages.play.searchingPhrases.map((phrase, index) => (
              <div
                key={phrase}
                className="flex items-center justify-center gap-3"
                style={{ opacity: 1 - index * 0.14 }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-200 shadow-[0_0_12px_rgba(255,255,255,0.6)]" />
                {phrase}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
