"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { CharacterOption } from "../gameConfig";
import { localizeCharacterOption } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type LoadingCaveScreenProps = {
  selectedCharacter: CharacterOption;
};

export function LoadingCaveScreen({ selectedCharacter }: LoadingCaveScreenProps) {
  const { locale, messages } = useLanguage();
  const localizedCharacter = localizeCharacterOption(locale, selectedCharacter);
  const phases = messages.play.loadingPhases;
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPhaseIndex((current) => Math.min(current + 1, phases.length - 1));
    }, 820);

    return () => window.clearInterval(interval);
  }, [phases.length]);

  return (
    <section className="relative z-10 flex min-h-screen items-center justify-center px-4 sm:px-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.075),transparent_34%),radial-gradient(circle_at_bottom,rgba(82,9,20,0.28),transparent_46%)]" />

      <div className="relative text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-zinc-100/90 shadow-[0_0_48px_rgba(255,255,255,0.22)] sm:h-28 sm:w-28">
          <Image
            src={selectedCharacter.imageGame}
            alt={localizedCharacter.name}
            width={72}
            height={72}
            className="h-16 w-16 animate-pulse object-contain sm:h-18 sm:w-18"
          />
        </div>

        <p className="mt-8 text-xs tracking-[0.35em] text-zinc-500">
          {localizedCharacter.name}
        </p>
        <h1 className="mt-4 text-2xl font-semibold tracking-[0.12em] text-white sm:text-3xl sm:tracking-[0.18em]">
          {messages.play.loadingCave}
        </h1>
        <p className="mt-4 text-sm text-zinc-400">{phases[phaseIndex]}</p>

        <div className="mx-auto mt-8 h-1.5 w-full max-w-72 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-white transition-all duration-700"
            style={{ width: `${((phaseIndex + 1) / phases.length) * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
}
