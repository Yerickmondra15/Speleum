"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Play, UserRound } from "lucide-react";
import type { CharacterOption } from "../gameConfig";
import { LanguageSwitcher } from "@/app/components/LanguageSwitcher";
import { localizeCharacterOption } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type PlayMenuProps = {
  selectedCharacter: CharacterOption;
  onOpenCharacters: () => void;
  onStartLocal: () => void;
  onStartMultiplayer: () => void;
};

export function PlayMenu({
  selectedCharacter,
  onOpenCharacters,
  onStartLocal,
  onStartMultiplayer,
}: PlayMenuProps) {
  const { locale, messages } = useLanguage();
  const localizedCharacter = localizeCharacterOption(locale, selectedCharacter);

  return (
    <section className="relative z-10 min-h-screen overflow-x-hidden px-4 py-6 sm:px-5 sm:py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.08),transparent_19%),radial-gradient(circle_at_58%_58%,rgba(82,9,20,0.22),transparent_34%)]" />
      <div className="absolute left-1/2 top-1/2 h-128 w-lg -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5 sm:h-168 sm:w-2xl" />
      <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5 sm:h-120 sm:w-120" />
      <div className="absolute bottom-8 left-8 hidden text-xs tracking-[0.28em] text-zinc-600 sm:block">
        {localizedCharacter.name}
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center py-12 text-center">
        <Image
          src="/Grafico/Nombre-white.svg"
          alt="Speleum"
          width={180}
          height={40}
          className="h-8 w-auto opacity-90"
        />
        <div className="mt-4 flex items-center justify-center gap-3">
          <p className="text-xs tracking-[0.42em] text-zinc-500">SPELEUM</p>
          <LanguageSwitcher />
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-[0.2em] text-white sm:text-8xl sm:tracking-[0.32em]">
          {messages.common.play.toUpperCase()}
        </h1>
        <p className="mt-7 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
          {messages.play.menuDescription}
        </p>

        <div className="mt-12 grid w-full max-w-md gap-3 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center">
          <button
            type="button"
            onClick={onStartLocal}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            <Play className="h-4 w-4 fill-black" />
            {messages.play.local}
          </button>
          <button
            type="button"
            onClick={onStartMultiplayer}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-950/50 px-8 py-3 text-sm text-cyan-100 transition hover:bg-cyan-900/60"
          >
            <Play className="h-4 w-4 fill-cyan-100" />
            {messages.play.multiplayer}
          </button>
          <button
            type="button"
            onClick={onOpenCharacters}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-black/45 px-8 py-3 text-sm text-white transition hover:bg-white/10"
          >
            <UserRound className="h-4 w-4" />
            {messages.play.creature}
          </button>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-black/30 px-8 py-3 text-sm text-zinc-300 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {messages.common.home}
          </Link>
        </div>

        <div className="mt-14 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-zinc-100/90 shadow-[0_0_34px_rgba(255,255,255,0.25)]">
            <Image
              src={selectedCharacter.imageGame}
              alt={localizedCharacter.name}
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {localizedCharacter.name}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{localizedCharacter.role}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
